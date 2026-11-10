'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { PageLoader } from '@/components/ui/spinner'
import {
  CREDIT_NOTE_REASONS,
  creditNoteDeadline,
  useCreateCreditNote,
  useInvoice,
  useInvoices,
  type CreditNoteLineInput,
  type CreditNoteReason,
} from '@/lib/hooks/use-finance'
import { useCanManageFinance } from '@/lib/hooks/use-profile'
import { formatCurrency, formatDate, formatQty, todayISO } from '@/lib/utils/format'
import { amountInWords } from '@/lib/gst'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft, FileMinus } from 'lucide-react'

// Same rounding as create_credit_note(): per line, to the paisa
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export default function NewCreditNotePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <NewCreditNote />
    </Suspense>
  )
}

function NewCreditNote() {
  const router = useRouter()
  const params = useSearchParams()
  const canManage = useCanManageFinance()
  const [invoiceId, setInvoiceId] = useState(params.get('invoice') ?? '')

  const { data: invoices, isLoading: loadingInvoices } = useInvoices({ status: 'issued' })
  const { data: inv, isLoading: loadingInvoice } = useInvoice(invoiceId || null)
  const createNote = useCreateCreditNote()

  const [reason, setReason] = useState<CreditNoteReason>('sales_return')
  const [restock, setRestock] = useState(true)
  const [noteDate, setNoteDate] = useState(todayISO)
  const [notes, setNotes] = useState('')
  // Per invoice line: quantity (returns) or taxable value (other reasons), as typed
  const [entries, setEntries] = useState<Record<string, string>>({})

  const isReturn = reason === 'sales_return'

  // What is still open on each invoice line after earlier (uncancelled) credit notes
  const lines = useMemo(() => {
    if (!inv) return []
    const done = new Map<string, { qty: number; value: number }>()
    for (const n of inv.credit_notes) {
      if (n.status !== 'issued') continue
      for (const l of n.credit_note_lines) {
        const d = done.get(l.invoice_line_id) ?? { qty: 0, value: 0 }
        d.qty += l.qty ?? 0
        d.value += l.taxable_value
        done.set(l.invoice_line_id, d)
      }
    }
    return [...inv.sales_invoice_lines]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((l) => {
        const d = done.get(l.id) ?? { qty: 0, value: 0 }
        return { ...l, qtyLeft: Math.max(l.qty - d.qty, 0), valueLeft: round2(Math.max(l.taxable_value - d.value, 0)) }
      })
  }, [inv])

  const preview = useMemo(() => {
    if (!inv) return null
    const rows: { id: string; description: string; taxable: number; cgst: number; sgst: number; igst: number; error?: string }[] = []
    for (const l of lines) {
      const raw = (entries[l.id] ?? '').trim()
      if (!raw) continue
      const n = Number(raw)
      if (!(n > 0)) {
        rows.push({ id: l.id, description: l.description, taxable: 0, cgst: 0, sgst: 0, igst: 0, error: 'Enter a positive number' })
        continue
      }
      let error: string | undefined
      let taxable: number
      if (isReturn) {
        taxable = round2(n * l.rate)
        if (n > l.qtyLeft + 0.00001) error = `Only ${formatQty(l.qtyLeft, l.unit_name)} can still be returned`
      } else {
        taxable = round2(n)
      }
      if (!error && taxable > l.valueLeft + 0.005) error = `Only ${formatCurrency(l.valueLeft)} of value is left on this line`
      const half = inv.is_interstate ? 0 : round2((taxable * l.gst_rate) / 200)
      rows.push({
        id: l.id,
        description: l.description,
        taxable,
        cgst: half,
        sgst: half,
        igst: inv.is_interstate ? round2((taxable * l.gst_rate) / 100) : 0,
        error,
      })
    }
    const taxable = round2(rows.reduce((s, r) => s + r.taxable, 0))
    const cgst = round2(rows.reduce((s, r) => s + r.cgst, 0))
    const sgst = round2(rows.reduce((s, r) => s + r.sgst, 0))
    const igst = round2(rows.reduce((s, r) => s + r.igst, 0))
    const exact = round2(taxable + cgst + sgst + igst)
    const room = round2(inv.total_amount - inv.amount_credited)
    let total = Math.round(exact)
    if (total > room && total - room <= 1) total = room
    return { rows, taxable, cgst, sgst, igst, total, roundOff: round2(total - exact), room, overRoom: total > room }
  }, [inv, lines, entries, isReturn])

  if (!canManage) {
    return <p className="text-sm text-slate-500">Only an admin or manager can issue credit notes.</p>
  }
  if (loadingInvoices || (invoiceId && loadingInvoice)) return <PageLoader />

  const deadline = inv ? creditNoteDeadline(inv.invoice_date) : null
  const maxDate = deadline && deadline < todayISO() ? deadline : todayISO()
  const blockers: string[] = []
  if (inv) {
    if (inv.status !== 'issued') blockers.push('This invoice is cancelled.')
    if (deadline && todayISO() > deadline)
      blockers.push(`The last date for a credit note against this invoice was ${formatDate(deadline)} (CGST Act s.34).`)
    if (inv.total_amount - inv.amount_credited <= 0) blockers.push('This invoice has already been fully credited.')
  }
  const lineErrors = preview?.rows.filter((r) => r.error) ?? []
  const canSave =
    !!inv && blockers.length === 0 && !!preview && preview.rows.length > 0 && lineErrors.length === 0 && !preview.overRoom

  function changeReason(next: CreditNoteReason) {
    setReason(next)
    setEntries({})
    setRestock(next === 'sales_return')
  }

  function fillAll() {
    const next: Record<string, string> = {}
    for (const l of lines) {
      if (isReturn) {
        if (l.qtyLeft > 0) next[l.id] = String(l.qtyLeft)
      } else if (l.valueLeft > 0) {
        next[l.id] = l.valueLeft.toFixed(2)
      }
    }
    setEntries(next)
  }

  async function save() {
    if (!inv || !preview || !canSave) return
    const payload: CreditNoteLineInput[] = preview.rows.map((r) => {
      const n = Number(entries[r.id])
      return isReturn ? { invoice_line_id: r.id, qty: n } : { invoice_line_id: r.id, taxable_value: round2(n) }
    })
    try {
      const res = await createNote.mutateAsync({
        invoiceId: inv.id,
        reason,
        lines: payload,
        restock: isReturn && restock,
        noteDate,
        notes: notes.trim() || undefined,
      })
      toast.success(
        res.payment_released > 0
          ? `${res.credit_note_no} issued — ${formatCurrency(res.payment_released)} of payment is now on-account credit`
          : `${res.credit_note_no} issued`
      )
      router.push(`/credit-notes/${res.id}` as Route)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not issue the credit note')
    }
  }

  return (
    <div>
      <PageHeader title="New Credit Note" description="Reduce the value of an issued tax invoice — returns, rate corrections, discounts">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </PageHeader>

      <Card className="mb-6">
        <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1 md:col-span-2">
            <label className="block text-sm font-medium text-slate-700">Against invoice</label>
            <select
              value={invoiceId}
              onChange={(e) => {
                setInvoiceId(e.target.value)
                setEntries({})
              }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            >
              <option value="">Select an invoice…</option>
              {(invoices ?? []).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoice_no} · {formatDate(i.invoice_date)} · {i.buyer_name} · {formatCurrency(i.total_amount)}
                </option>
              ))}
            </select>
          </div>
          {inv && (
            <Link href={`/invoices/${inv.id}` as Route} className="text-sm text-blue-600 hover:underline">
              Open {inv.invoice_no}
            </Link>
          )}
        </CardBody>
      </Card>

      {invoiceId && !inv && <p className="text-sm text-slate-500">Invoice not found.</p>}

      {inv && blockers.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 space-y-1">
          {blockers.map((b) => (
            <div key={b} className="flex gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {b}
            </div>
          ))}
        </div>
      )}

      {inv && blockers.length === 0 && preview && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardBody className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CREDIT_NOTE_REASONS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => changeReason(r.value)}
                      className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                        reason === r.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-sm font-medium text-slate-900">{r.label}</div>
                      <div className="text-xs text-slate-500">{r.hint}</div>
                    </button>
                  ))}
                </div>
                {isReturn && (
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
                    Put the returned goods back into stock
                  </label>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">{isReturn ? 'Quantity returned' : 'Taxable value to credit'}</h3>
                <Button variant="ghost" size="sm" onClick={fillAll}>
                  {isReturn ? 'Return everything left' : 'Credit everything left'}
                </Button>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                      <th className="text-left px-4 py-3">Item</th>
                      <th className="text-right px-4 py-3">Invoiced</th>
                      <th className="text-right px-4 py-3">{isReturn ? 'Returnable' : 'Value left'}</th>
                      <th className="text-right px-4 py-3 w-40">{isReturn ? 'Qty' : 'Amount (₹)'}</th>
                      <th className="text-right px-4 py-3">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {lines.map((l) => {
                      const row = preview.rows.find((r) => r.id === l.id)
                      const open = isReturn ? l.qtyLeft > 0 && l.valueLeft > 0 : l.valueLeft > 0
                      return (
                        <tr key={l.id} className={open ? undefined : 'opacity-50'}>
                          <td className="px-4 py-3">
                            <div className="text-slate-900">{l.description}</div>
                            <div className="text-xs text-slate-400">
                              HSN {l.hsn_code ?? '—'} · {formatCurrency(l.rate)} · GST {l.gst_rate}%
                            </div>
                            {row?.error && <div className="text-xs text-red-600 mt-1">{row.error}</div>}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                            {formatQty(l.qty, l.unit_name)}
                            <div className="text-xs text-slate-400">{formatCurrency(l.taxable_value)}</div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                            {isReturn ? formatQty(l.qtyLeft, l.unit_name) : formatCurrency(l.valueLeft)}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              step={isReturn ? 'any' : '0.01'}
                              disabled={!open}
                              value={entries[l.id] ?? ''}
                              onChange={(e) => setEntries((prev) => ({ ...prev, [l.id]: e.target.value }))}
                              className="w-full px-2 py-1.5 text-sm text-right rounded-lg border border-slate-300 disabled:bg-slate-50"
                            />
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">
                            {row && !row.error ? formatCurrency(row.taxable + row.cgst + row.sgst + row.igst) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Credit note date"
                  type="date"
                  min={inv.invoice_date}
                  max={maxDate}
                  value={noteDate}
                  onChange={(e) => setNoteDate(e.target.value)}
                />
                <div className="md:col-span-2">
                  <Textarea
                    label="Notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={isReturn ? 'e.g. 3 pcs damaged in transit, returned by the customer' : 'e.g. rate agreed at ₹95'}
                  />
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardBody className="space-y-2 text-sm">
                <div className="text-xs font-semibold uppercase text-slate-400">{inv.invoice_no}</div>
                <div className="font-semibold text-slate-900">{inv.buyer_name}</div>
                <div className="text-xs font-mono text-slate-500">{inv.buyer_gstin ?? 'Unregistered (B2C)'}</div>
                <Row label="Invoice total" value={inv.total_amount} />
                {inv.amount_credited > 0 && <Row label="Already credited" value={inv.amount_credited} />}
                <Row label="Paid" value={inv.amount_paid} />
                <Row label="Balance due" value={inv.balance_due ?? 0} />
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-2 text-sm">
                <Row label="Taxable value" value={preview.taxable} />
                {inv.is_interstate ? (
                  <Row label="IGST" value={preview.igst} />
                ) : (
                  <>
                    <Row label="CGST" value={preview.cgst} />
                    <Row label="SGST" value={preview.sgst} />
                  </>
                )}
                {preview.roundOff !== 0 && <Row label="Round off" value={preview.roundOff} />}
                <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                  <span>Credit note total</span>
                  <span className="tabular-nums">{formatCurrency(preview.total)}</span>
                </div>
                {preview.total > 0 && <p className="text-xs text-slate-500">{amountInWords(preview.total)}</p>}
                {preview.overRoom && (
                  <p className="text-xs text-red-600">Only {formatCurrency(preview.room)} of this invoice can still be credited.</p>
                )}
                {!preview.overRoom && preview.total > (inv.balance_due ?? 0) && (
                  <p className="text-xs text-amber-700">
                    More than the balance due: {formatCurrency(preview.total - (inv.balance_due ?? 0))} of the payment
                    already received becomes on-account credit for {inv.buyer_name}.
                  </p>
                )}
                <Button className="w-full mt-2" disabled={!canSave} loading={createNote.isPending} onClick={save}>
                  <FileMinus className="w-4 h-4" />
                  Issue credit note
                </Button>
                {deadline && (
                  <p className="text-xs text-slate-400">Credit notes for this invoice are allowed until {formatDate(deadline)}.</p>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}
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
