'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useParams } from 'next/navigation'
import { RequirePermission } from '@/components/auth/require-permission'
import { PoForm, emptyLine } from '@/components/purchasing/po-form'
import { PageLoader } from '@/components/ui/spinner'
import { usePurchaseOrder } from '@/lib/hooks/use-purchasing'

export default function EditPurchaseOrderPage() {
  return (
    <RequirePermission permission="draftPurchaseOrders">
      <EditPurchaseOrder />
    </RequirePermission>
  )
}

function EditPurchaseOrder() {
  const { id } = useParams<{ id: string }>()
  const { data: po, isLoading } = usePurchaseOrder(id)

  if (isLoading) return <PageLoader />
  if (!po) return <p className="text-sm text-slate-500">Purchase order not found.</p>
  if (po.status !== 'draft') {
    return (
      <p className="text-sm text-slate-500">
        {po.po_no} has been issued and can no longer be edited.{' '}
        <Link href={`/purchase-orders/${po.id}` as Route} className="text-blue-600 hover:underline">
          Back to the order
        </Link>
      </p>
    )
  }

  const lines = [...po.purchase_order_lines]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((l) => ({
      ...emptyLine(),
      item_id: l.item_id,
      qty: String(l.qty),
      rate: String(l.rate),
      gst_percent: l.gst_percent,
      notes: l.notes ?? '',
    }))

  return (
    <PoForm
      key={po.updated_at}
      initial={{
        id: po.id,
        poNo: po.po_no,
        poDate: po.po_date,
        supplierId: po.supplier_id,
        expectedDate: po.expected_date ?? '',
        terms: po.terms ?? '',
        notes: po.notes ?? '',
        lines,
      }}
    />
  )
}
