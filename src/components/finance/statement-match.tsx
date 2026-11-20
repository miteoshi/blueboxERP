'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TableLoader } from '@/components/ui/spinner'
import {
  EMPTY_MAP,
  closingBalance,
  detectColumns,
  matchStatement,
  readStatementGrid,
  readStatementLines,
  type Cell,
  type ColumnMap,
  type Confidence,
  type StatementLine,
} from '@/lib/bank-statement'
import { useBankBook, useSetBankDates } from '@/lib/hooks/use-bank-reconciliation'
import { useExpenseHeads, useRecordExpense } from '@/lib/hooks/use-expenses'
import { useIncomeHeads, useRecordOtherIncome } from '@/lib/hooks/use-other-income'
import { PAYMENT_MODES, type PaymentMode } from '@/lib/hooks/use-finance'
import { EXPENSE_RULES, INCOME_RULES, suggestHead } from '@/lib/money-entries'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils/format'
import { FileUp, X } from 'lucide-react'

const MAX_BYTES = 5 * 1024 * 1024
const MAX_LINES = 5000
const BATCH = 500

const FIELDS: { key: keyof ColumnMap; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'description', label: 'Description' },
  { key: 'reference', label: 'Cheque / ref no.' },
  { key: 'withdrawal', label: 'Withdrawal' },
  { key: 'deposit', label: 'Deposit' },
  { key: 'amount', label: 'Amount (one column)' },
  { key: 'drcr', label: 'Dr / Cr' },
  { key: 'balance', label: 'Balance' },
]

const CONFIDENCE: Record<Confidence, { label: string; variant: 'success' | 'info' | 'warning' }> = {
  reference: { label: 'Cheque / ref no. matches', variant: 'success' },
  amount: { label: 'Only entry with this amount', variant: 'info' },
  check: { label: 'Same amount as others — check', variant: 'warning' },
}

const lineKey = (l: StatementLine) => String(l.row)

