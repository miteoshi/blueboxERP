'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { TableLoader } from '@/components/ui/spinner'
import { previousPeriod, useProfitAndLoss, type ProfitAndLoss } from '@/lib/hooks/use-profit-loss'
import { useRole } from '@/lib/hooks/use-profile'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { reportPeriods } from '@/lib/utils/periods'
import { downloadCsv } from '@/lib/utils/csv'
import { AlertTriangle, Download } from 'lucide-react'

// Same roles as profit_and_loss() in the database
const ROLES = ['admin', 'manager', 'viewer']

const signed = (n: number) => `${n < 0 ? '−' : ''}${formatCurrency(Math.abs(n))}`
const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1).replace('-', '−')}%` : '—')

type Line = {
  key: string
  label: string
  value: (p: ProfitAndLoss) => number
  kind?: 'total' | 'grand' | 'sub'
  // A cost shown in brackets: it is taken away from the line above
  less?: boolean
  href?: string
}

export default function ProfitAndLossPage() {
  const role = useRole()
  const presets = reportPeriods()
  const thisFy = presets[presets.length - 1]
  const [from, setFrom] = useState(thisFy.from)
  const [to, setTo] = useState(thisFy.to)
  const [compare, setCompare] = useState(true)

  const allowed = !!role && ROLES.includes(role)
  const valid = !!from && !!to && from <= to
  const prev = valid ? previousPeriod(from, to) : null

  const { data: pl, isLoading, error } = useProfitAndLoss(from, to, allowed && valid)
  const { data: before } = useProfitAndLoss(prev?.from ?? '', prev?.to ?? '', allowed && valid && compare)

  if (role && !allowed) {
    return (
      <div>
        <PageHeader title="Profit & Loss" description="Sales, cost of goods and expenses for a period" />
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          Your role cannot see the profit and loss.
        </div>
      </div>
    )
  }

  const lines: Line[] = [
    { key: 'invoiced', label: 'Sales invoiced', value: (p) => p.sales.invoiced, href: '/reports/sales' },
    { key: 'credited', label: 'Less: credit notes', value: (p) => p.sales.credit_notes, less: true, href: '/credit-notes' },
    { key: 'net_sales', label: 'Net sales', value: (p) => p.sales.net, kind: 'total' },
    { key: 'opening', label: 'Opening stock', value: (p) => p.stock.opening, kind: 'sub' },
    { key: 'received', label: 'Add: goods received', value: (p) => p.stock.received, kind: 'sub' },
    { key: 'returned', label: 'Less: returned to suppliers', value: (p) => p.stock.returned_to_suppliers, kind: 'sub', less: true },
    { key: 'closing', label: 'Less: closing stock', value: (p) => p.stock.closing, kind: 'sub', less: true },
    { key: 'cogs', label: 'Cost of goods sold', value: (p) => p.stock.cost_of_goods_sold, less: true },
    { key: 'gross', label: 'Gross profit', value: (p) => p.gross_profit, kind: 'total' },
  ]

  // Expense heads from both periods, so the comparison lines up
  const heads = Array.from(
    new Set([...(pl?.expenses ?? []).map((e) => e.head), ...(compare && before ? before.expenses.map((e) => e.head) : [])])
  )
  const headAmount = (p: ProfitAndLoss | undefined, head: string) => p?.expenses.find((e) => e.head === head)?.amount ?? 0

  function exportCsv() {
    if (!pl) return
    const rows: { label: string; now: number; then: number | null }[] = [
      ...lines.map((l) => ({ label: l.label, now: l.value(pl), then: compare && before ? l.value(before) : null })),
      ...heads.map((h) => ({ label: `Expense: ${h}`, now: headAmount(pl, h), then: compare && before ? headAmount(before, h) : null })),
      { label: 'Total expenses', now: pl.expenses_total, then: compare && before ? before.expenses_total : null },
      { label: 'Net profit', now: pl.net_profit, then: compare && before ? before.net_profit : null },
    ]
    downloadCsv(`profit-and-loss-${from}_${to}`, rows, [
      { header: 'Line', value: (r) => r.label },
      { header: `${from} to ${to}`, value: (r) => r.now },
      ...(compare && before && prev ? [{ header: `${prev.from} to ${prev.to}`, value: (r: (typeof rows)[number]) => r.then }] : []),
    ])
  }

  const showThen = compare && !!before
  const cols = showThen ? 3 : 2

  return (
    <div>
      <PageHeader title="Profit & Loss" description="Net sales, cost of goods sold and expenses for a period, from the books in this app">
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!pl}>
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </PageHeader>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <Input label="From" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-slate-700 pb-2">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="rounded border-slate-300" />
            Compare with the period before<span className="sm:hidden text-slate-400"> (wider screens)</span>
          </label>
        </div>
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
        {!valid && <p className="text-sm text-red-600">The period must start on or before the day it ends</p>}
      </div>

      {error ? (
        <div className="bg-white rounded-xl border border-red-200 p-6 text-sm text-red-700">
          {(error as Error).message || 'The profit and loss could not be worked out.'}
        </div>
      ) : isLoading || !pl ? (
        valid && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <TableLoader />
          </div>
        )
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Net sales" value={formatCurrency(pl.sales.net)} sub={`${pl.sales.invoices} ${pl.sales.invoices === 1 ? 'invoice' : 'invoices'}`} />
            <StatCard label="Gross profit" value={signed(pl.gross_profit)} sub={`${pct(pl.gross_profit, pl.sales.net)} of net sales`} />
            <StatCard label="Expenses" value={formatCurrency(pl.expenses_total)} sub={`${pct(pl.expenses_total, pl.sales.net)} of net sales`} />
            <StatCard
              label={pl.net_profit < 0 ? 'Net loss' : 'Net profit'}
              value={signed(pl.net_profit)}
              sub={`${pct(pl.net_profit, pl.sales.net)} of net sales`}
              className={pl.net_profit < 0 ? 'border-amber-200' : 'border-green-200'}
            />
          </div>

          {(pl.stock.items_without_cost > 0 || pl.stock.items_on_price_list > 0 || pl.stock.items_on_bom > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-900 flex gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
              <div className="space-y-1 min-w-0">
                {pl.stock.items_without_cost > 0 && (
                  <p>
                    <strong>
                      {pl.stock.items_without_cost} {pl.stock.items_without_cost === 1 ? 'item has' : 'items have'} no cost
                    </strong>{' '}
                    (never received with a rate, no purchase rate in the price list, no bill of material), so {pl.stock.items_without_cost === 1 ? 'it is' : 'they are'} counted at nil
                    and cost of goods sold may be off: {pl.stock.items_without_cost_sample.join(', ')}
                    {pl.stock.items_without_cost > pl.stock.items_without_cost_sample.length ? ', …' : ''}. Set a purchase rate under{' '}
                    <Link href={'/settings' as Route} className="underline">
                      Settings
                    </Link>
                    .
                  </p>
                )}
                {(pl.stock.items_on_price_list > 0 || pl.stock.items_on_bom > 0) && (
                  <p>
                    {[
                      pl.stock.items_on_price_list > 0 &&
                        `${pl.stock.items_on_price_list} ${pl.stock.items_on_price_list === 1 ? 'item is' : 'items are'} valued at the price-list purchase rate`,
                      pl.stock.items_on_bom > 0 &&
                        `${pl.stock.items_on_bom} manufactured ${pl.stock.items_on_bom === 1 ? 'item is' : 'items are'} valued at today’s bill-of-material cost`,
                    ]
                      .filter(Boolean)
                      .join('; ')}
                    , because {pl.stock.items_on_price_list + pl.stock.items_on_bom === 1 ? 'it has' : 'they have'} never been received with a rate.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* No sideways scrolling here: line names wrap, and on a phone only the chosen period is shown */}
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                    <th className="text-left px-4 py-3" />
                    <th className="text-right px-3 sm:px-4 py-3 sm:whitespace-nowrap">
                      {formatDate(from)} – {formatDate(to)}
                    </th>
                    {showThen && prev && (
                      <th className="hidden sm:table-cell text-right px-4 py-3 whitespace-nowrap text-slate-400">
                        {formatDate(prev.from)} – {formatDate(prev.to)}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {lines.map((l) => (
                    <Row key={l.key} line={l} now={l.value(pl)} then={showThen && before ? l.value(before) : null} />
                  ))}
                  <tr>
                    <td colSpan={cols} className="px-3 sm:px-4 pt-5 pb-1 text-xs font-semibold text-slate-500 uppercase">
                      Expenses
                    </td>
                  </tr>
                  {heads.length === 0 && (
                    <tr>
                      <td colSpan={cols} className="px-3 sm:px-4 py-2 pl-6 sm:pl-8 text-slate-400">
                        No expenses recorded in this period
                      </td>
                    </tr>
                  )}
                  {heads.map((h) => (
                    <Row
                      key={h}
                      // A head used only in the earlier period has nothing to show where that column is hidden
                      phoneHidden={!headAmount(pl, h)}
                      line={{ key: h, label: h, value: () => 0, kind: 'sub', less: true }}
                      now={headAmount(pl, h)}
                      then={showThen ? headAmount(before, h) : null}
                    />
                  ))}
                  <Row
                    line={{ key: 'exp', label: 'Total expenses', value: () => 0, less: true, href: '/expenses' }}
                    now={pl.expenses_total}
                    then={showThen && before ? before.expenses_total : null}
                  />
                  <Row
                    line={{ key: 'net', label: pl.net_profit < 0 ? 'Net loss' : 'Net profit', value: () => 0, kind: 'grand' }}
                    now={pl.net_profit}
                    then={showThen && before ? before.net_profit : null}
                  />
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100 space-y-1">
              <p>
                Sales are taxable value: GST is collected for the government, not income. Cost of goods sold is opening stock,
                plus goods received, less goods returned to suppliers, less closing stock — so wastage and stock corrections
                are part of it. Stock is valued at a running average purchase cost per item, from the stock ledger.
              </p>
              <p>
                Expenses are as recorded, GST included. Depreciation, interest, income tax and anything not recorded in this
                app are not included, so this is a management view, not your audited accounts.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Row({ line, now, then, phoneHidden }: { line: Line; now: number; then: number | null; phoneHidden?: boolean }) {
  const strong = line.kind === 'total' || line.kind === 'grand'
  const money = (n: number) => (line.less ? (n ? `(${formatCurrency(Math.abs(n))})` : '—') : signed(n))
  return (
    <tr
      className={[
        line.kind === 'grand'
          ? 'bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900'
          : line.kind === 'total'
            ? 'bg-slate-50/60 font-semibold text-slate-900'
            : '',
        phoneHidden ? 'max-sm:hidden' : '',
      ].join(' ')}
    >
      <td className={`px-3 sm:px-4 py-2.5 ${line.kind === 'sub' ? 'pl-6 sm:pl-8 text-slate-600' : strong ? '' : 'text-slate-800'}`}>
        {line.href ? (
          <Link href={line.href as Route} className="hover:text-blue-600 hover:underline">
            {line.label}
          </Link>
        ) : (
          line.label
        )}
      </td>
      <td className={`px-3 sm:px-4 py-2.5 text-right tabular-nums whitespace-nowrap ${!line.less && now < 0 ? 'text-amber-700' : ''}`}>
        {money(now)}
      </td>
      {then !== null && (
        <td className={`hidden sm:table-cell px-4 py-2.5 text-right tabular-nums whitespace-nowrap text-slate-400 ${!line.less && then < 0 ? 'text-amber-600' : ''}`}>
          {money(then)}
        </td>
      )}
    </tr>
  )
}
