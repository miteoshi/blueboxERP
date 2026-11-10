'use client'

import { Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { RequirePermission } from '@/components/auth/require-permission'
import { PoForm, emptyLine, type PoFormLine } from '@/components/purchasing/po-form'
import { PageLoader } from '@/components/ui/spinner'
import { useReorderAlerts } from '@/lib/hooks/use-stock'
import { useOpenPoQty, usePurchasableItems } from '@/lib/hooks/use-purchasing'
import type { GstRate } from '@/lib/gst'

export default function NewPurchaseOrderPage() {
  return (
    <RequirePermission permission="draftPurchaseOrders">
      <Suspense fallback={<PageLoader />}>
        <NewPurchaseOrder />
      </Suspense>
    </RequirePermission>
  )
}

function NewPurchaseOrder() {
  const params = useSearchParams()
  const fromLowStock = params.get('from') === 'low-stock'
  const itemParam = params.get('item')

  const { data: items, isPending: itemsPending } = usePurchasableItems()
  const { data: alerts, isPending: alertsPending } = useReorderAlerts()
  const { data: onOrder, isPending: onOrderPending } = useOpenPoQty()

  const ready = !(fromLowStock || itemParam) || (!itemsPending && !alertsPending && !onOrderPending)

  // Lines suggested from low stock: enough to bring each item back up to its
  // reorder level, after what is already on order
  const prefill = useMemo(() => {
    if (!ready || !items) return { lines: [] as PoFormLine[], madeInHouse: 0, covered: 0 }
    const byId = new Map(items.map((i) => [i.id, i]))
    const lineFor = (itemId: string, qty: number): PoFormLine | null => {
      const item = byId.get(itemId)
      if (!item) return null
      return {
        ...emptyLine(),
        item_id: item.id,
        qty: qty > 0 ? String(qty) : '',
        rate: item.price?.purchase_rate != null ? String(item.price.purchase_rate) : '',
        gst_percent: (item.price?.gst_percent ?? '18') as GstRate,
      }
    }
    if (itemParam) {
      const line = lineFor(itemParam, 0)
      return { lines: line ? [line] : [], madeInHouse: 0, covered: 0 }
    }
    const lines: PoFormLine[] = []
    let madeInHouse = 0
    let covered = 0
    for (const a of alerts ?? []) {
      if (!a.item_id) continue
      if (!byId.has(a.item_id)) {
        madeInHouse++
        continue
      }
      const shortfall = Number(a.reorder_level ?? 0) - Number(a.qty_available ?? 0) - (onOrder?.get(a.item_id) ?? 0)
      if (shortfall <= 0) {
        covered++
        continue
      }
      const line = lineFor(a.item_id, Math.ceil(shortfall * 100) / 100)
      if (line) lines.push(line)
    }
    return { lines, madeInHouse, covered }
  }, [ready, items, alerts, onOrder, itemParam])

  if (!ready) return <PageLoader />

  const intro = fromLowStock ? (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      {prefill.lines.length > 0
        ? `${prefill.lines.length} low-stock item${prefill.lines.length === 1 ? '' : 's'} added, with enough to bring stock back to the reorder level. Adjust quantities and remove what this supplier doesn't sell.`
        : 'No bought-in items need ordering.'}
      {prefill.covered > 0 && ` ${prefill.covered} more ${prefill.covered === 1 ? 'is' : 'are'} already covered by open orders.`}
      {prefill.madeInHouse > 0 &&
        ` ${prefill.madeInHouse} low-stock item${prefill.madeInHouse === 1 ? ' is' : 's are'} made in-house — plan ${prefill.madeInHouse === 1 ? 'it' : 'them'} in Production.`}
    </div>
  ) : undefined

  return (
    <PoForm
      initial={
        prefill.lines.length
          ? { supplierId: '', expectedDate: '', terms: '', notes: '', lines: prefill.lines }
          : undefined
      }
      intro={intro}
    />
  )
}
