'use client'

import { Fragment, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PAYMENT_MODES, paymentModeLabel, type PaymentMode } from '@/lib/hooks/use-finance'
import {
  useCancelTdsDeposit,
  useRecordTdsDeposit,
  useSetTdsOpening,
  type TdsDeductionRow,
  type TdsDepositRow,
  type TdsMonth,
} from '@/lib/hooks/use-tds'
import { useClosedPeriod } from '@/lib/hooks/use-books-lock'
import { defaultReturnPeriod, returnPeriodLabel, returnPeriodOptions } from '@/lib/gst-payments'
import { TDS_CODES, deducteePan, tdsCodeLabel } from '@/lib/tds'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils/format'
import { Landmark, Percent } from 'lucide-react'

const r2 = (n: number) => Math.round(n * 100) / 100
const SELECT = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

// Month by month: what was deducted, what has been deposited for it, and when it is due
export function TdsMonthsTable({ months, asOf }: { months: TdsMonth[]; asOf: string }) {
  if (months.length === 0) {
    return <div className="p-8 text-center text-sm text-slate-400">No TDS deducted or deposited yet.</div>
  }
  return (
    <div className="overflow-x-auto">
      <table className="stack w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
            <th className="text-left px-4 py-3">Month deducted</th>
            <th className="text-right px-4 py-3">Deducted</th>
            <th className="text-right px-4 py-3">Deposited</th>
            <th className="text-right px-4 py-3">To deposit</th>
            <th className="text-left px-4 py-3">Due by</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {months.map((m) => {
            const owed = m.outstanding >= 0.005
            const over = m.outstanding <= -0.005
            return (
              <tr key={m.period}>
                <td data-main className="px-4 py-3 font-medium text-slate-900">{returnPeriodLabel(m.period)}</td>
                <td data-label="Deducted" className="px-4 py-3 text-right tabular-nums">{formatCurrency(m.deducted)}</td>
                <td data-label="Deposited" className="px-4 py-3 text-right tabular-nums">{formatCurrency(m.deposited)}</td>
                <td
                  data-label="To deposit"
                  className={`px-4 py-3 text-right tabular-nums font-semibold ${m.overdue ? 'text-red-600' : owed ? 'text-amber-700' : 'text-slate-400'}`}
                >
                  {over ? `${formatCurrency(-m.outstanding)} extra` : formatCurrency(Math.max(0, m.outstanding))}
                </td>
                <td data-label="Due by" className="px-4 py-3 whitespace-nowrap">
                  {owed ? (
                    <span className={m.overdue ? 'text-red-600 font-medium' : 'text-slate-700'}>
                      {formatDate(m.due_date)}
                      {m.overdue && <Badge variant="danger" className="ml-2">Overdue</Badge>}
                    </span>
                  ) : (
                    <span className="text-slate-400">{m.deducted > 0 ? 'Deposited' : '—'}</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100">
        TDS deducted in a month is due by the 7th of the next month, and March&apos;s by 30 April. Interest runs for each month
        or part of a month it is late, as of {formatDate(asOf)}.
      </p>
    </div>
  )
}

export function TdsOpeningForm({
  opening,
  onDone,
}: {
  opening: { as_of: string; amount: number } | null | undefined
  onDone: () => void
}) {
  const save = useSetTdsOpening()
  const closed = useClosedPeriod()
  const [asOf, setAsOf] = useState(opening?.as_of ?? '')
  const [amount, setAmount] = useState(opening ? String(opening.amount) : '')

  function submit() {
    const value = amount.trim() === '' ? 0 : Number(amount)
    if (!asOf) return toast.error('Choose the day')
    if (asOf > todayISO()) return toast.error('The opening day cannot be in the future')
    if (closed.error(asOf)) return toast.error(closed.error(asOf))
    if (!Number.isFinite(value) || value < 0 || r2(value) !== value) return toast.error('Enter an amount of nil or more, at most 2 decimals')
    save.mutate({ asOf, amount: value }, { onSuccess: onDone })
  }

  return (
    <Card className="mb-6 border-blue-200">
      <CardHeader>
        <h3 className="text-sm font-semibold text-slate-900">TDS opening</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          TDS you had deducted but not yet deposited at the end of a day, before you started recording it here. Deductions and deposits
          on or before that day are then counted in it.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input label="At the end of" type="date" min={closed.min()} error={closed.error(asOf)} max={todayISO()} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          <Input
            label="TDS still to deposit (₹)"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={onDone}>
            Close
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            Save opening
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

export function TdsDepositForm({ months, onDone }: { months: TdsMonth[]; onDone: () => void }) {
  const record = useRecordTdsDeposit()
  const closed = useClosedPeriod()
  const [depositDate, setDepositDate] = useState(todayISO)
  // Most deposits are for last month's deductions; the oldest month still owed comes first if there is one
  const owedMonths = months.filter((m) => m.outstanding >= 0.005).sort((a, b) => a.period.localeCompare(b.period))
  const [period, setPeriod] = useState(() => owedMonths[0]?.period ?? defaultReturnPeriod(todayISO()))
  const [code, setCode] = useState('')
  const [mode, setMode] = useState<PaymentMode>('bank_transfer')
  const [tax, setTax] = useState(() => (owedMonths[0] ? String(owedMonths[0].outstanding) : ''))
  const [interest, setInterest] = useState('')
  const [lateFee, setLateFee] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const periods = returnPeriodOptions(depositDate || todayISO())
  const owedFor = months.find((m) => m.period === period)
  const num = (v: string) => (v.trim() === '' ? 0 : Number(v))
  const total = r2(num(tax) + num(interest) + num(lateFee))

  function changeDate(value: string) {
    setDepositDate(value)
    // The month of deduction cannot be after the month of deposit
    if (value && period > value.slice(0, 7)) setPeriod(defaultReturnPeriod(value))
  }

  function submit() {
    const parts = [
      ['TDS', num(tax)],
      ['Interest', num(interest)],
      ['Late fee', num(lateFee)],
    ] as const
    for (const [label, n] of parts) {
      if (!Number.isFinite(n) || n < 0) return toast.error(`${label}: enter an amount of nil or more`)
      if (r2(n) !== n) return toast.error(`${label}: at most 2 decimals`)
    }
    if (!(total > 0)) return toast.error('Enter the TDS, interest or late fee deposited')
    if (!depositDate) return toast.error('Give the deposit date')
    if (depositDate > todayISO()) return toast.error('Deposit date cannot be in the future')
    if (closed.error(depositDate)) return toast.error(closed.error(depositDate))
    if (!period) return toast.error('Choose the month the TDS was deducted in')
    record.mutate(
      {
        depositDate,
        period,
        tax: num(tax),
        interest: num(interest),
        lateFee: num(lateFee),
        mode,
        code: code || undefined,
        reference,
        notes,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <Card className="mb-6 border-blue-200">
      <CardHeader>
        <h3 className="text-sm font-semibold text-slate-900">Record a TDS deposit</h3>
        <p className="text-xs text-slate-500 mt-0.5">One challan: the TDS deposited for a month of deduction, and any interest or late fee.</p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input label="Deposit date" type="date" min={closed.min()} error={closed.error(depositDate)} max={todayISO()} value={depositDate} onChange={(e) => changeDate(e.target.value)} />
          <div>
            <label htmlFor="tds-period" className="block text-sm font-medium text-slate-700 mb-1.5">
              For TDS deducted in
            </label>
            <select id="tds-period" value={period} onChange={(e) => setPeriod(e.target.value)} className={SELECT}>
              {periods.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {owedFor && owedFor.outstanding >= 0.005 && (
              <button type="button" className="mt-1 text-xs text-blue-600 hover:underline" onClick={() => setTax(String(owedFor.outstanding))}>
                {formatCurrency(owedFor.outstanding)} still to deposit — fill it in
              </button>
            )}
          </div>
          <div>
            <label htmlFor="tds-deposit-code" className="block text-sm font-medium text-slate-700 mb-1.5">
              Payment code
            </label>
            <select id="tds-deposit-code" value={code} onChange={(e) => setCode(e.target.value)} className={SELECT}>
              <option value="">Not given</option>
              {TDS_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Input label="TDS (₹)" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={tax} onChange={(e) => setTax(e.target.value)} />
          <Input label="Interest (₹)" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={interest} onChange={(e) => setInterest(e.target.value)} />
          <Input label="Late fee (₹)" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={lateFee} onChange={(e) => setLateFee(e.target.value)} />
          <div>
            <label htmlFor="tds-mode" className="block text-sm font-medium text-slate-700 mb-1.5">
              Paid by
            </label>
            <select id="tds-mode" value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)} className={SELECT}>
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-sm text-slate-700">
          Challan total <span className="font-semibold tabular-nums">{formatCurrency(Number.isFinite(total) ? total : 0)}</span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Challan / CIN (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={onDone}>
            Close
          </Button>
          <Button loading={record.isPending} onClick={submit}>
            Save TDS deposit
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

export function TdsDepositList({ rows, canEdit }: { rows: TdsDepositRow[]; canEdit: boolean }) {
  const cancel = useCancelTdsDeposit()
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

  const active = rows.filter((d) => d.status === 'active')
  const tax = r2(active.reduce((s, d) => s + Number(d.tax), 0))
  const extra = r2(active.reduce((s, d) => s + Number(d.interest) + Number(d.late_fee), 0))

  return (
    <div className="overflow-x-auto">
      <table className="stack w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
            <th className="text-left px-4 py-3">Challan</th>
            <th className="text-left px-4 py-3">For</th>
            <th className="text-left px-4 py-3">Mode</th>
            <th className="text-right px-4 py-3">TDS</th>
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
                No TDS deposited in this period
              </td>
            </tr>
          )}
          {rows.map((d) => {
            const off = d.status === 'cancelled'
            const charges = r2(Number(d.interest) + Number(d.late_fee))
            return (
              <Fragment key={d.id}>
                <tr className={off ? 'opacity-60' : undefined}>
                  <td data-main className="px-4 py-3">
                    <span className={`font-mono font-semibold text-slate-900 whitespace-nowrap ${off ? 'line-through' : ''}`}>{d.deposit_no}</span>
                    <div className="text-xs text-slate-400">
                      {formatDate(d.deposit_date)}
                      {d.creator?.full_name ? ` · ${d.creator.full_name}` : ''}
                    </div>
                    {off && (
                      <div className="mt-1">
                        <Badge variant="default">Cancelled</Badge>
                        {d.cancel_reason && <span className="ml-1 text-xs text-slate-500">{d.cancel_reason}</span>}
                      </div>
                    )}
                  </td>
                  <td data-label="For" className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {returnPeriodLabel(d.period)}
                    {d.tds_code && <div className="text-xs text-slate-400 whitespace-normal">{tdsCodeLabel(d.tds_code)}</div>}
                    {d.notes && <div className="text-xs text-slate-400 whitespace-normal">{d.notes}</div>}
                  </td>
                  <td data-label="Mode" className="px-4 py-3 text-slate-600">
                    {paymentModeLabel(d.mode)}
                    {d.reference && <div className="text-xs text-slate-400">{d.reference}</div>}
                  </td>
                  <td data-label="TDS" className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{formatCurrency(Number(d.tax))}</td>
                  <td data-label="Interest & fee" className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${charges ? 'text-amber-700' : 'text-slate-300'}`}>
                    {formatCurrency(charges)}
                  </td>
                  <td data-label="Amount" className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                    {formatCurrency(Number(d.amount))}
                  </td>
                  <td data-hide={!canEdit || off ? true : undefined} className="px-4 py-3 text-right">
                    {canEdit && !off && (
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => {
                          setCancelling(cancelling === d.id ? null : d.id)
                          setReason('')
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
                {cancelling === d.id && (
                  <tr>
                    <td colSpan={7} className="bg-red-50 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          aria-label={`Reason for cancelling ${d.deposit_no}`}
                          type="text"
                          autoFocus
                          placeholder={`Why cancel ${d.deposit_no}? e.g. entered twice`}
                          value={reason}
                          onChange={(ev) => setReason(ev.target.value)}
                          className="flex-1 min-w-[200px] px-3 py-1.5 text-sm rounded-lg border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-300"
                        />
                        <Button variant="outline" size="sm" onClick={() => setCancelling(null)}>
                          Keep
                        </Button>
                        <Button variant="danger" size="sm" loading={cancel.isPending} onClick={() => confirmCancel(d.id)}>
                          Cancel TDS deposit
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
              {/* On phones only the label and the total show */}
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

// Every payment that deducted TDS in the period: what goes into the quarterly return
export function TdsDeductionList({ rows }: { rows: TdsDeductionRow[] }) {
  const tds = r2(rows.reduce((s, p) => s + p.tds, 0))
  const base = r2(rows.reduce((s, p) => s + p.base, 0))
  const missingPan = rows.filter((p) => !deducteePan(p.pan, p.gstin)).length

  return (
    <div className="overflow-x-auto">
      {missingPan > 0 && (
        <p className="px-4 py-3 text-xs text-amber-800 bg-amber-50 border-b border-amber-100">
          {missingPan} {missingPan === 1 ? 'deduction has' : 'deductions have'} no PAN for the payee. Add it under Suppliers, or on the
          expense: the return needs it, and without one TDS is due at the higher rate.
        </p>
      )}
      <table className="stack w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
            <th className="text-left px-4 py-3">Entry</th>
            <th className="text-left px-4 py-3">Paid to</th>
            <th className="text-left px-4 py-3">Code</th>
            <th className="text-right px-4 py-3">TDS on</th>
            <th className="text-right px-4 py-3">TDS</th>
            <th className="text-right px-4 py-3">Paid</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                <Percent className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                No TDS deducted in this period
              </td>
            </tr>
          )}
          {rows.map((p) => {
            const pan = deducteePan(p.pan, p.gstin)
            return (
              <tr key={`${p.kind}-${p.id}`}>
                <td data-main className="px-4 py-3">
                  <span className="font-mono font-semibold text-slate-900 whitespace-nowrap">{p.no}</span>
                  <div className="text-xs text-slate-400">
                    {formatDate(p.date)} · {p.kind === 'expense' ? 'Expense' : 'Supplier payment'}
                  </div>
                </td>
                <td data-label="Paid to" className="px-4 py-3">
                  <span className="text-slate-900">{p.party}</span>
                  <div className={`text-xs font-mono ${pan ? 'text-slate-400' : 'text-amber-700'}`}>{pan ?? 'PAN missing'}</div>
                </td>
                <td data-label="Code" className="px-4 py-3 text-slate-600">
                  <span className="font-mono">{p.code}</span>
                  <span className="text-xs text-slate-400"> at {p.rate}%</span>
                </td>
                <td data-label="TDS on" className="px-4 py-3 text-right tabular-nums">{formatCurrency(p.base)}</td>
                <td data-label="TDS" className="px-4 py-3 text-right tabular-nums font-semibold">{formatCurrency(p.tds)}</td>
                <td data-label="Paid" className="px-4 py-3 text-right tabular-nums text-slate-600">{formatCurrency(p.paid)}</td>
              </tr>
            )
          })}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
              <td colSpan={3} className="px-4 py-3">
                Total
              </td>
              <td data-hide className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{formatCurrency(base)}</td>
              <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{formatCurrency(tds)}</td>
              <td data-hide />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
