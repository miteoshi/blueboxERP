'use client'

import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import { RequirePermission } from '@/components/auth/require-permission'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { PageLoader } from '@/components/ui/spinner'
import { GST_RATE_OPTIONS, type GstRate } from '@/lib/gst'
import { useActiveSuppliers } from '@/lib/hooks/use-purchasing'
import { useCreateSupplierBill, useUnbilledGrnLines } from '@/lib/hooks/use-payables'
import { formatCurrency, formatDate, formatQty, todayISO } from '@/lib/utils/format'
import { toast } from 'sonner'
import { Save } from 'lucide-react'

// Same rounding as create_supplier_bill(): per line, to the paisa
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

interface LineEdit {
  selected: boolean
  qty: string
  rate: string
  gst: GstRate
}

export default function NewSupplierBillPage() {
  return (
    <RequirePermission permission="managePayables">
      <Suspense fallback={<PageLoader />}>
        <NewSupplierBill />
      </Suspense>
    </RequirePermission>
  )
}

function NewSupplierBill() {
  const router = useRouter()
  const params = useSearchParams()
  const grnParam = params.get('grn')

  const { data: suppliers } = useActiveSuppliers()
  const [supplierId, setSupplierId] = useState(params.get('supplier') ?? '')
  const { data: grns, isLoading } = useUnbilledGrnLines(supplierId || null)
  const createBill = useCreateSupplierBill()

  const [invoiceNo, setInvoiceNo] = useState('')
  const [billDate, setBillDate] = useState(todayISO)
  const [dueDate, setDueDate] = useState<string | null>(null) // null = follow the supplier's credit days
  const [invoiceTotal, setInvoiceTotal] = useState('')
  const [notes, setNotes] = useState('')
  const [edits, setEdits] = useState<Record<string, LineEdit>>({})

  const supplier = suppliers?.find((s) => s.id === supplierId)
  const creditDays = supplier?.credit_days ?? 30
  const due = dueDate ?? addDays(billDate, creditDays)

  // A line's state: what the user changed, else its defaults (everything
  // unbilled, at the GRN rate; pre-selected when arriving from that GRN)
  const rows = useMemo(
    () =>
      (grns ?? []).flatMap((g) =>
        g.inbound_receipt_lines.map((l) => {
          const remaining = Number(l.qty_received) - Number(l.qty_billed)
          const edit = edits[l.id] ?? {
            selected: g.id === grnParam,
            qty: String(remaining),
            rate: String(l.rate),
            gst: l.gst_percent,
          }
          const taxable = round2((Number(edit.qty) || 0) * (Number(edit.rate) || 0))
          const gst = round2((taxable * Number(edit.gst)) / 100)
          return { grn: g, line: l, remaining, edit, taxable, gst }
        }),
      ),
    [grns, edits, grnParam],
  )

  const selected = rows.filter((r) => r.edit.selected)
  const taxable = selected.reduce((s, r) => s + r.taxable, 0)
  const gstAmount = selected.reduce((s, r) => s + r.gst, 0)
  const computed = round2(taxable + gstAmount)
  const entered = invoiceTotal === '' ? null : Number(invoiceTotal)
  const difference = entered === null ? 0 : round2(entered - computed)
  const mismatch = Math.abs(difference) > 1

  function patch(id: string, current: LineEdit, change: Partial<LineEdit>) {
    setEdits((prev) => ({ ...prev, [id]: { ...current, ...change } }))
  }

  function chooseSupplier(id: string) {
    setSupplierId(id)
    setEdits({})
  }

  function save() {
    if (!supplierId) return toast.error('Select a supplier')
    if (!invoiceNo.trim()) return toast.error("Enter the supplier's invoice number")
    if (!billDate) return toast.error('Enter the invoice date')
    if (billDate > todayISO()) return toast.error('Invoice date cannot be in the future')
    if (due < billDate) return toast.error('Due date cannot be before the invoice date')
    if (selected.length === 0) return toast.error('Tick the received items this invoice covers')
    for (const r of selected) {
      const name = r.line.item?.name ?? 'an item'
      if (!(Number(r.edit.qty) > 0)) return toast.error(`Enter a quantity for ${name}`)
      if (Number(r.edit.qty) > r.remaining + 1e-6) {
        return toast.error(`Only ${formatQty(r.remaining, r.line.unit?.name)} of ${name} on ${r.grn.receipt_no} is unbilled`)
      }
      if (!(Number(r.edit.rate) >= 0) || r.edit.rate === '') return toast.error(`Enter a rate for ${name}`)
    }
    if (entered !== null && mismatch) {
      return toast.error(`The invoice total is ${formatCurrency(Math.abs(difference))} ${difference > 0 ? 'more' : 'less'} than the items add up to`)
    }
    createBill.mutate(
      {
        supplierId,
        supplierInvoiceNo: invoiceNo.trim(),
        billDate,
        dueDate: due,
        invoiceTotal: entered ?? undefined,
        notes: notes.trim(),
        lines: selected.map((r) => ({
          grn_line_id: r.line.id,
          qty: Number(r.edit.qty),
          rate: Number(r.edit.rate),
          gst_percent: r.edit.gst,
        })),
      },
      { onSuccess: (data) => router.push(`/supplier-bills/${data.id}` as Route) },
    )
  }

  return (
    <div>
      <PageHeader title="Enter Supplier Bill" description="Record a supplier's invoice against the goods received">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button size="sm" loading={createBill.isPending} onClick={save}>
          <Save className="w-4 h-4" />
          Save bill
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-900 text-sm">Supplier&apos;s invoice</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Supplier <span className="text-red-500">*</span>
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => chooseSupplier(e.target.value)}
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
              <Input
                label="Supplier invoice no."
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="As printed on their invoice"
              />
              <Input label="Invoice date" type="date" max={todayISO()} value={billDate} onChange={(e) => setBillDate(e.target.value)} />
              <div>
                <Input label="Due date" type="date" min={billDate} value={due} onChange={(e) => setDueDate(e.target.value)} />
                <p className="mt-1 text-xs text-slate-500">
                  {dueDate === null ? `${creditDays} days' credit from this supplier` : 'Set by you'}
                  {dueDate !== null && (
                    <button type="button" className="ml-2 text-blue-600 hover:underline" onClick={() => setDueDate(null)}>
                      Use {creditDays} days
                    </button>
                  )}
                </p>
              </div>
              <div>
                <Input
                  label="Invoice total (₹)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={invoiceTotal}
                  onChange={(e) => setInvoiceTotal(e.target.value)}
                  placeholder="Grand total on their invoice"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Checked against the items you tick. Differences up to ₹1 are kept as round-off.
                </p>
              </div>
              <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </CardBody>
          </Card>

          <Card className={entered !== null && mismatch ? 'border-red-300' : ''}>
            <CardBody className="space-y-2 text-sm">
              <Row label="Taxable value" value={taxable} />
              <Row label="GST" value={gstAmount} />
              {entered !== null && !mismatch && difference !== 0 && <Row label="Round-off" value={difference} />}
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                <span>Bill total</span>
                <span className="tabular-nums">{formatCurrency(entered !== null && !mismatch ? entered : computed)}</span>
              </div>
              {entered !== null && mismatch && (
                <p className="text-xs text-red-600">
                  Their invoice says {formatCurrency(entered)} — {formatCurrency(Math.abs(difference))}{' '}
                  {difference > 0 ? 'more' : 'less'} than the items add up to. Check the quantities, rates and GST.
                </p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-900 text-sm">Goods received, not yet billed</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tick what this invoice covers. Change the rate if the supplier charged differently from the GRN.
              </p>
            </CardHeader>
            <CardBody className="p-0">
              {!supplierId ? (
                <p className="px-5 py-10 text-sm text-slate-400 text-center">Select a supplier to see what has been received.</p>
              ) : isLoading ? (
                <PageLoader />
              ) : rows.length === 0 ? (
                <p className="px-5 py-10 text-sm text-slate-400 text-center">
                  Everything received from {supplier?.name ?? 'this supplier'} has been billed.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500">
                        <th className="w-8 px-3 py-2.5" />
                        <th className="text-left px-3 py-2.5">Item</th>
                        <th className="text-right px-3 py-2.5 w-28">Qty</th>
                        <th className="text-right px-3 py-2.5 w-28">Rate (₹)</th>
                        <th className="text-center px-3 py-2.5 w-20">GST</th>
                        <th className="text-right px-3 py-2.5 w-28">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {rows.map((r) => {
                        const rateChanged = r.edit.selected && Number(r.edit.rate) !== Number(r.line.rate)
                        return (
                          <tr key={r.line.id} className={`align-top ${r.edit.selected ? 'bg-teal-50/40' : ''}`}>
                            <td className="px-3 py-2.5">
                              <input
                                type="checkbox"
                                aria-label={`Bill ${r.line.item?.name ?? 'item'}`}
                                checked={r.edit.selected}
                                onChange={(e) => patch(r.line.id, r.edit, { selected: e.target.checked })}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-900">{r.line.item?.name}</div>
                              <div className="text-xs text-slate-400">
                                <span className="font-mono">{r.grn.receipt_no}</span> · {formatDate(r.grn.receipt_date)}
                                {r.grn.po ? ` · ${r.grn.po.po_no}` : ''}
                                {r.grn.invoice_no ? ` · inv ${r.grn.invoice_no}` : ''}
                              </div>
                              <div className="text-xs text-slate-400">{formatQty(r.remaining, r.line.unit?.name)} unbilled</div>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                max={r.remaining}
                                step="any"
                                disabled={!r.edit.selected}
                                value={r.edit.qty}
                                onChange={(e) => patch(r.line.id, r.edit, { qty: e.target.value })}
                                className="w-full px-2 py-1.5 text-xs rounded border border-slate-200 text-right disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                disabled={!r.edit.selected}
                                value={r.edit.rate}
                                onChange={(e) => patch(r.line.id, r.edit, { rate: e.target.value })}
                                className="w-full px-2 py-1.5 text-xs rounded border border-slate-200 text-right disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                              />
                              {rateChanged && (
                                <div className="mt-1 text-[11px] text-amber-700 text-right">GRN rate {formatCurrency(r.line.rate)}</div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                disabled={!r.edit.selected}
                                value={r.edit.gst}
                                onChange={(e) => patch(r.line.id, r.edit, { gst: e.target.value as GstRate })}
                                className="w-full px-1.5 py-1.5 text-xs rounded border border-slate-200 text-center disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                              >
                                {GST_RATE_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {r.edit.selected ? (
                                <>
                                  <div className="text-xs font-semibold text-slate-900">{formatCurrency(r.taxable)}</div>
                                  <div className="text-[11px] text-slate-400">+{formatCurrency(r.gst)} GST</div>
                                </>
                              ) : (
                                <span className="text-xs text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <span className="tabular-nums">{formatCurrency(value)}</span>
    </div>
  )
}
