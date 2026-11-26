import { rpcFailure } from '@/lib/utils/rpc'
import { createClient } from '@/lib/supabase/client'
import type { Enums } from '@/lib/types/database'

// ─────────────────────────────────────────────────────────────
// Inventory RPC Wrappers
// Every function generates a unique operation_id for idempotency.
// Args match the generated database.ts exactly — no 'as any' casts.
// ─────────────────────────────────────────────────────────────

function opId() {
  return crypto.randomUUID()
}

// ── adjust_inventory ──────────────────────────────────────────
// Args (from generated types):
// p_delta, p_item_id, p_operation_id, p_reason, p_ref_id
// Note: args are alphabetical in generated types but passed as object so order doesn't matter
export async function adjustInventory(params: {
  itemId:  string
  delta:   number
  reason:  string
  refId?:  string
  // Pass the same id when retrying the same adjustment, so a save that
  // reached the database but timed out on the way back isn't applied twice.
  operationId?: string
}) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('adjust_inventory', {
    p_operation_id: params.operationId ?? opId(),
    p_item_id:      params.itemId,
    p_delta:        params.delta,
    p_reason:       params.reason,
    p_ref_id:       params.refId,
  })
  if (error) throw new Error(error.message)
  return data
}

// ─────────────────────────────────────────────────────────────
// Document workflow RPCs
// Each one runs in a single database transaction: it either fully
// succeeds or changes nothing (no orphan headers, no stock moved
// without document lines, no half-reserved orders).
// ─────────────────────────────────────────────────────────────

// ── reserve_sales_order ───────────────────────────────────────
// Reserves whatever is still missing for every line of the SO and
// moves it to 'ready'. Safe to call again (tops up only).
export async function reserveSalesOrder(soId: string, expiryHours = 72) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('reserve_sales_order', {
    p_so_id:        soId,
    p_expiry_hours: expiryHours,
  })
  if (error) throw new Error(error.message)
  return data as { success: boolean; so_id: string; reservations_created: number }
}

// ── cancel_sales_order ────────────────────────────────────────
// Releases all live reservations and cancels. Refused once anything
// has been dispatched.
export async function cancelSalesOrder(soId: string) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('cancel_sales_order', {
    p_so_id: soId,
  })
  if (error) throw new Error(error.message)
  return data as { success: boolean; so_id: string; reservations_released: number }
}

// ── create_delivery_challan ───────────────────────────────────
// Header + lines + stock dispatch (consuming the SO's reservations
// first) + qty_dispatched + SO status, all in one transaction.
export async function createDeliveryChallan(params: {
  soId:           string
  lines:          Array<{ soLineId: string; qty: number; rate: number }>
  challanDate?:   string
  transportMode?: Enums<'transport_mode'>
  vehicleNo?:     string
  driverName?:    string
  notes?:         string
  // Sent again on a retry so the database refuses a duplicate challan
  requestId?:     string
}) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('create_delivery_challan', {
    p_so_id:          params.soId,
    p_lines:          params.lines.map((l) => ({
      so_line_id: l.soLineId,
      qty:        l.qty,
      rate:       l.rate,
    })),
    p_challan_date:   params.challanDate,
    p_transport_mode: params.transportMode,
    p_vehicle_no:     params.vehicleNo,
    p_driver_name:    params.driverName,
    p_notes:          params.notes,
    p_request_id:     params.requestId,
  })
  if (error) throw rpcFailure(error, 'Could not create the challan')
  return data as {
    success:        boolean
    id:             string
    challan_no:     string
    total_amount:   number
    lines:          number
    unreserved_qty: number
  }
}

// ── mark_challan_delivered ────────────────────────────────────
// The SO only becomes 'delivered' once it is fully dispatched and
// every challan against it is delivered.
export async function markChallanDelivered(challanId: string) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('mark_challan_delivered', {
    p_challan_id: challanId,
  })
  if (error) throw new Error(error.message)
  return data as { success: boolean; challan_id: string; so_delivered: boolean }
}

// ── create_inbound_receipt ────────────────────────────────────
// GRN header + lines + stock receipt in one transaction.
export async function createInboundReceipt(params: {
  supplierId:     string
  lines: Array<{
    itemId:       string
    unitId:       string
    qtyReceived:  number
    qtyOrdered?:  number
    rate:         number
    gstPercent:   Enums<'gst_rate'>
  }>
  receiptDate?:   string
  transportMode?: Enums<'transport_mode'>
  vehicleNo?:     string
  driverName?:    string
  challanNo?:     string
  invoiceNo?:     string
  notes?:         string
  // Sent again on a retry so the database refuses a duplicate GRN
  requestId?:     string
}) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('create_inbound_receipt', {
    p_supplier_id:    params.supplierId,
    p_lines:          params.lines.map((l) => ({
      item_id:      l.itemId,
      unit_id:      l.unitId,
      qty_received: l.qtyReceived,
      qty_ordered:  l.qtyOrdered && l.qtyOrdered > 0 ? l.qtyOrdered : null,
      rate:         l.rate,
      gst_percent:  l.gstPercent,
    })),
    p_receipt_date:   params.receiptDate,
    p_transport_mode: params.transportMode,
    p_vehicle_no:     params.vehicleNo,
    p_driver_name:    params.driverName,
    p_challan_no:     params.challanNo,
    p_invoice_no:     params.invoiceNo,
    p_notes:          params.notes,
    p_request_id:     params.requestId,
  })
  if (error) throw rpcFailure(error, 'Could not record the GRN')
  return data as {
    success:      boolean
    id:           string
    receipt_no:   string
    total_amount: number
    gst_amount:   number
    lines:        number
  }
}

