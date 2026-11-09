'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { toast } from 'sonner'
import type { Tables } from '@/lib/types/database'

export type SalesInvoice = Tables<'sales_invoices'>
export type CustomerReceipt = Tables<'customer_receipts'>
export type ClientReceivable = Tables<'v_client_receivables'>
export type InvoiceAgeing = Tables<'v_invoice_ageing'>
export type PaymentMode = 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'card' | 'other'

export const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank transfer (NEFT/RTGS/IMPS)' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
]

export const paymentModeLabel = (mode: string) =>
  PAYMENT_MODES.find((m) => m.value === mode)?.label.split(' (')[0] ?? mode

// Postgres errors raised by the finance RPCs carry a readable message
function rpcError(error: { message?: string } | null, fallback: string): Error {
  return new Error(error?.message || fallback)
}

const FINANCE_KEYS = [
  ['invoices'],
  ['invoice'],
  ['uninvoiced-challans'],
  ['receipts'],
  ['client-receivables'],
  ['invoice-ageing'],
  ['client-credit'],
  ['sales-orders'],
  ['delivery-challans'],
] as const

function useInvalidateFinance() {
  const qc = useQueryClient()
  return () => Promise.all(FINANCE_KEYS.map((queryKey) => qc.invalidateQueries({ queryKey: [...queryKey] })))
}

// ── Reference data ───────────────────────────────────────────

export function useGstStates() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['gst-states'],
    queryFn: async () => {
      const { data, error } = await supabase.from('gst_states').select('*').order('name')
      if (error) throw error
      return data
    },
    staleTime: Infinity,
  })
}

// ── Invoices ─────────────────────────────────────────────────

export function useInvoices(filters?: {
  status?: 'issued' | 'cancelled'
  clientId?: string
  unpaidOnly?: boolean
  from?: string
  to?: string
}) {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['invoices', orgId, filters],
    queryFn: async () => {
      if (!orgId) return []
      let query = supabase
        .from('sales_invoices')
        .select('*, client:clients ( id, name ), sales_order:sales_orders ( id, so_number )')
        .order('invoice_date', { ascending: false })
        .order('invoice_no', { ascending: false })

      if (filters?.status) query = query.eq('status', filters.status)
      if (filters?.clientId) query = query.eq('client_id', filters.clientId)
      if (filters?.unpaidOnly) query = query.gt('balance_due', 0).eq('status', 'issued')
      if (filters?.from) query = query.gte('invoice_date', filters.from)
      if (filters?.to) query = query.lte('invoice_date', filters.to)

      const { data, error } = await query
      if (error) throw error
      return data
    },
    enabled: !!orgId,
    staleTime: 30 * 1000,
  })
}

