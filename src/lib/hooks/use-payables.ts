'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { allRows } from '@/lib/utils/all-rows'
import type { PaymentMode } from '@/lib/hooks/use-finance'
import { toast } from 'sonner'
import { useRequestId } from '@/lib/hooks/use-request-id'
import { isAlreadySaved, rpcFailure } from '@/lib/utils/rpc'
import type { Enums } from '@/lib/types/database'

// Postgres errors raised by the payables RPCs carry a readable message
function rpcError(error: { message?: string } | null, fallback: string): Error {
  return new Error(error?.message || fallback)
}

const PAYABLES_KEYS = [
  ['supplier-bills'],
  ['supplier-bill'],
  ['unbilled-grn-lines'],
  ['supplier-payments'],
  ['supplier-payables'],
  ['bill-ageing'],
  ['inbound-receipt'],
  ['debit-notes'],
  ['debit-note'],
  ['stock-levels'],
  ['purchase-register'],
] as const

function useInvalidatePayables() {
  const qc = useQueryClient()
  return () => Promise.all(PAYABLES_KEYS.map((queryKey) => qc.invalidateQueries({ queryKey: [...queryKey] })))
}

export type BillState = 'unpaid' | 'part_paid' | 'paid' | 'settled' | 'overdue' | 'cancelled'

export const BILL_STATE: Record<BillState, { label: string; variant: 'default' | 'info' | 'warning' | 'success' | 'danger' }> = {
  unpaid:    { label: 'Unpaid',    variant: 'info' },
  part_paid: { label: 'Part paid', variant: 'warning' },
  paid:      { label: 'Paid',      variant: 'success' },
  settled:   { label: 'Settled',   variant: 'success' },
  overdue:   { label: 'Overdue',   variant: 'danger' },
  cancelled: { label: 'Cancelled', variant: 'default' },
}

// A bill with nothing left to pay is "Paid" if money went out, and "Settled"
// if debit notes cleared it instead.
export function billState(
  bill: { status: string; balance_due: number | null; amount_paid: number; due_date: string },
  today: string,
): BillState {
  if (bill.status === 'cancelled') return 'cancelled'
  if ((bill.balance_due ?? 0) <= 0) return bill.amount_paid > 0 ? 'paid' : 'settled'
  if (bill.due_date < today) return 'overdue'
  return bill.amount_paid > 0 ? 'part_paid' : 'unpaid'
}

// ── Bills ────────────────────────────────────────────────────

export function useSupplierBills() {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['supplier-bills', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data, error } = await allRows(supabase
        .from('supplier_bills')
        .select(`
          id, bill_no, supplier_invoice_no, bill_date, due_date, status,
          taxable_value, total_amount, amount_paid, amount_debited, balance_due,
          supplier:suppliers ( id, name )
        `)
        .order('bill_date', { ascending: false })
        .order('bill_no', { ascending: false })
        .order('id'))
      if (error) throw error
      return data
    },
    enabled: !!orgId,
    staleTime: 30 * 1000,
  })
}

