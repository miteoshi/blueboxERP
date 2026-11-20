'use client'

import { Fragment, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PAYMENT_MODES, paymentModeLabel, type PaymentMode } from '@/lib/hooks/use-finance'
import {
  useCancelGstPayment,
  useRecordGstPayment,
  useSetGstOpening,
  type GstLedger,
  type GstOpening,
  type GstPaymentRow,
} from '@/lib/hooks/use-gst-payments'
import { setOffInputCredit, type TaxHeads } from '@/lib/gst'
import { GST_HEADS, GST_HEAD_LABEL, challanTotal, defaultReturnPeriod, returnPeriodLabel, returnPeriodOptions } from '@/lib/gst-payments'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils/format'
import { Landmark } from 'lucide-react'

const r2 = (n: number) => Math.round(n * 100) / 100
const signed = (n: number) => `${n < 0 ? '−' : ''}${formatCurrency(Math.abs(r2(n)))}`
const SELECT = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

type SetLedger = Extract<GstLedger, { set: true }>

// What paying from the credit in hand would leave, head by head (rule 88A)
export function ledgerSetOff(ledger: SetLedger) {
  const output = {} as TaxHeads
  const credit = {} as TaxHeads
  for (const h of GST_HEADS) {
    const b = ledger.heads[h].balance
    output[h] = Math.max(0, b)
    credit[h] = Math.max(0, -b)
  }
  return setOffInputCredit(output, credit)
}