export function useInvoice(id: string | null) {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['invoice', orgId, id],
    queryFn: async () => {
      if (!id || !orgId) return null
      const { data, error } = await supabase
        .from('sales_invoices')
        .select(`
          *,
          client:clients ( id, name, phone, email ),
          sales_order:sales_orders ( id, so_number ),
          sales_invoice_lines ( * ),
          delivery_challans ( id, challan_no, challan_date ),
          receipt_allocations (
            id, amount, created_at,
            receipt:customer_receipts ( id, receipt_no, receipt_date, mode, reference, status )
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

// Delivery challans that are dispatched/delivered and not yet billed
export function useUninvoicedChallans(clientId?: string) {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['uninvoiced-challans', orgId, clientId ?? null],
    queryFn: async () => {
      if (!orgId) return []
      let query = supabase
        .from('delivery_challans')
        .select(`
          id, challan_no, challan_date, status, total_amount, client_id, so_id,
          client:clients ( id, name, gst_number, state_code ),
          sales_order:sales_orders ( id, so_number ),
          delivery_challan_lines (
            id, qty, rate, line_total,
            item:items ( id, name, item_code, hsn_code ),
            so_line:sales_order_lines ( gst_percent )
          )
        `)
        .is('invoice_id', null)
        .in('status', ['dispatched', 'delivered'])
        .order('challan_date')
        .order('challan_no')
      if (clientId) query = query.eq('client_id', clientId)
      const { data, error } = await query
      if (error) throw error
      return data
    },
    enabled: !!orgId,
    staleTime: 15 * 1000,
  })
}

export function useCreateInvoice() {
  const supabase = createClient()
  const invalidate = useInvalidateFinance()

  return useMutation({
    mutationFn: async (args: {
      challanIds: string[]
      invoiceDate?: string
      notes?: string
      reverseCharge?: boolean
    }) => {
      const { data, error } = await supabase.rpc('create_sales_invoice', {
        p_challan_ids: args.challanIds,
        p_invoice_date: args.invoiceDate,
        p_notes: args.notes,
        p_reverse_charge: args.reverseCharge ?? false,
      })
      if (error) throw rpcError(error, 'Could not create the invoice')
      return data as {
        id: string
        invoice_no: string
        total_amount: number
        advance_applied: number
        is_interstate: boolean
      }
    },
    onSuccess: () => invalidate(),
  })
}

export function useCancelInvoice() {
  const supabase = createClient()
  const invalidate = useInvalidateFinance()

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc('cancel_sales_invoice', {
        p_invoice_id: id,
        p_reason: reason,
      })
      if (error) throw rpcError(error, 'Could not cancel the invoice')
      return data
    },
    onSuccess: () => {
      invalidate()
      toast.success('Invoice cancelled — its challans can be invoiced again')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ── Receipts ─────────────────────────────────────────────────

export function useReceipts(filters?: { clientId?: string; from?: string; to?: string }) {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['receipts', orgId, filters],
    queryFn: async () => {
      if (!orgId) return []
      let query = supabase
        .from('customer_receipts')
        .select(`
          *,
          client:clients ( id, name ),
          sales_order:sales_orders ( id, so_number ),
          receipt_allocations ( id, amount, invoice:sales_invoices ( id, invoice_no ) )
        `)
        .order('receipt_date', { ascending: false })
        .order('receipt_no', { ascending: false })
      if (filters?.clientId) query = query.eq('client_id', filters.clientId)
      if (filters?.from) query = query.gte('receipt_date', filters.from)
      if (filters?.to) query = query.lte('receipt_date', filters.to)
      const { data, error } = await query
      if (error) throw error
      return data
    },
    enabled: !!orgId,
    staleTime: 30 * 1000,
  })
}

export function useRecordReceipt() {
  const supabase = createClient()
  const invalidate = useInvalidateFinance()

  return useMutation({
    mutationFn: async (args: {
      clientId: string
      amount: number
      mode: PaymentMode
      receiptDate?: string
      reference?: string
      notes?: string
      soId?: string
      allocations?: { invoice_id: string; amount: number }[]
      autoAllocate?: boolean
    }) => {
      const { data, error } = await supabase.rpc('record_customer_receipt', {
        p_client_id: args.clientId,
        p_amount: args.amount,
        p_mode: args.mode,
        p_receipt_date: args.receiptDate,
        p_reference: args.reference,
        p_notes: args.notes,
        p_so_id: args.soId,
        p_allocations: args.allocations && args.allocations.length > 0 ? args.allocations : undefined,
        p_auto_allocate: args.autoAllocate ?? true,
      })
      if (error) throw rpcError(error, 'Could not record the payment')
      return data as { id: string; receipt_no: string; allocated: number; unallocated: number }
    },
    onSuccess: () => invalidate(),
  })
}

export function useAllocateReceipt() {
  const supabase = createClient()
  const invalidate = useInvalidateFinance()

  return useMutation({
    mutationFn: async (args: { receiptId: string; allocations?: { invoice_id: string; amount: number }[] }) => {
      const { data, error } = await supabase.rpc('allocate_customer_receipt', {
        p_receipt_id: args.receiptId,
        p_allocations: args.allocations && args.allocations.length > 0 ? args.allocations : undefined,
      })
      if (error) throw rpcError(error, 'Could not apply the payment')
      return data as { id: string; allocated: number }
    },
    onSuccess: (data) => {
      invalidate()
      toast.success(data.allocated > 0 ? 'Payment applied to invoices' : 'No open invoices to apply it to')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useCancelReceipt() {
  const supabase = createClient()
  const invalidate = useInvalidateFinance()

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc('cancel_customer_receipt', {
        p_receipt_id: id,
        p_reason: reason,
      })
      if (error) throw rpcError(error, 'Could not cancel the receipt')
      return data
    },
    onSuccess: () => {
      invalidate()
      toast.success('Receipt cancelled — invoice balances restored')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ── Receivables ──────────────────────────────────────────────

export function useClientReceivables() {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['client-receivables', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data, error } = await supabase
        .from('v_client_receivables')
        .select('*')
        .order('outstanding', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!orgId,
    staleTime: 30 * 1000,
  })
}

export function useInvoiceAgeing(clientId?: string) {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['invoice-ageing', orgId, clientId ?? null],
    queryFn: async () => {
      if (!orgId) return []
      let query = supabase
        .from('v_invoice_ageing')
        .select('*')
        .order('due_date')
        .order('invoice_no')
      if (clientId) query = query.eq('client_id', clientId)
      const { data, error } = await query
      if (error) throw error
      return data
    },
    enabled: !!orgId,
    staleTime: 30 * 1000,
  })
}

export type CreditStatus = {
  client_id: string
  credit_limit: number
  credit_days: number
  outstanding: number
  overdue: number
  open_orders: number
  unallocated_credit: number
  exposure: number
  available: number | null
}

export function useClientCreditStatus(clientId: string | null | undefined) {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['client-credit', orgId, clientId],
    queryFn: async () => {
      if (!clientId) return null
      const { data, error } = await supabase.rpc('client_credit_status', { p_client_id: clientId })
      if (error) throw error
      return data as CreditStatus
    },
    enabled: !!orgId && !!clientId,
    staleTime: 30 * 1000,
  })
}

// ── GST reports ──────────────────────────────────────────────

export function useHsnSummary(from: string, to: string) {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['hsn-summary', orgId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('gst_hsn_summary', { p_from: from, p_to: to })
      if (error) throw error
      return data
    },
    enabled: !!orgId && !!from && !!to,
    staleTime: 60 * 1000,
  })
}

// ── Company tax profile ──────────────────────────────────────

export function useCompanyProfile() {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['company-profile', orgId],
    queryFn: async () => {
      if (!orgId) return null
      const { data, error } = await supabase
        .from('organizations')
        .select(`
          id, name, address, city, state, pincode, phone, email, gst_number, state_code, pan,
          invoice_prefix, invoice_terms, bank_name, bank_account_no, bank_ifsc, bank_branch
        `)
        .eq('id', orgId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  })
}