export function StatementMatch({
  canEdit,
  onClose,
  onUseClosing,
}: {
  canEdit: boolean
  onClose: () => void
  onUseClosing: (date: string, balance: number) => void
}) {
  const [fileName, setFileName] = useState('')
  const [grid, setGrid] = useState<Cell[][] | null>(null)
  const [headerRow, setHeaderRow] = useState(0)
  const [map, setMap] = useState<ColumnMap>(EMPTY_MAP)
  const [problem, setProblem] = useState('')
  const [reading, setReading] = useState(false)
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)
  const save = useSetBankDates()

  async function pick(file: File | undefined) {
    if (!file) return
    setProblem('')
    setGrid(null)
    setSkipped(new Set())
    setFileName(file.name)
    if (file.size > MAX_BYTES) return setProblem('That file is larger than 5 MB. Export a shorter period from your bank.')
    setReading(true)
    try {
      const g = await readStatementGrid(file)
      const found = detectColumns(g)
      setGrid(g)
      if (found) {
        setHeaderRow(found.headerRow)
        setMap(found.map)
      } else {
        setHeaderRow(0)
        setMap(EMPTY_MAP)
        setProblem('Could not find the date and amount columns. Choose them below.')
      }
    } catch {
      setProblem('Could not read that file. Download the statement from your bank as CSV or Excel and try again.')
    } finally {
      setReading(false)
    }
  }

  const lines = useMemo(() => (grid ? readStatementLines(grid, headerRow, map) : []), [grid, headerRow, map])
  const today = todayISO()
  const first = lines.reduce<string | null>((m, l) => (!m || l.date < m ? l.date : m), null)
  const lastRaw = lines.reduce<string | null>((m, l) => (!m || l.date > m ? l.date : m), null)
  const last = lastRaw && lastRaw > today ? today : lastRaw
  const tooMany = lines.length > MAX_LINES
  const { data: entries, isLoading: loadingEntries } = useBankBook(first && last && !tooMany ? first : '', last ?? '')
  const result = useMemo(() => (entries && !tooMany ? matchStatement(lines, entries) : null), [entries, lines, tooMany])
  const closing = useMemo(() => closingBalance(lines), [lines])

  const chosen = (result?.matches ?? []).filter((m) => !skipped.has(lineKey(m.line)))
  // Lines the matcher was unsure about start unticked
  function initialSkip() {
    return new Set((result?.matches ?? []).filter((m) => m.confidence === 'check').map((m) => lineKey(m.line)))
  }
  const [seeded, setSeeded] = useState<typeof result>(null)
  if (result && seeded !== result) {
    setSeeded(result)
    setSkipped(initialSkip())
  }

  async function apply() {
    if (chosen.length === 0) return toast.error('Tick at least one match')
    const payload = chosen.map((m) => ({ doc_type: m.entry.kind, doc_id: m.entry.doc_id, bank_date: m.line.date }))
    setApplying(true)
    try {
      for (let i = 0; i < payload.length; i += BATCH) await save.mutateAsync(payload.slice(i, i + BATCH))
    } catch {
      // the hook has already shown the error
    } finally {
      setApplying(false)
    }
  }

  const headers = grid?.[headerRow]?.map((c, i) => ({ i, name: c === null || c === undefined ? `Column ${i + 1}` : String(c) || `Column ${i + 1}` })) ?? []

  return (
    <div className="bg-white rounded-xl border border-blue-200 shadow-sm mb-6">
      <div className="flex items-start justify-between gap-3 px-5 py-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Match a bank statement</h3>
          <p className="text-xs text-slate-500">
            Download your statement from net banking as CSV or Excel. It is read here in your browser and not uploaded.
          </p>
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-5 py-4 space-y-4">
        <label className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
            <FileUp className="w-4 h-4" />
            {fileName ? 'Choose another file' : 'Choose statement file'}
          </span>
          <input
            type="file"
            accept=".csv,.xls,.xlsx,text/csv"
            className="sr-only"
            onChange={(e) => {
              pick(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          {fileName && <span className="text-sm text-slate-600 break-all">{fileName}</span>}
        </label>

        {problem && <p className="text-sm text-amber-700">{problem}</p>}
        {reading && <TableLoader />}

        {grid && (
          <details className="text-sm" open={!!problem || lines.length === 0}>
            <summary className="cursor-pointer text-slate-600">
              Columns {lines.length > 0 && <span className="text-slate-400">— {lines.length} lines read</span>}
            </summary>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="text-xs text-slate-600">
                Header row
                <select
                  value={headerRow}
                  onChange={(e) => setHeaderRow(Number(e.target.value))}
                  className="mt-1 w-full px-2 py-1.5 text-sm rounded-md border border-slate-200 bg-white"
                >
                  {grid.slice(0, 40).map((r, i) => (
                    <option key={i} value={i}>
                      Row {i + 1}: {r.filter((c) => c !== null && c !== '').slice(0, 3).map(String).join(', ').slice(0, 40) || '(blank)'}
                    </option>
                  ))}
                </select>
              </label>
              {FIELDS.map((f) => (
                <label key={f.key} className="text-xs text-slate-600">
                  {f.label}
                  <select
                    value={map[f.key] ?? ''}
                    onChange={(e) => setMap((m) => ({ ...m, [f.key]: e.target.value === '' ? null : Number(e.target.value) }))}
                    className="mt-1 w-full px-2 py-1.5 text-sm rounded-md border border-slate-200 bg-white"
                  >
                    <option value="">—</option>
                    {headers.map((h) => (
                      <option key={h.i} value={h.i}>
                        {h.name.slice(0, 40)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Use either Withdrawal and Deposit columns, or one Amount column with Dr / Cr. Dates are read day first, as Indian
              banks write them.
            </p>
          </details>
        )}

        {tooMany && <p className="text-sm text-amber-700">More than {MAX_LINES} lines. Export a shorter period from your bank.</p>}
        {grid && lines.length > 0 && !tooMany && loadingEntries && <TableLoader />}

        {result && (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700">
              <span>
                {lines.length} lines, {first && formatDate(first)} – {lastRaw && formatDate(lastRaw)}
              </span>
              <span className="text-green-700 font-medium">{result.matches.length} matched</span>
              {result.alreadyTicked.length > 0 && <span className="text-slate-500">{result.alreadyTicked.length} already ticked off</span>}
              <span className={result.bankOnly.length ? 'text-amber-700 font-medium' : 'text-slate-500'}>
                {result.bankOnly.length} not in the app
              </span>
            </div>

            {closing && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>
                  Statement closing balance on {formatDate(closing.date)}:{' '}
                  <span className="font-semibold tabular-nums">
                    {closing.balance < 0 ? '−' : ''}
                    {formatCurrency(Math.abs(closing.balance))}
                  </span>
                </span>
                <Button size="sm" variant="outline" onClick={() => onUseClosing(closing.date, closing.balance)}>
                  Reconcile on this day
                </Button>
              </div>
            )}

            {result.matches.length > 0 && (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="stack w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                        {canEdit && (
                          <th className="px-3 py-2 w-8">
                            <input
                              type="checkbox"
                              aria-label="Tick all matches"
                              checked={chosen.length === result.matches.length}
                              onChange={() =>
                                setSkipped(chosen.length === result.matches.length ? new Set(result.matches.map((m) => lineKey(m.line))) : new Set())
                              }
                            />
                          </th>
                        )}
                        <th className="text-left px-3 py-2">On the statement</th>
                        <th className="text-right px-3 py-2">Amount</th>
                        <th className="text-left px-3 py-2">In the app</th>
                        <th className="text-left px-3 py-2">Match</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {result.matches.map((m) => {
                        const k = lineKey(m.line)
                        const on = !skipped.has(k)
                        const toggle = () =>
                          setSkipped((s) => {
                            const next = new Set(s)
                            if (next.has(k)) next.delete(k)
                            else next.add(k)
                            return next
                          })
                        return (
                          <tr key={k} className={on ? undefined : 'opacity-60'}>
                            {canEdit && (
                              <td data-hide className="px-3 py-2">
                                <input type="checkbox" aria-label={`Use match for row ${m.line.row}`} checked={on} onChange={toggle} />
                              </td>
                            )}
                            <td data-main className="px-3 py-2">
                              <div className="flex items-start gap-2">
                                {canEdit && (
                                  <input type="checkbox" className="mt-1 md:hidden" aria-label={`Use match for row ${m.line.row}`} checked={on} onChange={toggle} />
                                )}
                                <div className="min-w-0">
                                  <div className="text-slate-900 whitespace-nowrap">{formatDate(m.line.date)}</div>
                                  <div className="text-xs text-slate-500 break-words">
                                    {[m.line.description, m.line.reference].filter(Boolean).join(' · ') || `Row ${m.line.row}`}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <StatementAmount line={m.line} />
                            <td data-label="In the app" className="px-3 py-2">
                              <span className="font-mono font-semibold text-slate-900 whitespace-nowrap">{m.entry.doc_no}</span>
                              <div className="text-xs text-slate-500">
                                {m.entry.party} · {formatDate(m.entry.doc_date)}
                                {m.days > 0 ? ` · ${m.days} day${m.days === 1 ? '' : 's'} before` : ''}
                              </div>
                            </td>
                            <td data-label="Match" className="px-3 py-2">
                              <Badge variant={CONFIDENCE[m.confidence].variant}>{CONFIDENCE[m.confidence].label}</Badge>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {canEdit && (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-t border-slate-200">
                    <span className="text-xs text-slate-500">Each ticked entry gets the statement date as its bank date.</span>
                    <Button size="sm" loading={applying} disabled={chosen.length === 0} onClick={apply}>
                      Set {chosen.length} bank date{chosen.length === 1 ? '' : 's'}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {result.bankOnly.length > 0 && (
              <div className="rounded-lg border border-amber-200">
                <div className="px-3 py-2 bg-amber-50 border-b border-amber-200">
                  <p className="text-sm font-medium text-slate-900">On the statement but not in the app</p>
                  <p className="text-xs text-slate-600">
                    {canEdit ? 'Record bank charges as an expense and interest as other income right here; ' : 'Bank charges go in Expenses and interest in Other Income; '}
                    money from customers goes in{' '}
                    <Link href={'/payments' as Route} className="text-blue-600 hover:underline">
                      Payments Received
                    </Link>
                    , GST challans in{' '}
                    <Link href={'/gst-payments' as Route} className="text-blue-600 hover:underline">
                      GST Payments
                    </Link>
                    , TDS challans in{' '}
                    <Link href={'/tds' as Route} className="text-blue-600 hover:underline">
                      TDS
                    </Link>{' '}
                    and loan EMIs or capital in{' '}
                    <Link href={'/capital-loans' as Route} className="text-blue-600 hover:underline">
                      Capital &amp; Loans
                    </Link>
                    , then match the statement again.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="stack w-full text-sm">
                    <tbody className="divide-y divide-slate-50">
                      {result.bankOnly.map((l) => (
                        <BankOnlyRow key={lineKey(l)} line={l} canEdit={canEdit} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.matches.length === 0 && result.bankOnly.length === 0 && (
              <p className="text-sm text-slate-600">Every line on this statement is already ticked off.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const BANK_MODES = PAYMENT_MODES.filter((m) => m.value !== 'cash')

// A statement line not in the app, with a way to record it as an expense or
// other income that is then ticked off on the statement date
function BankOnlyRow({ line, canEdit }: { line: StatementLine; canEdit: boolean }) {
  const isOut = line.withdrawal > 0
  const { data: expenseHeads } = useExpenseHeads()
  const { data: incomeHeads } = useIncomeHeads()
  const recordExpense = useRecordExpense()
  const recordIncome = useRecordOtherIncome()
  const setDates = useSetBankDates()
  const heads = (isOut ? expenseHeads : incomeHeads) ?? []
  const [open, setOpen] = useState(false)
  const [headId, setHeadId] = useState('')
  const [party, setParty] = useState('')
  const [mode, setMode] = useState<PaymentMode>('bank_transfer')
  const [saving, setSaving] = useState(false)
  const amount = isOut ? line.withdrawal : line.deposit

  function start() {
    setHeadId(suggestHead(heads, `${line.description} ${line.reference}`, isOut ? EXPENSE_RULES : INCOME_RULES))
    setParty(isOut ? '' : /interest|\bint\b/i.test(line.description) ? 'Bank' : '')
    setOpen(true)
  }

  async function save() {
    if (!headId) return toast.error(`Choose an ${isOut ? 'expense' : 'income'} head`)
    if (line.date > todayISO()) return toast.error('The statement date is in the future')
    setSaving(true)
    try {
      const input = {
        headId,
        amount,
        mode,
        date: line.date,
        party: party.trim() || undefined,
        reference: line.reference || undefined,
        notes: line.description ? `Bank statement: ${line.description}`.slice(0, 200) : undefined,
      }
      const saved = isOut ? await recordExpense.mutateAsync(input) : await recordIncome.mutateAsync(input)
      // Ticked off on the statement date, so the line drops into "already ticked off"
      await setDates.mutateAsync([{ doc_type: isOut ? 'expense' : 'income', doc_id: saved.id, bank_date: line.date }])
      setOpen(false)
    } catch {
      // the hooks have shown the error; an entry saved before a failed tick-off can be ticked off in the list below
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <tr>
        <td data-main className="px-3 py-2">
          <div className="text-slate-900 whitespace-nowrap">{formatDate(line.date)}</div>
          <div className="text-xs text-slate-500 break-words">
            {[line.description, line.reference].filter(Boolean).join(' · ') || `Row ${line.row}`}
          </div>
        </td>
        <StatementAmount line={line} />
        <td data-hide={canEdit && !open ? undefined : true} className="px-3 py-2 text-right">
          {canEdit && !open && (
            <button type="button" onClick={start} className="text-xs text-blue-600 hover:underline whitespace-nowrap">
              Record as {isOut ? 'expense' : 'income'}
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={3} className="bg-blue-50/60 px-3 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
              <label className="text-xs text-slate-600">
                {isOut ? 'Expense head' : 'Income head'}
                <select
                  value={headId}
                  onChange={(e) => setHeadId(e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 text-sm rounded-md border border-slate-300 bg-white"
                >
                  <option value="">Choose…</option>
                  {heads.filter((h) => h.is_active).map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-600">
                {isOut ? 'Paid to' : 'Received from'}
                <input
                  value={party}
                  onChange={(e) => setParty(e.target.value)}
                  placeholder={isOut ? 'e.g. HDFC Bank' : 'e.g. Bank'}
                  className="mt-1 w-full px-2 py-1.5 text-sm rounded-md border border-slate-300 bg-white"
                />
              </label>
              <label className="text-xs text-slate-600">
                Mode
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as PaymentMode)}
                  className="mt-1 w-full px-2 py-1.5 text-sm rounded-md border border-slate-300 bg-white"
                >
                  {BANK_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2 sm:justify-end">
                <Button size="sm" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                  Close
                </Button>
                <Button size="sm" loading={saving} onClick={save}>
                  Save {formatCurrency(amount)}
                </Button>
              </div>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Saved as {isOut ? 'an expense' : 'other income'} dated {formatDate(line.date)} and ticked off on the same day.
            </p>
          </td>
        </tr>
      )}
    </>
  )
}

function StatementAmount({ line }: { line: StatementLine }) {
  return (
    <td data-label={line.deposit ? 'Deposit' : 'Withdrawal'} className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
      {line.deposit ? (
        <span className="text-green-700">+{formatCurrency(line.deposit)}</span>
      ) : (
        <span className="text-slate-900">−{formatCurrency(line.withdrawal)}</span>
      )}
    </td>
  )
}
