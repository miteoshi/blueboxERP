'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { ChevronDown, ChevronRight, Download } from 'lucide-react'
import { useCan } from '@/lib/hooks/use-profile'
import { useInvoiceAgeing } from '@/lib/hooks/use-finance'
import { useBillAgeing } from '@/lib/hooks/use-payables'
import { useTdsLedger } from '@/lib/hooks/use-tds'
import { useGstLedger } from '@/lib/hooks/use-gst-payments'
import { useMoneyBalances } from '@/lib/hooks/use-money-balances'
import { ledgerSetOff } from '@/components/finance/gst-payments'
import { GST_HEADS, returnPeriodLabel } from '@/lib/gst-payments'
import { upcomingCompliance } from '@/lib/compliance'
import { buildForecast, isInflow, type Flow, type FlowKind } from '@/lib/cash-forecast'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/card'
import { TableLoader } from '@/components/ui/spinner'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils/format'
import { downloadCsv } from '@/lib/utils/csv'

const HEAD = 'bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase'
const KIND_LABEL: Record<FlowKind, string> = { receivable: 'Customer invoice', payable: 'Supplier bill', tds: 'TDS deposit', gst: 'GST payment' }

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export default function CashFlowPage() {
  const canView = useCan('viewPayables')
  const today = todayISO()
  const [countOverdueIn, setCountOverdueIn] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  const { data: invoices, isLoading: l1, error: e1 } = useInvoiceAgeing()
  const { data: bills, isLoading: l2, error: e2 } = useBillAgeing()
  const { data: tds } = useTdsLedger(today, canView)
  const { data: gst } = useGstLedger(today, canView)
  const { data: money, isLoading: l3 } = useMoneyBalances(today, today, canView)
  const isLoading = l1 || l2 || l3
  const error = e1 ?? e2

  // Cash and bank at the end of today; an account with no opening balance counts as nil
  const accounts = money ? (['cash', 'bank'] as const).map((a) => money[a]) : []
  const unset = money ? (['cash', 'bank'] as const).filter((a) => !money[a].set) : []
  const opening = accounts.reduce((s, p) => s + (p.set ? (p.end ?? 0) : 0), 0)

  const flows = useMemo<Flow[]>(() => {
    const out: Flow[] = []
    for (const i of invoices ?? []) {
      const due = Number(i.balance_due)
      if (due > 0 && i.id) out.push({ kind: 'receivable', date: i.due_date ?? i.invoice_date ?? today, amount: due, party: i.client_name ?? '', ref: i.invoice_no ?? '', href: `/invoices/${i.id}` })
    }
    for (const b of bills ?? []) {
      const due = Number(b.balance_due)
      if (due > 0 && b.id) out.push({ kind: 'payable', date: b.due_date ?? b.bill_date ?? today, amount: due, party: b.supplier_name ?? '', ref: b.bill_no ?? '', href: `/supplier-bills/${b.id}` })
    }
    if (tds?.set) {
      for (const m of tds.months) {
        if (m.outstanding > 0.004) out.push({ kind: 'tds', date: m.due_date, amount: m.outstanding, party: 'Income Tax Department', ref: `TDS for ${returnPeriodLabel(m.period)}`, href: '/tds' })
      }
    }
    if (gst?.set) {
      const cash = GST_HEADS.reduce((s, h) => s + ledgerSetOff(gst).cash[h], 0)
      const next = upcomingCompliance(today, 45).find((c) => c.key.startsWith('gstr3b-'))
      if (cash > 0.004 && next) out.push({ kind: 'gst', date: next.date, amount: Math.round(cash * 100) / 100, party: 'GST', ref: `GSTR-3B for ${returnPeriodLabel(next.period)}`, href: '/gst-payments' })
    }
    return out
  }, [invoices, bills, tds, gst, today])

  const forecast = useMemo(() => buildForecast({ today, opening, flows, countOverdueIn }), [today, opening, flows, countOverdueIn])
  const totalIn = forecast.weeks.reduce((s, w) => s + w.inflow, 0)
  const totalOut = forecast.weeks.reduce((s, w) => s + w.outflow, 0)
  const scale = Math.max(1, ...forecast.weeks.map((w) => Math.max(w.inflow, w.outflow)))

  function exportCsv() {
    const rows = forecast.weeks.flatMap((w) => w.flows.map((f) => ({ w, f })))
    downloadCsv(`cash-flow-forecast-${today}`, rows, [
      { header: 'Week starting', value: (r) => r.w.start },
      { header: 'Type', value: (r) => KIND_LABEL[r.f.kind] },
      { header: 'Due date', value: (r) => r.f.date },
      { header: 'Overdue', value: (r) => (r.f.date < today ? 'Y' : 'N') },
      { header: 'Party', value: (r) => r.f.party },
      { header: 'Document', value: (r) => r.f.ref },
      { header: 'In', value: (r) => (isInflow(r.f.kind) ? r.f.amount : '') },
      { header: 'Out', value: (r) => (isInflow(r.f.kind) ? '' : r.f.amount) },
    ])
  }

  if (!canView) {
    return (
      <div>
        <PageHeader title="Cash flow forecast" />
        <p className="text-sm text-slate-500">The forecast needs access to supplier bills (admin, manager or viewer).</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Cash flow forecast" description="The next 13 weeks: cash and bank today, plus what is due in and out">
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading}>
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </PageHeader>

      {error ? (
        <p className="text-sm text-red-600">Could not load the forecast: {error.message}</p>
      ) : isLoading ? (
        <TableLoader />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
            <StatCard label="Cash and bank now" value={formatCurrency(forecast.opening)} sub={unset.length ? `No opening balance for ${unset.join(' or ')}` : 'At the end of today'} />
            <StatCard label="Due in" value={formatCurrency(totalIn)} sub="From customers, 13 weeks" />
            <StatCard label="Due out" value={formatCurrency(totalOut)} sub="Suppliers and tax, 13 weeks" />
            <StatCard
              label="Lowest balance"
              value={formatCurrency(forecast.lowest.balance)}
              sub={forecast.lowest.balance < 0 ? `Short in the week of ${shortDate(forecast.lowest.start)}` : `Week of ${shortDate(forecast.lowest.start)}`}
              className={forecast.lowest.balance < 0 ? 'ring-1 ring-red-200' : ''}
            />
          </div>

          <div className="mb-4 space-y-2 text-sm">
            {unset.length > 0 && (
              <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Set the opening balance for {unset.join(' and ')} in the{' '}
                <Link href={'/reports/cash-book' as Route} className="font-medium underline">Cash &amp; Bank Book</Link>; until then it counts as nil.
              </p>
            )}
            {forecast.overdueOut > 0 && (
              <p className="text-slate-600">
                {formatCurrency(forecast.overdueOut)} of supplier bills and tax is already overdue and is counted in this week.
              </p>
            )}
            {forecast.overdueIn > 0 && (
              <label className="flex items-start gap-2 text-slate-600">
                <input type="checkbox" className="mt-0.5" checked={countOverdueIn} onChange={(e) => setCountOverdueIn(e.target.checked)} />
                <span>
                  Expect the {formatCurrency(forecast.overdueIn)} customers owe past the due date to come in this week{' '}
                  <Link href={'/receivables' as Route} className="text-blue-600 hover:underline">(see receivables)</Link>
                </span>
              </label>
            )}
            {(forecast.laterIn > 0 || forecast.laterOut > 0) && (
              <p className="text-xs text-slate-400">
                Due after 13 weeks, not shown:{' '}
                {[forecast.laterIn > 0 && `${formatCurrency(forecast.laterIn)} in`, forecast.laterOut > 0 && `${formatCurrency(forecast.laterOut)} out`].filter(Boolean).join(', ')}.
              </p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="stack w-full text-sm">
                <thead>
                  <tr className={HEAD}>
                    <th className="text-left px-4 py-3">Week</th>
                    <th className="text-right px-4 py-3">In</th>
                    <th className="text-right px-4 py-3">Out</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell w-48"><span className="sr-only">In and out</span></th>
                    <th className="text-right px-4 py-3">Net</th>
                    <th className="text-right px-4 py-3">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {forecast.weeks.map((w, i) => {
                    const expanded = open === w.start
                    const Icon = expanded ? ChevronDown : ChevronRight
                    return (
                      <Fragment key={w.start}>
                        <tr className={`hover:bg-slate-50 ${w.balance < 0 ? 'bg-red-50/40' : ''}`}>
                          <td data-main className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setOpen(expanded ? null : w.start)}
                              disabled={!w.flows.length}
                              aria-expanded={expanded}
                              className="inline-flex items-center gap-1.5 text-left disabled:cursor-default"
                            >
                              <Icon className={`w-4 h-4 shrink-0 ${w.flows.length ? 'text-slate-400' : 'text-transparent'}`} aria-hidden="true" />
                              <span className="font-medium text-slate-900">{shortDate(w.start)} – {shortDate(w.end)}</span>
                              {i === 0 && <span className="text-xs text-slate-400">this week</span>}
                              {w.flows.length > 0 && <span className="text-xs text-slate-400">· {w.flows.length}</span>}
                            </button>
                          </td>
                          <td data-label="In" className="px-4 py-3 text-right tabular-nums text-teal-700">{w.inflow ? formatCurrency(w.inflow) : '—'}</td>
                          <td data-label="Out" className="px-4 py-3 text-right tabular-nums text-slate-700">{w.outflow ? formatCurrency(w.outflow) : '—'}</td>
                          <td data-hide className="px-4 py-3 hidden md:table-cell" aria-hidden="true">
                            <div className="space-y-1">
                              <div className="h-1.5 rounded-full bg-teal-400" style={{ width: `${(w.inflow / scale) * 100}%` }} />
                              <div className="h-1.5 rounded-full bg-slate-400" style={{ width: `${(w.outflow / scale) * 100}%` }} />
                            </div>
                          </td>
                          <td data-label="Net" className={`px-4 py-3 text-right tabular-nums ${w.net < 0 ? 'text-red-600' : 'text-slate-700'}`}>{w.net ? formatCurrency(w.net) : '—'}</td>
                          <td data-label="Balance" className={`px-4 py-3 text-right tabular-nums font-semibold ${w.balance < 0 ? 'text-red-600' : 'text-slate-900'}`}>{formatCurrency(w.balance)}</td>
                        </tr>
                        {expanded && (
                          <tr>
                            <td colSpan={6} className="bg-slate-50 px-4 py-2">
                              <ul className="divide-y divide-slate-100">
                                {w.flows.map((f) => (
                                  <li key={`${f.kind}-${f.ref}-${f.date}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                                    <div className="min-w-0">
                                      <Link href={(f.href ?? '#') as Route} className="font-medium text-blue-600 hover:underline">{f.ref}</Link>
                                      <span className="text-slate-500"> · {f.party}</span>
                                      <div className="text-xs text-slate-400">
                                        {KIND_LABEL[f.kind]} · due {formatDate(f.date)}
                                        {f.date < today && <span className="text-red-600"> · overdue</span>}
                                      </div>
                                    </div>
                                    <span className={`tabular-nums whitespace-nowrap font-medium ${isInflow(f.kind) ? 'text-teal-700' : 'text-slate-700'}`}>
                                      {isInflow(f.kind) ? '+' : '−'} {formatCurrency(f.amount)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Based on due dates of open invoices and bills, TDS still to deposit and GST payable in cash so far. It does not include expenses, salaries or other payments that have no document yet.
          </p>
        </>
      )}
    </div>
  )
}