// ── receive_purchase_order ───────────────────────────────────
// A goods receipt against a purchase order: GRN + stock in + the order's
// received quantities and status, in one transaction.
export async function receivePurchaseOrder(params: {
  poId:           string
  lines:          Array<{ po_line_id: string; qty: number; notes?: string }>
  receiptDate?:   string
  transportMode?: Enums<'transport_mode'>
  vehicleNo?:     string
  driverName?:    string
  challanNo?:     string
  invoiceNo?:     string
  notes?:         string
  // Sent again on a retry so the database refuses a duplicate receipt
  requestId?:     string
}) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('receive_purchase_order', {
    p_po_id:          params.poId,
    p_lines:          params.lines,
    p_receipt_date:   params.receiptDate || undefined,
    p_transport_mode: params.transportMode,
    p_vehicle_no:     params.vehicleNo  || undefined,
    p_driver_name:    params.driverName || undefined,
    p_challan_no:     params.challanNo  || undefined,
    p_invoice_no:     params.invoiceNo  || undefined,
    p_notes:          params.notes      || undefined,
    p_request_id:     params.requestId,
  })
  if (error) throw rpcFailure(error, 'Could not record the receipt')
  return data as { id: string; receipt_no: string; po_no: string; po_status: string }
}

// ── convert_quotation_to_sales_order ──────────────────────────
// Creates the SO + lines and marks the quotation 'converted'.
// Refuses double conversion.
// allowExpired is only accepted from an admin or manager, and the database
// records the override in the approvals trail.
export async function convertQuotationToSalesOrder(quotationId: string, allowExpired = false) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('convert_quotation_to_sales_order', {
    p_allow_expired: allowExpired,
    p_quotation_id: quotationId,
  })
  if (error) throw new Error(error.message)
  return data as { success: boolean; id: string; so_number: string }
}

// ─────────────────────────────────────────────────────────────
// Production workflow RPCs (one transaction each, order row locked)
// ─────────────────────────────────────────────────────────────

// ── create_production_order ───────────────────────────────────
// Order + finished-goods line + raw-material reservations.
// materials[].qty is the TOTAL needed for this order.
export async function createProductionOrder(params: {
  finishedItemId: string
  qty:            number
  materials:      Array<{ itemId: string; qty: number }>
  targetDate?:    string
  notes?:         string
  expiryHours?:   number
  // Sent again on a retry so the database refuses a duplicate order
  requestId?:     string
}) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('create_production_order', {
    p_finished_item_id: params.finishedItemId,
    p_qty:              params.qty,
    p_materials:        params.materials.map((m) => ({ item_id: m.itemId, qty: m.qty })),
    p_target_date:      params.targetDate,
    p_notes:            params.notes,
    p_expiry_hours:     params.expiryHours ?? 168,
    p_request_id:       params.requestId,
  })
  if (error) throw rpcFailure(error, 'Could not create the production order')
  return data as { success: boolean; id: string; po_number: string; materials_reserved: number }
}

// ── start_production_order ────────────────────────────────────
// Consumes every planned raw material and moves the order to
// in_progress. Lapsed reservations are taken from available stock.
export async function startProductionOrder(productionOrderId: string) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('start_production_order', {
    p_production_order_id: productionOrderId,
  })
  if (error) throw new Error(error.message)
  return data as { success: boolean; id: string; po_number: string; materials_consumed: number }
}

// ── complete_production_order ─────────────────────────────────
// Adds only the not-yet-produced finished goods to stock and marks
// the order completed — a retry can never double-count.
export async function completeProductionOrder(productionOrderId: string) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('complete_production_order', {
    p_production_order_id: productionOrderId,
  })
  if (error) throw new Error(error.message)
  return data as { success: boolean; id: string; po_number: string; qty_produced: number }
}

// ── cancel_production_order ───────────────────────────────────
// Pending / on-hold orders only: releases reserved raw materials.
export async function cancelProductionOrder(productionOrderId: string) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('cancel_production_order', {
    p_production_order_id: productionOrderId,
  })
  if (error) throw new Error(error.message)
  return data as { success: boolean; id: string; po_number: string; reservations_released: number }
}