export function useSupplierBill(id: string | null) {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['supplier-bill', orgId, id],
    queryFn: async () => {
      if (!id || !orgId) return null
      const { data, error } = await supabase
        .from('supplier_bills')
        .select(`
          *,
          supplier:suppliers ( id, name, gst_number, phone, city ),
          creator:profiles!supplier_bills_created_by_fkey ( full_name ),
          canceller:profiles!supplier_bills_cancelled_by_fkey ( full_name ),
          supplier_bill_lines (
            *,
            unit:units ( name ),
            item:items ( item_code, name, hsn_code ),
            grn_line:inbound_receipt_lines ( rate, receipt:inbound_receipts ( id, receipt_no, receipt_date ) )
          ),
          supplier_payment_allocations (
            id, amount,
            payment:supplier_payments ( id, payment_no, payment_date, mode, reference, status )
          ),
          debit_notes (
            id, debit_note_no, note_date, reason, returned_stock, total_amount, status,
            debit_note_lines ( bill_line_id, qty, taxable_value )
          )
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id && !!orgId,
    staleTime: 30 * 1000,
  })
}

// GRN lines received from a supplier that have not been fully billed
export function useUnbilledGrnLines(supplierId: string | null) {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['unbilled-grn-lines', orgId, supplierId],
    queryFn: async () => {
      if (!orgId) return []
      let query = supabase
        .from('inbound_receipts')
        .select(`
          id, receipt_no, receipt_date, invoice_no, supplier_id,
          supplier:suppliers ( id, name ),
          po:purchase_orders ( po_no ),
          inbound_receipt_lines (
            id, qty_received, qty_billed, rate, gst_percent,
            unit:units ( name ),
            item:items ( item_code, name )
          )
        `)
        .eq('status', 'received')
        .order('receipt_date')
        .order('receipt_no')
      if (supplierId) query = query.eq('supplier_id', supplierId)
      const { data, error } = await allRows(query.order('id'))
      if (error) throw error
      return (data ?? [])
        .map((g) => ({
          ...g,
          inbound_receipt_lines: g.inbound_receipt_lines.filter((l) => Number(l.qty_received) - Number(l.qty_billed) > 0.00001),
        }))
        .filter((g) => g.inbound_receipt_lines.length > 0)
    },
    enabled: !!orgId,
    staleTime: 30 * 1000,
  })
}

export function useCreateSupplierBill() {
  const supabase = createClient()
  const invalidate = useInvalidatePayables()

  return useMutation({
    mutationFn: async (input: {
      supplierId: string
      supplierInvoiceNo: string
      billDate: string
      lines: { grn_line_id: string; qty: number; rate: number; gst_percent: Enums<'gst_rate'> }[]
      invoiceTotal?: number
      dueDate?: string
      notes?: string
    }) => {
      const { data, error } = await supabase.rpc('create_supplier_bill', {
        p_supplier_id: input.supplierId,
        p_supplier_invoice_no: input.supplierInvoiceNo,
        p_bill_date: input.billDate,
        p_lines: input.lines,
        p_invoice_total: input.invoiceTotal,
        p_due_date: input.dueDate || undefined,
        p_notes: input.notes || undefined,
      })
      if (error) throw rpcError(error, 'Could not save the bill')
      return data as { id: string; bill_no: string; total_amount: number; due_date: string }
    },
    onSuccess: (data) => {
      invalidate()
      toast.success(`${data.bill_no} saved`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useCancelSupplierBill() {
  const supabase = createClient()
  const invalidate = useInvalidatePayables()

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc('cancel_supplier_bill', { p_bill_id: id, p_reason: reason })
      if (error) throw rpcError(error, 'Could not cancel the bill')
      return data as { bill_no: string }
    },
    onSuccess: (data) => {
      invalidate()
      toast.success(`${data.bill_no} cancelled`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ── Payables and payments ────────────────────────────────────

export function useSupplierPayables() {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['supplier-payables', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data, error } = await allRows(supabase
        .from('v_supplier_payables')
        .select('*')
        .order('outstanding', { ascending: false })
        .order('supplier_id'))
      if (error) throw error
      return data
    },
    enabled: !!orgId,
    staleTime: 30 * 1000,
  })
}

export function useBillAgeing(supplierId?: string) {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['bill-ageing', orgId, supplierId ?? null],
    queryFn: async () => {
      if (!orgId) return []
      let query = supabase.from('v_bill_ageing').select('*').order('due_date').order('bill_no')
      if (supplierId) query = query.eq('supplier_id', supplierId)
      const { data, error } = await allRows(query.order('id'))
      if (error) throw error
      return data
    },
    enabled: !!orgId,
    staleTime: 30 * 1000,
  })
}

export function useSupplierPayments() {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['supplier-payments', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data, error } = await allRows(supabase
        .from('supplier_payments')
        .select(`
          id, payment_no, payment_date, amount, amount_allocated, mode, reference, notes, status, cancel_reason,
          supplier:suppliers ( id, name ),
          supplier_payment_allocations ( amount, bill:supplier_bills ( id, bill_no ) )
        `)
        .order('payment_date', { ascending: false })
        .order('payment_no', { ascending: false })
        .order('id'))
      if (error) throw error
      return data
    },
    enabled: !!orgId,
    staleTime: 30 * 1000,
  })
}

export function useRecordSupplierPayment() {
  const supabase = createClient()
  const invalidate = useInvalidatePayables()
  const requestId = useRequestId()

  return useMutation({
    mutationFn: async (input: {
      supplierId: string
      amount: number
      mode: PaymentMode
      paymentDate?: string
      reference?: string
      notes?: string
      // Pay one bill; otherwise the oldest due bills are paid first
      billId?: string
    }) => {
      const { data, error } = await supabase.rpc('record_supplier_payment', {
        p_supplier_id: input.supplierId,
        p_amount: input.amount,
        p_mode: input.mode,
        p_payment_date: input.paymentDate || undefined,
        p_reference: input.reference || undefined,
        p_notes: input.notes || undefined,
        p_allocations: input.billId ? [{ bill_id: input.billId, amount: input.amount }] : undefined,
        p_request_id: requestId.get(),
      })
      if (error) throw rpcFailure(error, 'Could not record the payment')
      return data as { id: string; payment_no: string; amount: number; allocated: number; unallocated: number }
    },
    onSuccess: (data) => {
      requestId.clear()
      invalidate()
      toast.success(
        data.unallocated > 0.005
          ? `${data.payment_no} recorded — ₹${data.unallocated.toFixed(2)} kept as advance`
          : `${data.payment_no} recorded`,
      )
    },
    onError: (err: Error) => {
      toast.error(err.message)
      if (isAlreadySaved(err)) invalidate()
    },
  })
}

// Apply what is left of a payment (an advance) to the supplier's oldest bills
export function useApplySupplierAdvance() {
  const supabase = createClient()
  const invalidate = useInvalidatePayables()

  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { data, error } = await supabase.rpc('allocate_supplier_payment', { p_payment_id: paymentId })
      if (error) throw rpcError(error, 'Could not apply the advance')
      return data as { allocated: number }
    },
    onSuccess: (data) => {
      invalidate()
      if (data.allocated > 0) toast.success(`₹${Number(data.allocated).toFixed(2)} applied to bills`)
      else toast.info('No open bills to apply this to')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useCancelSupplierPayment() {
  const supabase = createClient()
  const invalidate = useInvalidatePayables()

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc('cancel_supplier_payment', { p_payment_id: id, p_reason: reason })
      if (error) throw rpcError(error, 'Could not cancel the payment')
      return data as { payment_no: string }
    },
    onSuccess: (data) => {
      invalidate()
      toast.success(`${data.payment_no} cancelled`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ── Debit notes (purchase returns and post-billing adjustments) ──

export type DebitNoteReason = 'purchase_return' | 'rate_difference' | 'discount' | 'deficiency' | 'other'

export const DEBIT_NOTE_REASONS: { value: DebitNoteReason; label: string; hint: string }[] = [
  { value: 'purchase_return', label: 'Goods returned', hint: 'Return items to the supplier. Quantity based; can take the goods out of stock.' },
  { value: 'rate_difference', label: 'Rate difference', hint: 'The supplier billed a higher rate than agreed.' },
  { value: 'discount', label: 'Discount agreed later', hint: 'A discount settled after the invoice was raised.' },
  { value: 'deficiency', label: 'Short or damaged', hint: 'Short supply or damaged goods you are not sending back.' },
  { value: 'other', label: 'Other', hint: 'Anything else reducing what you owe on this bill.' },
]

export const debitNoteReasonLabel = (reason: string) =>
  DEBIT_NOTE_REASONS.find((r) => r.value === reason)?.label ?? reason

export function useDebitNotes() {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['debit-notes', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data, error } = await allRows(supabase
        .from('debit_notes')
        .select(`
          id, debit_note_no, note_date, reason, returned_stock, status, cancel_reason,
          taxable_value, cgst_amount, sgst_amount, igst_amount, total_amount, is_interstate,
          supplier:suppliers ( id, name ),
          bill:supplier_bills ( id, bill_no, supplier_invoice_no )
        `)
        .order('note_date', { ascending: false })
        .order('debit_note_no', { ascending: false })
        .order('id'))
      if (error) throw error
      return data
    },
    enabled: !!orgId,
    staleTime: 30 * 1000,
  })
}

export function useDebitNote(id: string | null) {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['debit-note', orgId, id],
    queryFn: async () => {
      if (!id || !orgId) return null
      const { data, error } = await supabase
        .from('debit_notes')
        .select(`
          *,
          supplier:suppliers ( id, name, gst_number, phone, city ),
          bill:supplier_bills ( id, bill_no, supplier_invoice_no, bill_date, total_amount, amount_debited, balance_due ),
          creator:profiles!debit_notes_created_by_fkey ( full_name ),
          canceller:profiles!debit_notes_cancelled_by_fkey ( full_name ),
          debit_note_lines (
            *,
            unit:units ( name ),
            item:items ( item_code, name, hsn_code )
          )
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id && !!orgId,
    staleTime: 30 * 1000,
  })
}

