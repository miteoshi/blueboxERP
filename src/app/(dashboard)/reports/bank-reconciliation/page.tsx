'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TableLoader } from '@/components/ui/spinner'
import { paymentModeLabel } from '@/lib/hooks/use-finance'
import { useRole } from '@/lib/hooks/use-profile'
import {
  BANK_ENTRY_LABEL,
  bankEntryHref,
  notInBank,
  useBankBook,
  useBankReconciliation,
  useSetBankDates,
  type BankEntry,
} from '@/lib/hooks/use-bank-reconciliation'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils/format'
import { monthRange, reportPeriods } from '@/lib/utils/periods'
import { downloadCsv } from '@/lib/utils/csv'
import { CheckCircle2, Download, FileUp, Landmark, X } from 'lucide-react'
import { StatementMatch } from '@/components/finance/statement-match'

const HEAD = 'bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase'
const r2 = (n: number) => Math.round(n * 100) / 100
const signed = (n: number) => `${n < 0 ? '−' : ''}${formatCurrency(Math.abs(r2(n)))}`

export default function BankReconciliationPage() {
  const role = useRole()
  const canEdit = role === 'admin' || role === 'manager'
  const thisMonth = monthRange(0)
  const [from, setFrom] = useState(thisMonth.from)
  const [to, setTo] = useState(thisMonth.to)
  const [show, setShow] = useState<'open' | 'all'>('open')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDate, setBulkDate] = useState(todayISO)
  const [statement, setStatement] = useState('')
  const [matching, setMatching] = useState(false)

  // Reconcile on the last day of the period, but never on a day still to come
  const today = todayISO()
  const asOf = to > today ? today : to
  const validPeriod = !!from && !!to && from <= to

  const { data: rec, isLoading: loadingRec } = useBankReconciliation(validPeriod ? asOf : '')
  const { data: book, isLoading: loadingBook } = useBankBook(from, to)
  const save = useSetBankDates()

  const rows = useMemo(
    () => (book ?? []).filter((e) => show === 'all' || notInBank(e, asOf)),
    [book, show, asOf]
  )
  const key = (e: Pick<BankEntry, 'kind' | 'doc_id'>) => `${e.kind}:${e.doc_id}`
  const picked = rows.filter((e) => selected.has(key(e)))
  const allPicked = rows.length > 0 && picked.length === rows.length

  function toggle(e: BankEntry) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(key(e))) next.delete(key(e))
      else next.add(key(e))
      return next
    })
  }

  function saveDates(entries: { e: BankEntry; date: string | null }[], onDone?: () => void) {
    for (const { e, date } of entries) {
      if (!date) continue
      if (date < e.doc_date) return toast.error(`Bank date for ${e.doc_no} cannot be before ${formatDate(e.doc_date)}`)
      if (date > today) return toast.error('A bank date cannot be in the future')
    }
    save.mutate(
      entries.map(({ e, date }) => ({ doc_type: e.kind, doc_id: e.doc_id, bank_date: date })),
      { onSuccess: onDone }
    )
  }

  const clearSelection = () => setSelected(new Set())

  function exportCsv() {
    downloadCsv(`bank-reconciliation-${from}_${to}`, rows, [
      { header: 'Date', value: (e) => e.doc_date },
      { header: 'Entry', value: (e) => e.doc_no },
      { header: 'Type', value: (e) => BANK_ENTRY_LABEL[e.kind] },
      { header: 'Party', value: (e) => (e.detail && e.detail !== e.party ? `${e.party} (${e.detail})` : e.party) },
      { header: 'Mode', value: (e) => (e.kind === 'transfer' ? 'Transfer' : paymentModeLabel(e.mode)) },
      { header: 'Reference', value: (e) => e.reference },
      { header: 'Deposit', value: (e) => (e.deposit ? e.deposit : null) },
      { header: 'Withdrawal', value: (e) => (e.withdrawal ? e.withdrawal : null) },
      { header: 'Bank Date', value: (e) => e.bank_date },
    ])
  }

  const presets = reportPeriods()
  const statementValue = statement.trim() === '' ? null : Number(statement)
  const difference =
    rec?.set && statementValue !== null && Number.isFinite(statementValue) ? r2(statementValue - rec.bank_balance) : null
  const shownDeposits = r2(rows.reduce((s, e) => s + e.deposit, 0))
  const shownWithdrawals = r2(rows.reduce((s, e) => s + e.withdrawal, 0))

  return (
    <div>
      <PageHeader
        title="Bank Reconciliation"
        description="Tick off each bank entry when it shows on your bank statement, then check the balances agree"
      >
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={loadingBook || rows.length === 0}>
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
        <Button size="sm" onClick={() => setMatching(true)} disabled={matching}>
          <FileUp className="w-4 h-4" />
          Match statement
        </Button>
      </PageHeader>

      {matching && (
        <StatementMatch
          canEdit={canEdit}
          onClose={() => setMatching(false)}
          onUseClosing={(date, balance) => {
            if (date < from) setFrom(`${date.slice(0, 8)}01`)
            setTo(date)
            setStatement(String(balance))
          }}
        />
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 flex flex-wrap items-end gap-3">
        <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <div className="flex flex-wrap gap-1">
          {presets.map((p) => (
            <Button
              key={p.label}
              variant={from === p.from && to === p.to ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => {
                setFrom(p.from)
                setTo(p.to)
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {!validPeriod ? (
        <p className="text-sm text-red-600 mb-6">Choose a period that starts on or before the day it ends.</p>
      ) : loadingRec ? (
        <TableLoader />
      ) : rec && !rec.set ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6 text-sm text-slate-600">
          <Landmark className="w-6 h-6 text-slate-300 mb-2" />
          <p className="font-medium text-slate-900">Set the bank opening balance first</p>
          <p className="mt-1">
            The reconciliation starts from the bank balance on a day you choose. Set it on the{' '}
            <Link href={'/reports/cash-book' as Route} className="text-blue-600 hover:underline">
              Cash &amp; Bank Book
            </Link>
            , then come back to tick entries off.
          </p>
        </div>
      ) : rec?.set ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Reconciliation on {formatDate(rec.as_of)}</h3>
              <p className="text-xs text-slate-500">From the bank opening balance on {formatDate(rec.opening_as_of)}</p>
            </div>
            <dl className="divide-y divide-slate-50 text-sm">
              <Line label="Balance as per books" value={signed(rec.book_balance)} />
              <Line
                label="Less: deposits not yet credited by the bank"
                hint={`${rec.deposits_not_credited.entries} ${rec.deposits_not_credited.entries === 1 ? 'entry' : 'entries'}`}
                value={rec.deposits_not_credited.amount ? `−${formatCurrency(rec.deposits_not_credited.amount)}` : formatCurrency(0)}
              />
              <Line
                label="Add: payments not yet cleared by the bank"
                hint={`${rec.payments_not_cleared.entries} ${rec.payments_not_cleared.entries === 1 ? 'entry' : 'entries'}`}
                value={rec.payments_not_cleared.amount ? `+${formatCurrency(rec.payments_not_cleared.amount)}` : formatCurrency(0)}
              />
              <Line label="Balance your bank statement should show" value={signed(rec.bank_balance)} strong />
            </dl>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-900">Check against your statement</h3>
            <p className="text-xs text-slate-500 mb-3">Closing balance on your bank statement for {formatDate(rec.as_of)}</p>
            <Input
              label="Statement balance (₹)"
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="e.g. 61000"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
            />
            {difference !== null &&
              (Math.abs(difference) < 0.005 ? (
                <p className="mt-3 flex items-start gap-2 text-sm text-green-700">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  Agrees with your bank statement.
                </p>
              ) : (
                <div className="mt-3 text-sm">
                  <p className="font-semibold text-amber-700">
                    Bank shows {formatCurrency(Math.abs(difference))}{' '}
                    {difference > 0 ? 'more' : 'less'} than expected
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Look for entries the bank made that are not in the app — charges, interest, a direct deposit — and
                    for entries ticked off on the wrong date.
                  </p>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {validPeriod && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
            <div className="inline-flex rounded-lg bg-slate-100 p-1">
              {(
                [
                  ['open', `Not in bank by ${formatDate(asOf)}`],
                  ['all', 'All in period'],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setShow(v)
                    clearSelection()
                  }}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    show === v ? 'bg-white shadow-sm font-medium text-slate-900' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500">
              {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          {canEdit && picked.length > 0 && (
            <div className="flex flex-wrap items-end gap-2 px-4 py-3 bg-blue-50 border-b border-blue-100">
              <span className="text-sm font-medium text-slate-900 mr-2 self-center">{picked.length} selected</span>
              <Input label="Bank date" type="date" max={today} value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} />
              <Button
                size="sm"
                loading={save.isPending}
                onClick={() => {
                  if (!bulkDate) return toast.error('Choose the bank date')
                  saveDates(picked.map((e) => ({ e, date: bulkDate })), clearSelection)
                }}
              >
                Mark in bank on this date
              </Button>
              <Button
                size="sm"
                variant="outline"
                loading={save.isPending}
                onClick={() => saveDates(picked.map((e) => ({ e, date: e.doc_date })), clearSelection)}
              >
                On their own dates
              </Button>
              {picked.some((e) => e.bank_date) && (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={save.isPending}
                  onClick={() => saveDates(picked.filter((e) => e.bank_date).map((e) => ({ e, date: null })), clearSelection)}
                >
                  Clear bank dates
                </Button>
              )}
            </div>
          )}

          {loadingBook ? (
            <TableLoader />
          ) : (
            <div className="overflow-x-auto">
              <table className="stack w-full text-sm">
                <thead>
                  <tr className={HEAD}>
                    {canEdit && (
                      <th className="px-4 py-3 w-8">
                        <input
                          type="checkbox"
                          aria-label="Select all"
                          checked={allPicked}
                          onChange={() => setSelected(allPicked ? new Set() : new Set(rows.map(key)))}
                        />
                      </th>
                    )}
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Entry</th>
                    <th className="text-left px-4 py-3">Party / mode</th>
                    <th className="text-right px-4 py-3">Deposit</th>
                    <th className="text-right px-4 py-3">Withdrawal</th>
                    <th className="text-left px-4 py-3">Bank date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={canEdit ? 7 : 6} className="text-center py-12 text-slate-400 text-sm">
                        {show === 'open'
                          ? 'Every bank entry in this period is ticked off'
                          : 'No receipts, payments, expenses or transfers through the bank in this period'}
                      </td>
                    </tr>
                  )}
                  {rows.map((e) => {
                    const href = bankEntryHref(e)
                    const late = notInBank(e, asOf)
                    return (
                      <tr key={key(e)} className={selected.has(key(e)) ? 'bg-blue-50/50' : undefined}>
                        {canEdit && (
                          <td data-hide className="px-4 py-3">
                            <input
                              type="checkbox"
                              aria-label={`Select ${e.doc_no}`}
                              checked={selected.has(key(e))}
                              onChange={() => toggle(e)}
                            />
                          </td>
                        )}
                        <td data-label="Date" className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(e.doc_date)}</td>
                        <td data-main className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            {canEdit && (
                              <input
                                type="checkbox"
                                aria-label={`Select ${e.doc_no}`}
                                className="mt-1 md:hidden"
                                checked={selected.has(key(e))}
                                onChange={() => toggle(e)}
                              />
                            )}
                            <div>
                              {href ? (
                                <Link href={href as Route} className="font-mono font-semibold text-slate-900 hover:text-blue-600 whitespace-nowrap">
                                  {e.doc_no}
                                </Link>
                              ) : (
                                <span className="font-mono font-semibold text-slate-900 whitespace-nowrap">{e.doc_no}</span>
                              )}
                              <div className="text-xs text-slate-400">{BANK_ENTRY_LABEL[e.kind]}</div>
                            </div>
                          </div>
                        </td>
                        <td data-label="Party" className="px-4 py-3 text-slate-900">
                          {e.party}
                          <div className="text-xs text-slate-400">
                            {[
                              e.detail && e.detail !== e.party ? e.detail : null,
                              e.kind === 'transfer' ? null : paymentModeLabel(e.mode),
                              e.reference,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        </td>
                        <Amount label="Deposit" value={e.deposit} tone="in" />
                        <Amount label="Withdrawal" value={e.withdrawal} tone="out" />
                        <td data-label="Bank date" className="px-4 py-3">
                          {canEdit ? (
                            <BankDateCell
                              key={`${key(e)}:${e.bank_date ?? ''}`}
                              entry={e}
                              today={today}
                              saving={save.isPending}
                              onSave={(date) => saveDates([{ e, date }])}
                            />
                          ) : e.bank_date ? (
                            <span className={late ? 'text-amber-700' : 'text-slate-700'}>{formatDate(e.bank_date)}</span>
                          ) : (
                            <span className="text-amber-700">Not yet</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {rows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
                      <td colSpan={canEdit ? 4 : 3} className="px-4 py-3">
                        Total shown
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-green-700">
                        <span className="md:hidden text-xs font-normal text-slate-500">In </span>
                        {formatCurrency(shownDeposits)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                        <span className="md:hidden text-xs font-normal text-slate-500">Out </span>
                        {formatCurrency(shownWithdrawals)}
                      </td>
                      <td data-hide />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          <p className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100">
            Lists customer receipts, supplier payments and expenses not made in cash, and cash deposited in or drawn from
            the bank. Entries from before this period appear while they are still not in the bank. Set each one&apos;s bank
            date — the day it shows on your statement — and the reconciliation above works out what the statement should
            say. Entries on or before the bank opening date are part of the opening balance and are not listed.
          </p>
        </div>
      )}
    </div>
  )
}

function Line({ label, hint, value, strong }: { label: string; hint?: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 px-5 py-3 ${strong ? 'bg-slate-50 font-semibold text-slate-900' : 'text-slate-700'}`}>
      <dt>
        {label}
        {hint && <span className="ml-2 text-xs font-normal text-slate-400">{hint}</span>}
      </dt>
      <dd className="tabular-nums whitespace-nowrap">{value}</dd>
    </div>
  )
}

function Amount({ label, value, tone }: { label: string; value: number; tone: 'in' | 'out' }) {
  return (
    <td data-label={label} data-hide={value ? undefined : true} className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
      {value ? (
        <span className={tone === 'in' ? 'text-green-700' : 'text-slate-900'}>{formatCurrency(value)}</span>
      ) : (
        <span className="text-slate-300">—</span>
      )}
    </td>
  )
}

// Saves when the field loses focus or Enter is pressed, so a date typed digit
// by digit is not saved half-way
function BankDateCell({
  entry,
  today,
  saving,
  onSave,
}: {
  entry: BankEntry
  today: string
  saving: boolean
  onSave: (date: string | null) => void
}) {
  const [value, setValue] = useState(entry.bank_date ?? '')

  function commit() {
    if (value === (entry.bank_date ?? '')) return
    if (!value) return onSave(null)
    if (value < entry.doc_date || value > today) {
      setValue(entry.bank_date ?? '')
      return toast.error(
        value > today ? 'A bank date cannot be in the future' : `Bank date cannot be before ${formatDate(entry.doc_date)}`
      )
    }
    onSave(value)
  }

  return (
    <div className="flex items-center justify-end md:justify-start gap-1.5">
      <input
        type="date"
        aria-label={`Bank date for ${entry.doc_no}`}
        min={entry.doc_date}
        max={today}
        value={value}
        disabled={saving}
        onChange={(ev) => setValue(ev.target.value)}
        onBlur={commit}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter') commit()
        }}
        className={`w-[9.5rem] px-2 py-1 text-sm rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-300 ${
          entry.bank_date ? 'border-slate-200 text-slate-700' : 'border-amber-300 bg-amber-50/40'
        }`}
      />
      {entry.bank_date ? (
        <button
          type="button"
          aria-label={`Clear bank date for ${entry.doc_no}`}
          title="Clear bank date"
          disabled={saving}
          onClick={() => onSave(null)}
          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(entry.doc_date)}
          className="text-xs text-blue-600 hover:underline whitespace-nowrap"
          title={`Mark in bank on ${formatDate(entry.doc_date)}`}
        >
          Same day
        </button>
      )}
    </div>
  )
}
