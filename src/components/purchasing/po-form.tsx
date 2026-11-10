'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { GST_RATE_OPTIONS, type GstRate } from '@/lib/gst'
import { useCan } from '@/lib/hooks/use-profile'
import { useStockLevels } from '@/lib/hooks/use-stock'
import {
  useActiveSuppliers,
  useCreatePurchaseOrder,
  useIssuePurchaseOrder,
  useOpenPoQty,
  usePurchasableItems,
  useUpdatePurchaseOrder,
  type PoInput,
} from '@/lib/hooks/use-purchasing'
import { formatCurrency, formatQty, todayISO } from '@/lib/utils/format'
import { toast } from 'sonner'
import { Plus, Save, Send, Trash2 } from 'lucide-react'

// Same rounding as _write_purchase_order_lines(): per line, to the paisa
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export interface PoFormLine {
  key: string
  item_id: string
  qty: string
  rate: string
  gst_percent: GstRate
  notes: string
}

export interface PoFormValues {
  id?: string
  poNo?: string
  poDate?: string
  supplierId: string
  expectedDate: string
  terms: string
  notes: string
  lines: PoFormLine[]
}

let lineSeq = 0
export const newLineKey = () => `l${++lineSeq}`

export const emptyLine = (): PoFormLine => ({
  key: newLineKey(),
  item_id: '',
  qty: '',
  rate: '',
  gst_percent: '18',
  notes: '',
})

