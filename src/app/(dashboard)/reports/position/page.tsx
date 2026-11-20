'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { TableLoader } from '@/components/ui/spinner'
import { useFinancialPosition, type FinancialPosition } from '@/lib/hooks/use-financial-position'
import { useRole } from '@/lib/hooks/use-profile'
import { financialYear } from '@/lib/gst'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils/format'
import { monthRange } from '@/lib/utils/periods'
import { downloadCsv } from '@/lib/utils/csv'
import { AlertTriangle, Download } from 'lucide-react'

// Same roles as financial_position() in the database
const ROLES = ['admin', 'manager', 'viewer']

const r2 = (n: number) => Math.round(n * 100) / 100
const signed = (n: number) => `${n < 0 ? '−' : ''}${formatCurrency(Math.abs(r2(n)))}`
const dayBefore = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
}

type Line = {
  key: string
  label: string
  value: (p: FinancialPosition) => number | null
  detail?: (p: FinancialPosition) => string
  kind?: 'total' | 'grand'
  href?: string
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const OWNED: Line[] = [
  { key: 'cash', label: 'Cash in hand', value: (p) => p.cash.amount, href: '/reports/cash-book' },
  { key: 'bank', label: 'Bank', value: (p) => p.bank.amount, href: '/reports/bank-reconciliation' },
  {
    key: 'receivables',
    label: 'Owed by customers',
    value: (p) => p.receivables.amount,
    detail: (p) => plural(p.receivables.parties, 'customer', 'customers'),
    href: '/receivables',
  },
  {
    key: 'supplier_advances',
    label: 'Advances paid to suppliers',
    value: (p) => p.supplier_advances.amount,
    detail: (p) => plural(p.supplier_advances.parties, 'supplier', 'suppliers'),
    href: '/payables',
  },
  { key: 'stock', label: 'Stock, at average cost', value: (p) => p.stock.amount, href: '/reports/stock-valuation' },
  {
    key: 'fixed_assets',
    label: 'Fixed assets, at book value',
    value: (p) => p.fixed_assets.amount,
    detail: (p) => plural(p.fixed_assets.assets, 'asset', 'assets'),
    href: '/fixed-assets',
  },
  {
    key: 'gst_credit',
    label: 'GST credit in hand',
    value: (p) => (p.gst.balance === null ? null : Math.max(0, -p.gst.balance)),
    href: '/gst-payments',
  },
]

const OWED: Line[] = [
  {
    key: 'payables',
    label: 'Owed to suppliers',
    value: (p) => p.payables.amount,
    detail: (p) => plural(p.payables.parties, 'supplier', 'suppliers'),
    href: '/payables',
  },
  {
    key: 'customer_advances',
    label: 'Advances received from customers',
    value: (p) => p.customer_advances.amount,
    detail: (p) => plural(p.customer_advances.parties, 'customer', 'customers'),
    href: '/receivables',
  },
  {
    key: 'gst_payable',
    label: 'GST payable',
    value: (p) => (p.gst.balance === null ? null : Math.max(0, p.gst.balance)),
    href: '/gst-payments',
  },
  {
    key: 'loans',
    label: 'Loans',
    value: (p) => p.loans.amount,
    detail: (p) => plural(p.loans.accounts, 'loan', 'loans'),
    href: '/capital-loans',
  },
]

// How net worth splits between what the owners put in and the rest
const MADE_UP: Line[] = [
  { key: 'capital', label: "Owners' capital", value: (p) => p.capital.amount, href: '/capital-loans' },
  {
    key: 'retained',
    label: 'Profit kept in the business, and anything not recorded',
    value: (p) => Math.round((p.net_worth - p.capital.amount) * 100) / 100,
  },
]

export default function FinancialPositionPage() {
  const role = useRole()
  const today = todayISO()
  const fy = financialYear(today)
  const compareOptions = [
    { label: 'End of last month', value: monthRange(-1).to },
    { label: 'End of last FY', value: dayBefore(fy.from) },
  ]
  const [asOf, setAsOf] = useState(today)
  const [compareTo, setCompareTo] = useState<string>(compareOptions[0].value)

  const allowed = !!role && ROLES.includes(role)
  const showThen = !!compareTo && compareTo !== asOf
  const { data: now, isLoading, error } = useFinancialPosition(asOf, allowed)
  const { data: thenData } = useFinancialPosition(compareTo, allowed && showThen)
  // Comparison columns only once that day has loaded, so header and rows match
  const then = showThen ? thenData : undefined
  const cols = then ? 4 : 2

  if (role && !allowed) {
    return (
      <div>
        <PageHeader title="Financial Position" description="What the business owns and owes on a day" />
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          Your role cannot see the financial position.
        </div>
      </div>
    )
  }

  function exportCsv() {
    if (!now) return
    const lines = [
      ...OWNED,
      { key: 'owned', label: 'Total owned', value: (p: FinancialPosition) => p.total_owned },
      ...OWED,
      { key: 'owed', label: 'Total owed', value: (p: FinancialPosition) => p.total_owed },
      { key: 'net', label: 'Net worth as per the app', value: (p: FinancialPosition) => p.net_worth },
      ...(now.capital.accounts > 0 ? MADE_UP : []),
    ]
    downloadCsv(`financial-position-${asOf}`, lines, [
      { header: 'Line', value: (l) => l.label },
      { header: asOf, value: (l) => l.value(now) },
      ...(then ? [{ header: compareTo, value: (l: (typeof lines)[number]) => l.value(then) }] : []),
    ])
  }

  const moneyMissing = now && (!now.cash.set || !now.bank.set)
  const gstMissing = now && !now.gst.set
  const change = now && then ? r2(now.net_worth - then.net_worth) : null

  return (
    <div>
      <PageHeader title="Financial Position" description="What the business owns and owes on a day, from what is recorded in this app">
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!now}>
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </PageHeader>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 flex flex-wrap items-end gap-3">
        <Input label="As on" type="date" max={today} value={asOf} onChange={(e) => setAsOf(e.target.value || today)} />
        <Input label="Compare with" type="date" max={today} value={compareTo} onChange={(e) => setCompareTo(e.target.value)} />
        <div className="flex flex-wrap gap-1">
          {compareOptions.map((o) => (
            <Button key={o.label} variant={compareTo === o.value ? 'secondary' : 'ghost'} size="sm" onClick={() => setCompareTo(o.value)}>
              {o.label}
            </Button>
          ))}
          <Button variant={!compareTo ? 'secondary' : 'ghost'} size="sm" onClick={() => setCompareTo('')}>
            No comparison
          </Button>
        </div>
      </div>

      {error ? (
        <div className="bg-white rounded-xl border border-red-200 p-6 text-sm text-red-700">{(error as Error).message}</div>
      ) : isLoading || !now ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <TableLoader />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Owned" value={formatCurrency(now.total_owned)} sub="cash, bank, customers, stock, assets" />
            <StatCard label="Owed" value={formatCurrency(now.total_owed)} sub="suppliers, customer advances, GST, loans" />
            <StatCard
              label="Net worth as per the app"
              value={signed(now.net_worth)}
              sub={`on ${formatDate(now.as_of)}`}
              className={now.net_worth < 0 ? 'border-amber-200' : 'border-green-200'}
            />
            <StatCard
              label="Change"
              value={change === null ? '—' : `${change > 0 ? '+' : ''}${signed(change)}`}
              sub={change === null ? 'Choose a day to compare with' : `since ${formatDate(compareTo)}`}
            />
          </div>

          {(moneyMissing || gstMissing || now.stock.items_without_cost > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-900 flex gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
              <div className="space-y-1 min-w-0">
                {moneyMissing && (
                  <p>
                    {!now.cash.set && !now.bank.set ? 'Cash and bank are' : !now.cash.set ? 'Cash is' : 'Bank is'} left out: there is
                    no opening balance on or before {formatDate(now.as_of)}. Set it on the{' '}
                    <Link href={'/reports/cash-book' as Route} className="underline">
                      Cash &amp; Bank Book
                    </Link>
                    .
                  </p>
                )}
                {gstMissing && (
                  <p>
                    GST is left out: there is no GST opening position on or before {formatDate(now.as_of)}, so the tax you owe
                    the government, or the credit you hold, is not counted. Set it on{' '}
                    <Link href={'/gst-payments' as Route} className="underline">
                      GST Payments
                    </Link>
                    .
                  </p>
                )}
                {now.stock.items_without_cost > 0 && (
                  <p>
                    {plural(now.stock.items_without_cost, 'item in stock has', 'items in stock have')} no cost and{' '}
                    {now.stock.items_without_cost === 1 ? 'is' : 'are'} counted at nil — see the{' '}
                    <Link href={'/reports/profit-loss' as Route} className="underline">
                      Profit &amp; Loss
                    </Link>{' '}
                    for which.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="text-left px-3 sm:px-4 py-3" />
                  <th className="text-right px-3 sm:px-4 py-3 sm:whitespace-nowrap">{formatDate(asOf)}</th>
                  {then && (
                    <>
                      <th className="hidden sm:table-cell text-right px-4 py-3 whitespace-nowrap text-slate-400">{formatDate(compareTo)}</th>
                      <th className="hidden sm:table-cell text-right px-4 py-3 whitespace-nowrap text-slate-400">Change</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <Section label="What the business owns" cols={cols} />
                {OWNED.map((l) => (
                  <Row key={l.key} line={l} now={now} then={then} />
                ))}
                <Row line={{ key: 'owned', label: 'Total owned', value: (p) => p.total_owned, kind: 'total' }} now={now} then={then} />
                <Section label="What it owes" cols={cols} />
                {OWED.map((l) => (
                  <Row key={l.key} line={l} now={now} then={then} />
                ))}
                <Row line={{ key: 'owed', label: 'Total owed', value: (p) => p.total_owed, kind: 'total' }} now={now} then={then} />
                <Row
                  line={{ key: 'net', label: 'Net worth as per the app', value: (p) => p.net_worth, kind: 'grand' }}
                  now={now}
                  then={then}
                />
                {now.capital.accounts > 0 && (
                  <>
                    <Section label="Made up of" cols={cols} />
                    {MADE_UP.map((l) => (
                      <Row key={l.key} line={l} now={now} then={then} />
                    ))}
                  </>
                )}
              </tbody>
            </table>
            <div className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100 space-y-1">
              <p>
                At the end of the day chosen. Customer and supplier balances are worked out as on their statements, so an
                advance and an unpaid invoice of the same party net off. Stock is valued at the running average purchase cost,
                as in the Profit &amp; Loss.
              </p>
              <p>
                Customer and supplier balances include GST. Once a GST opening position is set, the GST you owe the government
                — or the input credit you hold — is shown from the GST ledger, and the change in net worth between two days
                after it is the profit for the period, less any GST charged by unregistered suppliers (no credit can be claimed
                on it), plus capital put in less drawings. Without it, the change also includes GST collected less GST paid
                on purchases. Loans count once their account is set up under Capital &amp; Loans, and machines, vehicles and
                other fixed assets once they are entered under Fixed Assets, at book value after depreciation. Anything not
                recorded in the app is outside this view.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Section({ label, cols }: { label: string; cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="px-3 sm:px-4 pt-5 pb-1 text-xs font-semibold text-slate-500 uppercase">
        {label}
      </td>
    </tr>
  )
}

function Row({ line, now, then }: { line: Line; now: FinancialPosition; then?: FinancialPosition }) {
  const a = line.value(now)
  const b = then ? line.value(then) : null
  const strong = line.kind === 'total' || line.kind === 'grand'
  const money = (n: number | null) => (n === null ? <span className="text-slate-400 font-normal">Not set</span> : signed(n))
  const diff = a !== null && b !== null ? r2(a - b) : null
  return (
    <tr
      className={
        line.kind === 'grand'
          ? 'bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900'
          : line.kind === 'total'
            ? 'bg-slate-50/60 font-semibold text-slate-900'
            : ''
      }
    >
      <td className={`px-3 sm:px-4 py-2.5 ${strong ? '' : 'pl-6 sm:pl-8 text-slate-700'}`}>
        {line.href ? (
          <Link href={line.href as Route} className="hover:text-blue-600 hover:underline">
            {line.label}
          </Link>
        ) : (
          line.label
        )}
        {line.detail && <span className="ml-2 text-xs text-slate-400 font-normal">{line.detail(now)}</span>}
      </td>
      <td className={`px-3 sm:px-4 py-2.5 text-right tabular-nums whitespace-nowrap ${a !== null && a < 0 ? 'text-amber-700' : ''}`}>{money(a)}</td>
      {then && (
        <>
          <td className="hidden sm:table-cell px-4 py-2.5 text-right tabular-nums whitespace-nowrap text-slate-400">{money(b)}</td>
          <td className="hidden sm:table-cell px-4 py-2.5 text-right tabular-nums whitespace-nowrap text-slate-500">
            {diff === null ? '—' : diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${signed(diff)}`}
          </td>
        </>
      )}
    </tr>
  )
}
