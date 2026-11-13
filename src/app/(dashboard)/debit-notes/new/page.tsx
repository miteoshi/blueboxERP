'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useRouter, useSearchParams } from 'next/navigation'
import { RequirePermission } from '@/components/auth/require-permission'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { PageLoader } from '@/components/ui/spinner'
import {
  DEBIT_NOTE_REASONS,
  useCreateDebitNote,
  useSupplierBill,
  useSupplierBills,
  type DebitNoteReason,
} from '@/lib/hooks/use-payables'
import { useStockLevels } from '@/lib/hooks/use-stock'
import { formatCurrency, formatDate, formatQty, todayISO } from '@/lib/utils/format'
import { toast } from 'sonner'
import { Save } from 'lucide-react'

// Same rounding as create_debit_note(): per line, to the paisa
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

interface LineEdit {
  selected: boolean
  qty: string
  amount: string
}

export default function NewDebitNotePage() {
  return (
    <RequirePermission permission="managePayables">
      <Suspense fallback={<PageLoader />}>
        <NewDebitNote />
      </Suspense>
    </RequirePermission>
  )
}

function NewDebitNote() {
  const router = useRouter()
  const params = useSearchParams()
  const { data: bills } = useSupplierBills()
  const [billId, setBillId] = useState(params.get('bill') ?? '')
  const { data: bill, isLoading } = useSupplierBill(billId || null)
  const { data: stock } = useStockLevels()
  const createNote = useCreateDebitNote()

  const [reason, setReason] = useState<DebitNoteReason>('purchase_return')
  const [returnStock, setReturnStock] = useState(true)
  const [noteDate, setNoteDate] = useState(todayISO)
  const [notes, setNotes] = useState('')
  const [edits, setEdits] = useState<Record<string, LineEdit>>({})

  const isReturn = reason === 'purchase_return'
  const openBills = useMemo(() => (bills ?? []).filter((b) => b.status === 'posted'), [bills])
  const stockMap = useMemo(() => new Map((stock ?? []).map((s) => [s.item_id, s])), [stock])

  // What earlier issued notes already took off each line
  const spent = useMemo(() => {
    const map = new Map<string, { qty: number; amount: number }>()
    for (const n of bill?.debit_notes ?? []) {
      if (n.status !== 'issued') continue
      for (const l of n.debit_note_lines ?? []) {
        const row = map.get(l.bill_line_id) ?? { qty: 0, amount: 0 }
        row.qty = round2(row.qty + Number(l.qty ?? 0))
        row.amount = round2(row.amount + Number(l.taxable_value))
        map.set(l.bill_line_id, row)
      }
    }
    return map
  }, [bill])

  const rows = useMemo(
    () =>
      [...(bill?.supplier_bill_lines ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((l) => {
          const used = spent.get(l.id) ?? { qty: 0, amount: 0 }
          const leftQty = round2(Number(l.qty) - used.qty)
          const leftAmount = round2(Number(l.taxable_value) - used.amount)
          const edit = edits[l.id] ?? { selected: false, qty: '', amount: '' }
          const taxable = isReturn
            ? round2((Number(edit.qty) || 0) * Number(l.rate))
            : round2(Number(edit.amount) || 0)
          const gst = round2((taxable * Number(l.gst_percent)) / 100)
          return { line: l, used, leftQty, leftAmount, edit, taxable, gst }
        })
        .filter((r) => r.leftAmount > 0.005),
    [bill, edits, isReturn, spent],
  )

  const selected = rows.filter((r) => r.edit.selected)
  const taxable = selected.reduce((s, r) => s + r.taxable, 0)
  const gstAmount = selected.reduce((s, r) => s + r.gst, 0)
  const total = Math.round(taxable + gstAmount)
  const roundOff = round2(total - (taxable + gstAmount))

  function patch(id: string, current: LineEdit, change: Partial<LineEdit>) {
    setEdits((prev) => ({ ...prev, [id]: { ...current, ...change } }))
  }

  function chooseBill(id: string) {
    setBillId(id)
    setEdits({})
  }

  function chooseReason(next: DebitNoteReason) {
    setReason(next)
    setReturnStock(next === 'purchase_return')
    setEdits({})
  }

  function save() {
    if (!bill) return toast.error('Select a bill')
    if (noteDate > todayISO()) return toast.error('Debit note date cannot be in the future')
    if (noteDate < bill.bill_date) return toast.error(`Date cannot be before the bill date (${formatDate(bill.bill_date)})`)
    if (selected.length === 0) return toast.error(isReturn ? 'Tick what you are returning' : 'Tick the lines to debit')
    for (const r of selected) {
      const name = r.line.item?.name ?? 'an item'
      if (isReturn) {
        if (!(Number(r.edit.qty) > 0)) return toast.error(`Enter the quantity returned for ${name}`)
        if (Number(r.edit.qty) > r.leftQty + 1e-6) {
          return toast.error(`Only ${formatQty(r.leftQty, r.line.unit?.name)} of ${name} can still be returned`)
        }
        if (returnStock) {
          const available = stockMap.get(r.line.item_id)?.qty_available ?? 0
          if (Number(r.edit.qty) > available + 1e-6) {
            return toast.error(`Only ${formatQty(available, r.line.unit?.name)} of ${name} is in stock to send back`)
          }
        }
      } else {
        if (!(Number(r.edit.amount) > 0)) return toast.error(`Enter the amount to debit for ${name}`)
        if (Number(r.edit.amount) > r.leftAmount + 0.005) {
          return toast.error(`Only ${formatCurrency(r.leftAmount)} is left to debit on ${name}`)
        }
      }
    }
    createNote.mutate(
      {
        billId: bill.id,
        reason,
        returnStock: isReturn && returnStock,
        noteDate,
        notes: notes.trim(),
        lines: selected.map((r) =>
          isReturn
            ? { bill_line_id: r.line.id, qty: Number(r.edit.qty) }
            : { bill_line_id: r.line.id, taxable_value: Number(r.edit.amount) },
        ),
      },
      { onSuccess: (data) => router.push(`/debit-notes/${data.id}` as Route) },
    )
  }

  const reasonHint = DEBIT_NOTE_REASONS.find((r) => r.value === reason)?.hint

  return (
    <div>
      <PageHeader title="Raise Debit Note" description="Reduce what you owe a supplier, and reverse the input GST on it">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button size="sm" loading={createNote.isPending} onClick={save}>
          <Save className="w-4 h-4" />
          Raise note
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-900 text-sm">Against which bill</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Supplier bill <span className="text-red-500">*</span>
                </label>
                <select
                  value={billId}
                  onChange={(e) => chooseBill(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select bill…</option>
                  {openBills.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bill_no} · {b.supplier?.name} · inv {b.supplier_invoice_no}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Reason</label>
                <select
                  value={reason}
                  onChange={(e) => chooseReason(e.target.value as DebitNoteReason)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DEBIT_NOTE_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                {reasonHint && <p className="mt-1 text-xs text-slate-500">{reasonHint}</p>}
              </div>

              {isReturn && (
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={returnStock}
                    onChange={(e) => setReturnStock(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                  />
                  <span>
                    Take the goods out of stock
                    <span className="block text-xs text-slate-500">
                      Leave this off if the goods have already left or were never received.
                    </span>
                  </span>
                </label>
              )}

              <Input
                label="Debit note date"
                type="date"
                min={bill?.bill_date}
                max={todayISO()}
                value={noteDate}
                onChange={(e) => setNoteDate(e.target.value)}
              />
              <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </CardBody>
          </Card>

          {bill && (
            <Card>
              <CardBody className="space-y-2 text-sm">
                <Row label="Taxable value" value={taxable} />
                <Row label="GST reversed" value={gstAmount} />
                {roundOff !== 0 && <Row label="Round-off" value={roundOff} />}
                <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                  <span>Debit note total</span>
                  <span className="tabular-nums">{formatCurrency(total)}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {bill.bill_no} owes {formatCurrency(bill.balance_due ?? 0)} now; it will be{' '}
                  {formatCurrency(Math.max((bill.balance_due ?? 0) - total, 0))} after this.
                  {(bill.balance_due ?? 0) < total &&
                    ' Anything beyond the balance comes back off the payments already made and becomes an advance.'}
                </p>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-900 text-sm">{isReturn ? 'What is going back' : 'What to debit'}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isReturn
                  ? 'Tick an item and enter the quantity returned. The rate comes from the bill.'
                  : 'Tick an item and enter the taxable amount to take off that line. GST follows the line.'}
              </p>
            </CardHeader>
            <CardBody className="p-0">
              {!billId ? (
                <p className="px-5 py-10 text-sm text-slate-400 text-center">Select a bill to see its items.</p>
              ) : isLoading ? (
                <PageLoader />
              ) : !bill ? (
                <p className="px-5 py-10 text-sm text-slate-400 text-center">Bill not found.</p>
              ) : rows.length === 0 ? (
                <p className="px-5 py-10 text-sm text-slate-400 text-center">
                  Every line on {bill.bill_no} has already been debited in full.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500">
                        <th className="w-8 px-3 py-2.5" />
                        <th className="text-left px-3 py-2.5">Item</th>
                        <th className="text-right px-3 py-2.5 w-28">Still on the bill</th>
                        <th className="text-right px-3 py-2.5 w-32">{isReturn ? 'Returning' : 'Debit (₹)'}</th>
                        <th className="text-right px-3 py-2.5 w-28">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {rows.map((r) => {
                        const available = stockMap.get(r.line.item_id)?.qty_available ?? 0
                        const short = isReturn && returnStock && Number(r.edit.qty) > available + 1e-6
                        return (
                          <tr key={r.line.id} className={`align-top ${r.edit.selected ? 'bg-teal-50/40' : ''}`}>
                            <td className="px-3 py-2.5">
                              <input
                                type="checkbox"
                                aria-label={`Debit ${r.line.item?.name ?? 'item'}`}
                                checked={r.edit.selected}
                                onChange={(e) => patch(r.line.id, r.edit, { selected: e.target.checked })}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-900">{r.line.item?.name}</div>
                              <div className="text-xs text-slate-400 font-mono">{r.line.item?.item_code}</div>
                              {isReturn && returnStock && (
                                <div className={`text-xs ${short ? 'text-red-600' : 'text-slate-400'}`}>
                                  {formatQty(available, r.line.unit?.name)} in stock
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                              {formatQty(r.leftQty, r.line.unit?.name)}
                              <div className="text-xs text-slate-400">
                                {formatCurrency(r.leftAmount)} @ {formatCurrency(r.line.rate)}
                              </div>
                              {(r.used.qty > 0 || r.used.amount > 0) && (
                                <div className="text-[11px] text-amber-700">
                                  {formatCurrency(r.used.amount)} already debited
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                max={isReturn ? r.leftQty : r.leftAmount}
                                disabled={!r.edit.selected}
                                value={isReturn ? r.edit.qty : r.edit.amount}
                                onChange={(e) =>
                                  patch(r.line.id, r.edit, isReturn ? { qty: e.target.value } : { amount: e.target.value })
                                }
                                className={`w-full px-2 py-1.5 text-xs rounded border text-right disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 ${
                                  short ? 'border-red-300' : 'border-slate-200'
                                }`}
                              />
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
                  {(bill.debit_notes ?? []).some((n) => n.status === 'issued') && (
                    <p className="px-5 py-3 text-xs text-slate-500 border-t border-slate-100">
                      This bill already has{' '}
                      {(bill.debit_notes ?? [])
                        .filter((n) => n.status === 'issued')
                        .map((n) => n.debit_note_no)
                        .join(', ')}
                      . A line can only be debited for what is left on it.{' '}
                      <Link href={`/supplier-bills/${bill.id}` as Route} className="text-blue-600 hover:underline">
                        See the bill
                      </Link>
                    </p>
                  )}
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