// ── The ledger, per head ───────────────────────────────────────
export function GstLedgerTable({ ledger }: { ledger: SetLedger }) {
  const rows: {
    label: string
    hint?: string
    value: (h: (typeof GST_HEADS)[number]) => number
    strong?: boolean
  }[] = [
    {
      label: 'Opening position',
      hint: `on ${formatDate(ledger.opening_as_of)}; credit in hand shows as minus`,
      value: (h) => ledger.heads[h].opening,
    },
    {
      label: 'Add: tax on sales',
      hint: 'invoices less credit notes, reverse charge left out',
      value: (h) => ledger.heads[h].output,
    },
    {
      label: 'Less: input credit',
      hint: 'bills from registered suppliers less debit notes',
      value: (h) => -ledger.heads[h].input,
    },
    { label: 'Less: paid by challan', value: (h) => -ledger.heads[h].paid },
    {
      label: 'Balance',
      hint: 'plus is still payable, minus is credit in hand',
      value: (h) => ledger.heads[h].balance,
      strong: true,
    },
  ]
  const total = (row: (typeof rows)[number]) => r2(GST_HEADS.reduce((s, h) => s + row.value(h), 0))

  return (
    <>
      {/* Phones: one block per head, then the total */}
      <div className="sm:hidden divide-y divide-slate-100">
        {[...GST_HEADS, 'total' as const].map((h) => (
          <div key={h} className="px-4 py-3">
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">{h === 'total' ? 'Total' : GST_HEAD_LABEL[h]}</div>
            {rows.map((row) => {
              const v = h === 'total' ? total(row) : r2(row.value(h))
              return (
                <div
                  key={row.label}
                  className={`flex justify-between gap-3 text-sm ${row.strong ? 'font-semibold text-slate-900 border-t border-slate-200 mt-1 pt-1' : 'text-slate-600'}`}
                >
                  <span>{row.label}</span>
                  <span
                    className={`tabular-nums whitespace-nowrap ${v === 0 && !row.strong ? 'text-slate-300' : row.strong && v < 0 ? 'text-green-700' : ''}`}
                  >
                    {signed(v)}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
              <th className="text-left px-4 py-3" />
              {GST_HEADS.map((h) => (
                <th key={h} className="text-right px-4 py-3">
                  {GST_HEAD_LABEL[h]}
                </th>
              ))}
              <th className="text-right px-4 py-3">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((row) => (
              <tr key={row.label} className={row.strong ? 'bg-slate-50 border-t-2 border-slate-300 font-semibold text-slate-900' : ''}>
                <td className="px-4 py-2.5">
                  <span className={row.strong ? '' : 'text-slate-700'}>{row.label}</span>
                  {row.hint && <div className="text-xs text-slate-400 font-normal">{row.hint}</div>}
                </td>
                {GST_HEADS.map((h) => {
                  const v = r2(row.value(h))
                  return (
                    <td
                      key={h}
                      className={`px-4 py-2.5 text-right tabular-nums whitespace-nowrap ${v === 0 ? 'text-slate-300' : row.strong && v < 0 ? 'text-green-700' : ''}`}
                    >
                      {signed(v)}
                    </td>
                  )
                })}
                <td
                  className={`px-4 py-2.5 text-right tabular-nums whitespace-nowrap ${row.strong ? (total(row) < 0 ? 'text-green-700' : '') : 'text-slate-600'}`}
                >
                  {signed(total(row))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── Opening position ───────────────────────────────────────────
const blankHeads = { igst: '', cgst: '', sgst: '' }
const fromOpening = (o: GstOpening | null | undefined, side: 'payable' | 'credit') =>
  o
    ? {
        igst: String(Number(o[`${side}_igst`]) || ''),
        cgst: String(Number(o[`${side}_cgst`]) || ''),
        sgst: String(Number(o[`${side}_sgst`]) || ''),
      }
    : { ...blankHeads }

export function GstOpeningForm({ opening, onDone }: { opening: GstOpening | null | undefined; onDone: () => void }) {
  const save = useSetGstOpening()
  const [asOf, setAsOf] = useState(opening?.as_of ?? '')
  const [payable, setPayable] = useState(() => fromOpening(opening, 'payable'))
  const [credit, setCredit] = useState(() => fromOpening(opening, 'credit'))

  function parse(v: Record<keyof TaxHeads, string>): TaxHeads | string {
    const out = {} as TaxHeads
    for (const h of GST_HEADS) {
      const n = v[h].trim() === '' ? 0 : Number(v[h])
      if (!Number.isFinite(n) || n < 0) return `${GST_HEAD_LABEL[h]}: enter an amount of nil or more`
      if (Math.round(n * 100) / 100 !== n) return `${GST_HEAD_LABEL[h]}: at most 2 decimals`
      out[h] = n
    }
    return out
  }

  function submit() {
    if (!asOf) return toast.error('Choose the day the position is for')
    if (asOf > todayISO()) return toast.error('The opening day cannot be in the future')
    const p = parse(payable)
    if (typeof p === 'string') return toast.error(`Tax payable — ${p}`)
    const c = parse(credit)
    if (typeof c === 'string') return toast.error(`Credit in hand — ${c}`)
    save.mutate({ asOf, payable: p, credit: c }, { onSuccess: onDone })
  }

  const grid = (label: string, value: Record<keyof TaxHeads, string>, set: (v: Record<keyof TaxHeads, string>) => void) => (
    <div>
      <div className="text-sm font-medium text-slate-700 mb-1.5">{label}</div>
      <div className="grid grid-cols-3 gap-2">
        {GST_HEADS.map((h) => (
          <Input
            key={h}
            label={GST_HEAD_LABEL[h]}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0"
            value={value[h]}
            onChange={(e) => set({ ...value, [h]: e.target.value })}
          />
        ))}
      </div>
    </div>
  )

  return (
    <Card className="mb-6 border-blue-200">
      <CardHeader>
        <h3 className="text-sm font-semibold text-slate-900">
          {opening ? 'Change the GST opening position' : 'Set the GST opening position'}
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Where GST stood at the end of a day — usually the last day of a month whose return is filed: the tax that return left unpaid, and
          the credit carried forward on the electronic credit ledger. Invoices, bills and challans after that day are added from the app.{' '}
          {opening ? 'Saving replaces the opening set earlier.' : ''}
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="max-w-xs">
          <Input label="Position at the end of" type="date" max={todayISO()} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {grid('Tax still payable (₹)', payable, setPayable)}
          {grid('Input credit in hand (₹)', credit, setCredit)}
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={onDone}>
            Close
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            Save opening position
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

// ── Recording a challan ────────────────────────────────────────
type Amounts = {
  igst: string
  cgst: string
  sgst: string
  interest: string
  late_fee: string
}
const AMOUNT_FIELDS: { key: keyof Amounts; label: string }[] = [
  { key: 'igst', label: 'IGST' },
  { key: 'cgst', label: 'CGST' },
  { key: 'sgst', label: 'SGST' },
  { key: 'interest', label: 'Interest' },
  { key: 'late_fee', label: 'Late fee' },
]
const blankAmounts: Amounts = {
  igst: '',
  cgst: '',
  sgst: '',
  interest: '',
  late_fee: '',
}

export function GstPaymentForm({ payable, onDone }: { payable?: { asOf: string; cash: TaxHeads } | null; onDone: () => void }) {
  const record = useRecordGstPayment()
  const [paymentDate, setPaymentDate] = useState(todayISO)
  const [period, setPeriod] = useState(() => defaultReturnPeriod(todayISO()))
  const [mode, setMode] = useState<PaymentMode>('bank_transfer')
  const [amounts, setAmounts] = useState<Amounts>(blankAmounts)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const periods = returnPeriodOptions(paymentDate || todayISO())
  const numbers = Object.fromEntries(
    AMOUNT_FIELDS.map((f) => [f.key, amounts[f.key].trim() === '' ? 0 : Number(amounts[f.key])]),
  ) as Record<keyof Amounts, number>
  const total = challanTotal(numbers)
  const toFill = payable && GST_HEADS.some((h) => payable.cash[h] > 0) ? payable : null

  function changeDate(value: string) {
    setPaymentDate(value)
    // Keep the return period possible for the new date
    if (value && period > value.slice(0, 7)) setPeriod(defaultReturnPeriod(value))
  }

  function submit() {
    for (const f of AMOUNT_FIELDS) {
      const n = numbers[f.key]
      if (!Number.isFinite(n) || n < 0) return toast.error(`${f.label}: enter an amount of nil or more`)
      if (Math.round(n * 100) / 100 !== n) return toast.error(`${f.label}: at most 2 decimals`)
    }
    if (!(total > 0)) return toast.error('Enter the amount paid under at least one head')
    if (!paymentDate) return toast.error('Give the payment date')
    if (paymentDate > todayISO()) return toast.error('Payment date cannot be in the future')
    record.mutate(
      {
        paymentDate,
        igst: numbers.igst,
        cgst: numbers.cgst,
        sgst: numbers.sgst,
        interest: numbers.interest,
        lateFee: numbers.late_fee,
        mode,
        period: period || undefined,
        reference,
        notes,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <Card className="mb-6 border-blue-200">
      <CardHeader>
        <h3 className="text-sm font-semibold text-slate-900">Record a GST payment</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          One challan: the tax paid in cash under each head, and any interest or late fee. Tax paid from input credit is not a payment —
          leave it out.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input label="Payment date" type="date" max={todayISO()} value={paymentDate} onChange={(e) => changeDate(e.target.value)} />
          <div>
            <label htmlFor="gst-period" className="block text-sm font-medium text-slate-700 mb-1.5">
              For the return of
            </label>
            <select id="gst-period" value={period} onChange={(e) => setPeriod(e.target.value)} className={SELECT}>
              <option value="">Not for one month</option>
              {periods.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="gst-mode" className="block text-sm font-medium text-slate-700 mb-1.5">
              Paid by
            </label>
            <select id="gst-mode" value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)} className={SELECT}>
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
            <span className="text-sm font-medium text-slate-700">Amounts (₹)</span>
            {toFill && (
              <button
                type="button"
                className="text-xs text-blue-600 hover:underline"
                onClick={() =>
                  setAmounts({
                    ...amounts,
                    igst: toFill.cash.igst ? String(toFill.cash.igst) : '',
                    cgst: toFill.cash.cgst ? String(toFill.cash.cgst) : '',
                    sgst: toFill.cash.sgst ? String(toFill.cash.sgst) : '',
                  })
                }
              >
                Fill with the tax payable in cash on {formatDate(toFill.asOf)}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {AMOUNT_FIELDS.map((f) => (
              <Input
                key={f.key}
                label={f.label}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="0"
                value={amounts[f.key]}
                onChange={(e) => setAmounts({ ...amounts, [f.key]: e.target.value })}
              />
            ))}
          </div>
          <p className="mt-2 text-sm text-slate-700">
            Challan total <span className="font-semibold tabular-nums">{formatCurrency(Number.isFinite(total) ? total : 0)}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="CPIN / CIN (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />
          <Input label="Notes" placeholder="e.g. GSTR-3B for October" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={onDone}>
            Close
          </Button>
          <Button loading={record.isPending} onClick={submit}>
            Save GST payment
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

// ── Challans in a period ───────────────────────────────────────
const taxOf = (p: Pick<GstPaymentRow, 'igst' | 'cgst' | 'sgst'>) => r2(Number(p.igst) + Number(p.cgst) + Number(p.sgst))
const extraOf = (p: Pick<GstPaymentRow, 'interest' | 'late_fee'>) => r2(Number(p.interest) + Number(p.late_fee))

export function GstPaymentList({ rows, canEdit }: { rows: GstPaymentRow[]; canEdit: boolean }) {
  const cancel = useCancelGstPayment()
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  function confirmCancel(id: string) {
    if (!reason.trim()) return toast.error('Give a reason')
    cancel.mutate(
      { id, reason: reason.trim() },
      {
        onSuccess: () => {
          setCancelling(null)
          setReason('')
        },
      },
    )
  }

  const active = rows.filter((p) => p.status === 'active')
  const tax = r2(active.reduce((s, p) => s + taxOf(p), 0))
  const extra = r2(active.reduce((s, p) => s + extraOf(p), 0))

  return (
    <div className="overflow-x-auto">
      <table className="stack w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
            <th className="text-left px-4 py-3">Challan</th>
            <th className="text-left px-4 py-3">For</th>
            <th className="text-left px-4 py-3">Mode</th>
            <th className="text-right px-4 py-3">Tax</th>
            <th className="text-right px-4 py-3">Interest &amp; fee</th>
            <th className="text-right px-4 py-3">Amount</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center py-12 text-slate-400 text-sm">
                <Landmark className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                No GST paid in this period
              </td>
            </tr>
          )}
          {rows.map((p) => {
            const off = p.status === 'cancelled'
            const split = GST_HEADS.filter((h) => Number(p[h]) > 0)
              .map((h) => `${GST_HEAD_LABEL[h]} ${formatCurrency(Number(p[h]))}`)
              .join(' · ')
            return (
              <Fragment key={p.id}>
                <tr className={off ? 'opacity-60' : undefined}>
                  <td data-main className="px-4 py-3">
                    <span className={`font-mono font-semibold text-slate-900 whitespace-nowrap ${off ? 'line-through' : ''}`}>
                      {p.payment_no}
                    </span>
                    <div className="text-xs text-slate-400">
                      {formatDate(p.payment_date)}
                      {p.creator?.full_name ? ` · ${p.creator.full_name}` : ''}
                    </div>
                    {off && (
                      <div className="mt-1">
                        <Badge variant="default">Cancelled</Badge>
                        {p.cancel_reason && <span className="ml-1 text-xs text-slate-500">{p.cancel_reason}</span>}
                      </div>
                    )}
                  </td>
                  <td data-label="For" className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {p.period ? returnPeriodLabel(p.period) : '—'}
                    {p.notes && <div className="text-xs text-slate-400 whitespace-normal">{p.notes}</div>}
                  </td>
                  <td data-label="Mode" className="px-4 py-3 text-slate-600">
                    {paymentModeLabel(p.mode)}
                    {p.reference && <div className="text-xs text-slate-400">{p.reference}</div>}
                  </td>
                  <td data-label="Tax" className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    {formatCurrency(taxOf(p))}
                    {split && <div className="text-xs text-slate-400">{split}</div>}
                  </td>
                  <td
                    data-label="Interest & fee"
                    className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${extraOf(p) ? 'text-amber-700' : 'text-slate-300'}`}
                  >
                    {formatCurrency(extraOf(p))}
                  </td>
                  <td data-label="Amount" className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                    {formatCurrency(Number(p.amount))}
                  </td>
                  <td data-hide={!canEdit || off ? true : undefined} className="px-4 py-3 text-right">
                    {canEdit && !off && (
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => {
                          setCancelling(cancelling === p.id ? null : p.id)
                          setReason('')
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
                {cancelling === p.id && (
                  <tr>
                    <td colSpan={7} className="bg-red-50 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          autoFocus
                          placeholder={`Why cancel ${p.payment_no}? e.g. entered twice`}
                          value={reason}
                          onChange={(ev) => setReason(ev.target.value)}
                          className="flex-1 min-w-[200px] px-3 py-1.5 text-sm rounded-lg border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-300"
                        />
                        <Button variant="outline" size="sm" onClick={() => setCancelling(null)}>
                          Keep
                        </Button>
                        <Button variant="danger" size="sm" loading={cancel.isPending} onClick={() => confirmCancel(p.id)}>
                          Cancel GST payment
                        </Button>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        The challan stays on record, marked cancelled, and drops out of the ledger, balances and profit and loss.
                      </p>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
        {active.length > 0 && (
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
              <td colSpan={3} className="px-4 py-3">
                Total, cancelled left out
              </td>
              {/* On phones only the label and the total paid show */}
              <td data-hide className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{formatCurrency(tax)}</td>
              <td data-hide className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{formatCurrency(extra)}</td>
              <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{formatCurrency(r2(tax + extra))}</td>
              <td data-hide />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
