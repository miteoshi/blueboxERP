'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { allRows } from '@/lib/utils/all-rows'
import { toast } from 'sonner'
import { useRequestId } from '@/lib/hooks/use-request-id'
import { isAlreadySaved, rpcFailure } from '@/lib/utils/rpc'
import type { Enums, Tables } from '@/lib/types/database'

export type PurchaseOrder = Tables<'purchase_orders'>
export type PurchaseOrderStatus = 'draft' | 'issued' | 'partially_received' | 'received' | 'closed' | 'cancelled'

export const PO_STATUS: Record<PurchaseOrderStatus, { label: string; variant: 'default' | 'info' | 'warning' | 'success' | 'danger' }> = {
  draft:              { label: 'Draft',              variant: 'default' },
  issued:             { label: 'Issued',             variant: 'info' },
  partially_received: { label: 'Partly received',    variant: 'warning' },
  received:           { label: 'Received',           variant: 'success' },
  closed:             { label: 'Closed short',       variant: 'default' },
  cancelled:          { label: 'Cancelled',          variant: 'danger' },
}

export const OPEN_PO_STATUSES: PurchaseOrderStatus[] = ['issued', 'partially_received']

export const poStatus = (status: string) =>
  PO_STATUS[status as PurchaseOrderStatus] ?? { label: status, variant: 'default' as const }

// Postgres errors raised by the purchasing RPCs carry a readable message
function rpcError(error: { message?: string } | null, fallback: string): Error {
  return new Error(error?.message || fallback)
}

const PURCHASING_KEYS = [
  ['purchase-orders'],
  ['purchase-order'],
  ['open-po-qty'],
  ['inbound-receipts'],
  ['stock-levels'],
  ['reorder-alerts'],
] as const

function useInvalidatePurchasing() {
  const qc = useQueryClient()
  return () => Promise.all(PURCHASING_KEYS.map((queryKey) => qc.invalidateQueries({ queryKey: [...queryKey] })))
}

// ── Reference data (shared by GRN and purchase order forms) ──

export function useActiveSuppliers() {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['suppliers-list', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data, error } = await allRows(supabase
        .from('suppliers')
        .select('id, name, payment_terms, credit_days')
        .eq('is_active', true)
        .order('name')
        .order('id'))
      if (error) throw error
      return data
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  })
}

// Items that are bought in (traded goods and raw materials), with their
// current purchase rate and GST from the price list
export function usePurchasableItems() {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['items-for-grn', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const [{ data, error }, { data: prices, error: pricesError }] = await Promise.all([
        allRows(supabase
          .from('items')
          .select('id, item_code, name, unit_id, hsn_code, unit:units ( id, name )')
          .eq('is_active', true)
          .or('is_traded.eq.true,is_raw_material.eq.true')
          .order('name')
          .order('id')),
        allRows(supabase
          .from('v_current_prices')
          .select('item_id, purchase_rate, gst_percent')
          .order('item_id')),
      ])
      if (error) throw error
      if (pricesError) throw pricesError
      const priceMap = new Map(prices?.map((p) => [p.item_id, p]) ?? [])
      return data?.map((i) => ({ ...i, price: priceMap.get(i.id) ?? null })) ?? []
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  })
}

// ── Lists ────────────────────────────────────────────────────

export function usePurchaseOrders() {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['purchase-orders', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data, error } = await allRows(supabase
        .from('purchase_orders')
        .select(`
          id, po_no, po_date, expected_date, status, taxable_value, gst_amount, total_amount, created_at,
          supplier:suppliers ( id, name ),
          purchase_order_lines ( qty, qty_received, rate )
        `)
        .order('po_date', { ascending: false })
        .order('po_no', { ascending: false })
        .order('id'))
      if (error) throw error
      return data
    },
    enabled: !!orgId,
    staleTime: 30 * 1000,
  })
}