export function PoForm({ initial, intro }: { initial?: PoFormValues; intro?: React.ReactNode }) {
  const router = useRouter()
  const isEdit = !!initial?.id
  const canIssue = useCan('approvePurchaseOrders')

  const { data: suppliers } = useActiveSuppliers()
  const { data: items } = usePurchasableItems()
  const { data: stock } = useStockLevels()
  const { data: onOrder } = useOpenPoQty()

  const createPo = useCreatePurchaseOrder()
  const updatePo = useUpdatePurchaseOrder()
  const issuePo = useIssuePurchaseOrder()

  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? '')
  const [poDate, setPoDate] = useState(todayISO)
  const [expectedDate, setExpectedDate] = useState(initial?.expectedDate ?? '')
  const [terms, setTerms] = useState(initial?.terms ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [lines, setLines] = useState<PoFormLine[]>(initial?.lines.length ? initial.lines : [emptyLine()])
  const [busy, setBusy] = useState<'draft' | 'issue' | null>(null)
  // A draft keeps its order date; a new order uses the date entered
  const orderDate = isEdit ? (initial?.poDate ?? '') : poDate

  const itemMap = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items])
  const stockMap = useMemo(() => new Map((stock ?? []).map((s) => [s.item_id, s])), [stock])

  const computed = lines.map((l) => {
    const qty = Number(l.qty) || 0
    const rate = Number(l.rate) || 0
    const taxable = round2(qty * rate)
    const gst = round2((taxable * Number(l.gst_percent)) / 100)
    return { taxable, gst, total: taxable + gst }
  })
  const taxable = computed.reduce((s, c) => s + c.taxable, 0)
  const gstAmount = computed.reduce((s, c) => s + c.gst, 0)
  const total = taxable + gstAmount

  function updateLine(key: string, patch: Partial<PoFormLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function selectItem(key: string, itemId: string) {
    const item = itemMap.get(itemId)
    updateLine(key, {
      item_id: itemId,
      rate: item?.price?.purchase_rate != null ? String(item.price.purchase_rate) : '',
      gst_percent: (item?.price?.gst_percent ?? '18') as GstRate,
    })
  }

  function selectSupplier(id: string) {
    setSupplierId(id)
    const paymentTerms = suppliers?.find((s) => s.id === id)?.payment_terms
    if (!terms.trim() && paymentTerms) setTerms(`Payment: ${paymentTerms}`)
  }

  function validate(): PoInput | null {
    if (!supplierId) return fail('Select a supplier')
    if (!isEdit && poDate > todayISO()) return fail('Order date cannot be in the future')
    if (expectedDate && expectedDate < orderDate) return fail('Expected delivery cannot be before the order date')
    const filled = lines.filter((l) => l.item_id || l.qty || l.rate)
    if (filled.length === 0) return fail('Add at least one item')
    const seen = new Set<string>()
    for (const l of filled) {
      const name = itemMap.get(l.item_id)?.name ?? 'an item'
      if (!l.item_id) return fail('Every line needs an item')
      if (!itemMap.has(l.item_id)) return fail('An item on this order is no longer active — choose another')
      if (seen.has(l.item_id)) return fail(`${name} is on two lines — combine them`)
      seen.add(l.item_id)
      if (!(Number(l.qty) > 0)) return fail(`Enter a quantity for ${name}`)
      if (!(Number(l.rate) > 0)) return fail(`Enter a rate for ${name}`)
      if (!itemMap.get(l.item_id)?.unit_id) return fail(`${name} has no unit — set one on the item first`)
    }
    return {
      supplierId,
      expectedDate: expectedDate || undefined,
      terms: terms.trim() || undefined,
      notes: notes.trim() || undefined,
      lines: filled.map((l) => ({
        item_id: l.item_id,
        qty: Number(l.qty),
        rate: Number(l.rate),
        gst_percent: l.gst_percent,
        notes: l.notes.trim() || undefined,
      })),
    }
  }

  function fail(message: string): null {
    toast.error(message)
    return null
  }

  async function save(issue: boolean) {
    const input = validate()
    if (!input) return
    setBusy(issue ? 'issue' : 'draft')
    try {
      let id = initial?.id
      if (id) {
        await updatePo.mutateAsync({ ...input, id })
        if (issue) await issuePo.mutateAsync(id)
      } else {
        const created = await createPo.mutateAsync({ ...input, issue, poDate })
        id = created.id
      }
      router.push(`/purchase-orders/${id}` as Route)
    } catch {
      // the mutation already showed the error
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? `Edit ${initial?.poNo ?? 'purchase order'}` : 'New Purchase Order'}
        description={isEdit ? 'Drafts can be changed until they are issued' : 'Order goods from a supplier'}
      >
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button variant="outline" size="sm" loading={busy === 'draft'} disabled={busy !== null} onClick={() => save(false)}>
          <Save className="w-4 h-4" />
          {isEdit ? 'Save draft' : 'Save as draft'}
        </Button>
        {canIssue && (
          <Button size="sm" loading={busy === 'issue'} disabled={busy !== null} onClick={() => save(true)}>
            <Send className="w-4 h-4" />
            Save &amp; issue
          </Button>
        )}
      </PageHeader>

      {intro}
      {!canIssue && (
        <p className="mb-4 text-sm text-slate-500">
          You can save this as a draft; a manager or admin issues it to the supplier.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-900 text-sm">Order details</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Supplier <span className="text-red-500">*</span>
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => selectSupplier(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select supplier…</option>
                  {suppliers?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              {!isEdit && (
                <Input
                  label="Order date"
                  type="date"
                  max={todayISO()}
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                />
              )}
              <Input
                label="Expected delivery"
                type="date"
                min={orderDate || undefined}
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
              <Textarea
                label="Terms"
                placeholder="Payment, delivery and quality terms printed on the order"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={3}
              />
              <Textarea
                label="Internal notes"
                placeholder="Not printed"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Taxable value</span>
                <span className="tabular-nums">{formatCurrency(taxable)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>GST</span>
                <span className="tabular-nums">{formatCurrency(gstAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                <span>Order total</span>
                <span className="tabular-nums">{formatCurrency(total)}</span>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 text-sm">Items</h3>
                <Button variant="outline" size="sm" onClick={() => setLines((p) => [...p, emptyLine()])}>
                  <Plus className="w-3.5 h-3.5" />
                  Add item
                </Button>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500">
                      <th className="text-left px-3 py-2.5">Item</th>
                      <th className="text-right px-3 py-2.5 w-24">Qty</th>
                      <th className="text-right px-3 py-2.5 w-28">Rate (₹)</th>
                      <th className="text-center px-3 py-2.5 w-20">GST</th>
                      <th className="text-right px-3 py-2.5 w-28">Amount</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {lines.map((line, i) => {
                      const item = itemMap.get(line.item_id)
                      const st = stockMap.get(line.item_id)
                      const due = onOrder?.get(line.item_id) ?? 0
                      return (
                        <tr key={line.key} className="align-top">
                          <td className="px-3 py-2">
                            <select
                              value={line.item_id}
                              onChange={(e) => selectItem(line.key, e.target.value)}
                              className="w-full min-w-[220px] px-2 py-1.5 text-xs rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                            >
                              <option value="">Select item…</option>
                              {items?.map((it) => (
                                <option key={it.id} value={it.id}>
                                  [{it.item_code}] {it.name}
                                </option>
                              ))}
                            </select>
                            {item && (
                              <div className="mt-1 text-[11px] text-slate-400">
                                In stock {formatQty(st?.qty_available ?? 0, item.unit?.name)}
                                {st?.reorder_level ? ` · reorder at ${formatQty(st.reorder_level)}` : ''}
                                {due > 0 ? ` · ${formatQty(due)} already on order` : ''}
                              </div>
                            )}
                            <input
                              type="text"
                              placeholder="Line note (optional)"
                              value={line.notes}
                              onChange={(e) => updateLine(line.key, { notes: e.target.value })}
                              className="mt-1 w-full px-2 py-1 text-xs rounded border border-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={line.qty}
                              onChange={(e) => updateLine(line.key, { qty: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs rounded border border-slate-200 text-right focus:outline-none focus:ring-1 focus:ring-teal-500"
                            />
                            <div className="mt-1 text-[11px] text-slate-400 text-right">{item?.unit?.name ?? ''}</div>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={line.rate}
                              onChange={(e) => updateLine(line.key, { rate: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs rounded border border-slate-200 text-right focus:outline-none focus:ring-1 focus:ring-teal-500"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={line.gst_percent}
                              onChange={(e) => updateLine(line.key, { gst_percent: e.target.value as GstRate })}
                              className="w-full px-1.5 py-1.5 text-xs rounded border border-slate-200 text-center focus:outline-none focus:ring-1 focus:ring-teal-500"
                            >
                              {GST_RATE_OPTIONS.map((r) => (
                                <option key={r.value} value={r.value}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            <div className="text-xs font-semibold text-slate-900">{formatCurrency(computed[i].taxable)}</div>
                            <div className="text-[11px] text-slate-400">+{formatCurrency(computed[i].gst)} GST</div>
                          </td>
                          <td className="px-2 py-2">
                            {lines.length > 1 && (
                              <button
                                type="button"
                                aria-label="Remove line"
                                onClick={() => setLines((p) => p.filter((l) => l.key !== line.key))}
                                className="p-1 text-slate-300 hover:text-red-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
