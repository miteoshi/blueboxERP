'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/card'
import { TableLoader } from '@/components/ui/spinner'
import { useClientReceivables, useInvoiceAgeing } from '@/lib/hooks/use-finance'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils/format'
import { downloadCsv } from '@/lib/utils/csv'
import { AlertTriangle, ChevronDown, ChevronRight, Download, IndianRupee, Clock } from 'lucide-react'

const BUCKETS = [
  { key: 'not_due', label: 'Not due' },
  { key: 'overdue_1_30', label: '1–30 days' },
  { key: 'overdue_31_60', label: '31–60' },
  { key: 'overdue_61_90', label: '61–90' },
  { key: 'overdue_90_plus', label: '90+' },
] as const

const money = (n: number | null | undefined) => (n ? formatCurrency(n) : '—')

export default function ReceivablesPage() {
  const { data: rows, isLoading } = useClientReceivables()
  const { data: ageing } = useInvoiceAgeing()
  const [open, setOpen] = useState<string | null>(null)

  const totals = useMemo(() => {
    const list = rows ?? []
    const sum = (k: keyof NonNullable<typeof rows>[number]) =>
      list.reduce((s, r) => s + (Number(r[k]) || 0), 0)
    return {
      outstanding: sum('outstanding'),
      overdue: sum('overdue'),
      over90: sum('overdue_90_plus'),
      unapplied: sum('unallocated_credit'),
      buckets: Object.fromEntries(BUCKETS.map((b) => [b.key, sum(b.key)])) as Record<(typeof BUCKETS)[number]['key'], number>,
    }
  }, [rows])

  // Weighted average days to collect what is overdue (simple DSO proxy)
  const avgDaysOverdue = useMemo(() => {
    const overdue = (ageing ?? []).filter((a) => (a.days_overdue ?? 0) > 0)
    const amount = overdue.reduce((s, a) => s + (a.balance_due ?? 0), 0)
    if (!amount) return 0
    return Math.round(overdue.reduce((s, a) => s + (a.days_overdue ?? 0) * (a.balance_due ?? 0), 0) / amount)
  }, [ageing])

  const withBalance = (rows ?? []).filter((r) => (r.outstanding ?? 0) > 0 || (r.unallocated_credit ?? 0) > 0)

  function exportCsv() {
    downloadCsv(`receivables-ageing-${todayISO()}`, withBalance, [
      { header: 'Client', value: (r) => r.client_name },
      { header: 'Outstanding', value: (r) => r.outstanding },
      ...BUCKETS.map((b) => ({ header: b.label, value: (r: (typeof withBalance)[number]) => r[b.key] })),
      { header: 'Unapplied credit', value: (r) => r.unallocated_credit },
      { header: 'Credit limit', value: (r) => r.credit_limit },
      { header: 'Credit days', value: (r) => r.credit_days },
      { header: 'Oldest overdue (days)', value: (r) => r.max_days_overdue },
    ])
  }

  return (
    <div>
      <PageHeader title="Receivables" description="Who owes what, and for how long">
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={withBalance.length === 0}>
          <Download className="w-4 h-4" />
          Export ageing
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total outstanding" value={formatCurrency(totals.outstanding)} icon={<IndianRupee className="w-5 h-5" />} />
        <StatCard
          label="Overdue"
          value={formatCurrency(totals.overdue)}
          sub={totals.outstanding ? `${Math.round((totals.overdue / totals.outstanding) * 100)}% of outstanding` : undefined}
          icon={<AlertTriangle className="w-5 h-5" />}
        />
        <StatCard label="Over 90 days" value={formatCurrency(totals.over90)} sub="Consider follow-up or provision" />
        <StatCard
          label="Avg. days overdue"
          value={avgDaysOverdue ? `${avgDaysOverdue} days` : '—'}
          sub={totals.unapplied ? `${formatCurrency(totals.unapplied)} unapplied credit` : 'Weighted by amount'}
          icon={<Clock className="w-5 h-5" />}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <TableLoader />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="text-left px-4 py-3">Client</th>
                  <th className="text-right px-4 py-3">Outstanding</th>
                  {BUCKETS.map((b) => (
                    <th key={b.key} className="text-right px-4 py-3">
                      {b.label}
                    </th>
                  ))}
                  <th className="text-right px-4 py-3">Credit used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {withBalance.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400 text-sm">
                      Nothing outstanding
                    </td>
                  </tr>
                )}
                {withBalance.map((r) => {
                  const limit = r.credit_limit ?? 0
                  const used = limit > 0 ? Math.round(((r.outstanding ?? 0) / limit) * 100) : null
                  const expanded = open === r.client_id
                  return (
                    <Fragment key={r.client_id}>
                      <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => setOpen(expanded ? null : r.client_id)}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 font-medium text-slate-900">
                            {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            {r.client_name}
                          </div>
                          {(r.unallocated_credit ?? 0) > 0 && (
                            <div className="text-xs text-teal-600 ml-6">{formatCurrency(r.unallocated_credit)} unapplied credit</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">{money(r.outstanding)}</td>
                        {BUCKETS.map((b) => (
                          <td
                            key={b.key}
                            className={`px-4 py-3 text-right tabular-nums ${
                              b.key === 'overdue_90_plus' && (r[b.key] ?? 0) > 0
                                ? 'text-red-600 font-medium'
                                : b.key !== 'not_due' && (r[b.key] ?? 0) > 0
                                  ? 'text-amber-600'
                                  : 'text-slate-600'
                            }`}
                          >
                            {money(r[b.key])}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right">
                          {used === null ? (
                            <span className="text-xs text-slate-300">No limit</span>
                          ) : (
                            <span className={`text-xs font-medium ${used > 100 ? 'text-red-600' : used > 80 ? 'text-amber-600' : 'text-slate-600'}`}>
                              {used}% of {formatCurrency(limit)}
                            </span>
                          )}
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={8} className="bg-slate-50 px-10 py-3">
                            <ClientInvoices clientId={r.client_id ?? ''} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
              {withBalance.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(totals.outstanding)}</td>
                    {BUCKETS.map((b) => (
                      <td key={b.key} className="px-4 py-3 text-right tabular-nums">
                        {money(totals.buckets[b.key])}
                      </td>
                    ))}
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function ClientInvoices({ clientId }: { clientId: string }) {
  const { data, isLoading } = useInvoiceAgeing(clientId)
  if (isLoading) return <p className="text-xs text-slate-400">Loading…</p>
  if (!data?.length) return <p className="text-xs text-slate-500">No open invoices — only unapplied credit.</p>
  return (
    <table className="w-full text-xs">
      <tbody>
        {data.map((i) => (
          <tr key={i.id}>
            <td className="py-1">
              <Link href={`/invoices/${i.id}` as Route} className="font-mono text-blue-600 hover:underline">
                {i.invoice_no}
              </Link>
            </td>
            <td className="py-1 text-slate-500">{formatDate(i.invoice_date)}</td>
            <td className="py-1 text-slate-500">due {formatDate(i.due_date)}</td>
            <td className={`py-1 ${(i.days_overdue ?? 0) > 0 ? 'text-red-600' : 'text-slate-500'}`}>
              {(i.days_overdue ?? 0) > 0 ? `${i.days_overdue} days overdue` : 'not due'}
            </td>
            <td className="py-1 text-right tabular-nums">{formatCurrency(i.total_amount)}</td>
            <td className="py-1 text-right tabular-nums font-medium">{formatCurrency(i.balance_due)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