export function usePurchaseOrder(id: string | null) {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['purchase-order', orgId, id],
    queryFn: async () => {
      if (!id || !orgId) return null
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers ( id, name, contact_person, phone, email, gst_number, address, city, state, state_code, payment_terms ),
          creator:profiles!purchase_orders_created_by_fkey ( full_name ),
          issuer:profiles!purchase_orders_issued_by_fkey ( full_name ),
          closer:profiles!purchase_orders_closed_by_fkey ( full_name ),
          purchase_order_lines (
            *,
            unit:units ( id, name ),
            item:items ( id, item_code, name, hsn_code )
          ),
          inbound_receipts ( id, receipt_no, receipt_date, total_amount, gst_amount, challan_no, invoice_no, status )
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

// Quantity still due on issued orders, per item (for low-stock planning)
export function useOpenPoQty() {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['open-po-qty', orgId],
    queryFn: async () => {
      if (!orgId) return new Map<string, number>()
      const { data, error } = await allRows(supabase
        .from('purchase_orders')
        .select('id, purchase_order_lines ( item_id, qty, qty_received )')
        .in('status', OPEN_PO_STATUSES)
        .order('id'))
      if (error) throw error
      const due = new Map<string, number>()
      for (const po of data ?? []) {
        for (const l of po.purchase_order_lines ?? []) {
          due.set(l.item_id, (due.get(l.item_id) ?? 0) + Math.max(Number(l.qty) - Number(l.qty_received), 0))
        }
      }
      return due
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,
  })
}

// ── Mutations ────────────────────────────────────────────────

export type PoLineInput = {
  item_id: string
  unit_id?: string
  qty: number
  rate: number
  gst_percent: Enums<'gst_rate'>
  notes?: string
}

export type PoInput = {
  supplierId: string
  lines: PoLineInput[]
  expectedDate?: string
  terms?: string
  notes?: string
}

export function useCreatePurchaseOrder() {
  const supabase = createClient()
  const invalidate = useInvalidatePurchasing()

  return useMutation({
    mutationFn: async (input: PoInput & { issue: boolean; poDate?: string }) => {
      const { data, error } = await supabase.rpc('create_purchase_order', {
        p_supplier_id: input.supplierId,
        p_lines: input.lines,
        p_expected_date: input.expectedDate || undefined,
        p_terms: input.terms || undefined,
        p_notes: input.notes || undefined,
        p_issue: input.issue,
        p_po_date: input.poDate || undefined,
      })
      if (error) throw rpcError(error, 'Could not create the purchase order')
      return data as { id: string; po_no: string; status: PurchaseOrderStatus; total_amount: number }
    },
    onSuccess: (data) => {
      invalidate()
      toast.success(`${data.po_no} ${data.status === 'issued' ? 'issued' : 'saved as draft'}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdatePurchaseOrder() {
  const supabase = createClient()
  const invalidate = useInvalidatePurchasing()

  return useMutation({
    mutationFn: async (input: PoInput & { id: string }) => {
      const { data, error } = await supabase.rpc('update_purchase_order', {
        p_po_id: input.id,
        p_supplier_id: input.supplierId,
        p_lines: input.lines,
        p_expected_date: input.expectedDate || undefined,
        p_terms: input.terms || undefined,
        p_notes: input.notes || undefined,
      })
      if (error) throw rpcError(error, 'Could not save the purchase order')
      return data as { id: string; po_no: string }
    },
    onSuccess: (data) => {
      invalidate()
      toast.success(`${data.po_no} saved`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useIssuePurchaseOrder() {
  const supabase = createClient()
  const invalidate = useInvalidatePurchasing()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('issue_purchase_order', { p_po_id: id })
      if (error) throw rpcError(error, 'Could not issue the purchase order')
      return data as { po_no: string }
    },
    onSuccess: (data) => {
      invalidate()
      toast.success(`${data.po_no} issued`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useClosePurchaseOrder() {
  const supabase = createClient()
  const invalidate = useInvalidatePurchasing()

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc('close_purchase_order', { p_po_id: id, p_reason: reason })
      if (error) throw rpcError(error, 'Could not close the purchase order')
      return data as { po_no: string; status: PurchaseOrderStatus }
    },
    onSuccess: (data) => {
      invalidate()
      toast.success(`${data.po_no} ${data.status === 'closed' ? 'closed short' : 'cancelled'}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useReceivePurchaseOrder() {
  const supabase = createClient()
  const invalidate = useInvalidatePurchasing()
  const requestId = useRequestId()

  return useMutation({
    mutationFn: async (input: {
      id: string
      lines: { po_line_id: string; qty: number; notes?: string }[]
      receiptDate?: string
      transportMode?: Enums<'transport_mode'>
      vehicleNo?: string
      driverName?: string
      challanNo?: string
      invoiceNo?: string
      notes?: string
    }) => {
      const { data, error } = await supabase.rpc('receive_purchase_order', {
        p_po_id: input.id,
        p_lines: input.lines,
        p_receipt_date: input.receiptDate || undefined,
        p_transport_mode: input.transportMode,
        p_vehicle_no: input.vehicleNo || undefined,
        p_driver_name: input.driverName || undefined,
        p_challan_no: input.challanNo || undefined,
        p_invoice_no: input.invoiceNo || undefined,
        p_notes: input.notes || undefined,
        p_request_id: requestId.get(),
      })
      if (error) throw rpcFailure(error, 'Could not record the receipt')
      return data as { id: string; receipt_no: string; po_no: string; po_status: PurchaseOrderStatus }
    },
    onSuccess: (data) => {
      requestId.clear()
      invalidate()
      toast.success(`${data.receipt_no} recorded — stock updated${data.po_status === 'received' ? `; ${data.po_no} fully received` : ''}`)
    },
    onError: (err: Error) => {
      toast.error(err.message)
      if (isAlreadySaved(err)) invalidate()
    },
  })
}