export function useCreateDebitNote() {
  const supabase = createClient()
  const invalidate = useInvalidatePayables()
  const requestId = useRequestId()

  return useMutation({
    mutationFn: async (input: {
      billId: string
      reason: DebitNoteReason
      // qty for a return, taxable_value for the other reasons
      lines: { bill_line_id: string; qty?: number; taxable_value?: number }[]
      returnStock?: boolean
      noteDate?: string
      notes?: string
    }) => {
      const { data, error } = await supabase.rpc('create_debit_note', {
        p_bill_id: input.billId,
        p_reason: input.reason,
        p_lines: input.lines,
        p_return_stock: input.returnStock ?? false,
        p_note_date: input.noteDate || undefined,
        p_notes: input.notes || undefined,
        p_request_id: requestId.get(),
      })
      if (error) throw rpcFailure(error, 'Could not raise the debit note')
      return data as { id: string; debit_note_no: string; total_amount: number; payment_released: number }
    },
    onSuccess: (data) => {
      requestId.clear()
      invalidate()
      toast.success(
        data.payment_released > 0.005
          ? `${data.debit_note_no} raised — ₹${Number(data.payment_released).toFixed(2)} of payment is now an advance`
          : `${data.debit_note_no} raised`,
      )
    },
    onError: (err: Error) => {
      toast.error(err.message)
      if (isAlreadySaved(err)) invalidate()
    },
  })
}

export function useCancelDebitNote() {
  const supabase = createClient()
  const invalidate = useInvalidatePayables()

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc('cancel_debit_note', { p_debit_note_id: id, p_reason: reason })
      if (error) throw rpcError(error, 'Could not cancel the debit note')
      return data as { debit_note_no: string }
    },
    onSuccess: (data) => {
      invalidate()
      toast.success(`${data.debit_note_no} cancelled`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
