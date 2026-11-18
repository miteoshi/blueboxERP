'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { PAYMENT_MODES, paymentModeLabel } from '@/lib/hooks/use-finance'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { TableLoader } from '@/components/ui/spinner'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { allRows } from '@/lib/utils/all-rows'
import { monthRange, reportPeriods } from '@/lib/utils/periods'
import { downloadCsv } from '@/lib/utils/csv'
import { Download } from 'lucide-react'

const TABS = ['Day book', 'By mode', 'By day'] as const
type Tab = (typeof TABS)[number]

const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + (f(r) || 0), 0)
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

// Money received from customers in the period (cancelled receipts left out)
function useReceiptsForPeriod(from: string, to: string) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['cash-book-receipts', orgId, from, to],
    queryFn: async () => {
      const { data, error } = await allRows(supabase
        .from('customer_receipts')
        .select('id, receipt_no, receipt_date, amount, mode, reference, created_at, client:clients ( name )')
        .eq('status', 'active')
        .gte('receipt_date', from)
        .lte('receipt_date', to)
        .order('receipt_date')
        .order('id'))
      if (error) throw error
      return data
    },
    enabled: !!orgId && !!from && !!to,
    staleTime: 60 * 1000,
  })
}

// Money paid to suppliers in the period (cancelled payments left out)
function usePaymentsForPeriod(from: string, to: string) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['cash-book-payments', orgId, from, to],
    queryFn: async () => {
      const { data, error } = await allRows(supabase
        .from('supplier_payments')
        .select('id, payment_no, payment_date, amount, mode, reference, created_at, supplier:suppliers ( name )')
        .eq('status', 'active')
        .gte('payment_date', from)
        .lte('payment_date', to)
        .order('payment_date')
        .order('id'))
      if (error) throw error
      return data
    },
    enabled: !!orgId && !!from && !!to,
    staleTime: 60 * 1000,
  })
}

// Expenses paid in the period (cancelled ones left out)
function useExpensesForPeriod(from: string, to: string) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['cash-book-expenses', orgId, from, to],
    queryFn: async () => {
      const { data, error } = await allRows(supabase
        .from('expenses')
        .select('id, expense_no, expense_date, amount, mode, reference, payee, created_at, head:expense_heads ( name )')
        .eq('status', 'active')
        .gte('expense_date', from)
        .lte('expense_date', to)
        .order('expense_date')
        .order('id'))
      if (error) throw error
      return data
    },
    enabled: !!orgId && !!from && !!to,
    staleTime: 60 * 1000,
  })
}

export default function CashBookPage() {
  const thisMonth = monthRange(0)
  const [from, setFrom] = useState(thisMonth.from)
  const [to, setTo] = useState(thisMonth.to)
  const [tab, setTab] = useState<Tab>('Day book')

  const { data: receipts, isLoading: loadingReceipts } = useReceiptsForPeriod(from, to)
  const { data: payments, isLoading: loadingPayments } = usePaymentsForPeriod(from, to)
  const { data: expenses, isLoading: loadingExpenses } = useExpensesForPeriod(from, to)
  const isLoading = loadingReceipts || loadingPayments || loadingExpenses

  // One list in the order the money moved
  const entries = useMemo(() => {
    const list = [
      ...(receipts ?? []).map((r) => ({
        key: `r${r.id}`,
        date: r.receipt_date,
        at: r.created_at,
        no: r.receipt_no,
        kind: 'Receipt' as const,
        party: r.client?.name ?? '—',
        mode: r.mode,
        reference: r.reference ?? '',
        moneyIn: Number(r.amount),
        moneyOut: 0,
      })),
      ...(payments ?? []).map((p) => ({
        key: `p${p.id}`,
        date: p.payment_date,
        at: p.created_at,
        no: p.payment_no,
        kind: 'Payment' as const,
        party: p.supplier?.name ?? '—',
        mode: p.mode,
        reference: p.reference ?? '',
        moneyIn: 0,
        moneyOut: Number(p.amount),
      })),
      ...(expenses ?? []).map((x) => ({
        key: `x${x.id}`,
        date: x.expense_date,
        at: x.created_at,
        no: x.expense_no,
        kind: 'Expense' as const,
        party: x.payee || x.head?.name || '—',
        head: x.head?.name ?? '',
        mode: x.mode,
        reference: x.reference ?? '',
        moneyIn: 0,
        moneyOut: Number(x.amount),
      })),
    ]
    return list.sort((a, b) => a.date.localeCompare(b.date) || (a.at ?? '').localeCompare(b.at ?? '') || a.no.localeCompare(b.no))
  }, [receipts, payments, expenses])

  const totals = {
    moneyIn: r2(sum(entries, (e) => e.moneyIn)),
    moneyOut: r2(sum(entries, (e) => e.moneyOut)),
    receipts: receipts?.length ?? 0,
    payments: payments?.length ?? 0,
    expenses: expenses?.length ?? 0,
  }
  const net = r2(totals.moneyIn - totals.moneyOut)

  const byMode = useMemo(() => {
    const map = new Map<string, { mode: string; count: number; moneyIn: number; moneyOut: number }>()
    for (const e of entries) {
      const r = map.get(e.mode) ?? { mode: e.mode, count: 0, moneyIn: 0, moneyOut: 0 }
      r.count += 1
      r.moneyIn = r2(r.moneyIn + e.moneyIn)
      r.moneyOut = r2(r.moneyOut + e.moneyOut)
      map.set(e.mode, r)
    }
    // Same order as the mode list used when recording a payment
    const order = PAYMENT_MODES.map((m) => m.value as string)
    return [...map.values()].sort((a, b) => order.indexOf(a.mode) - order.indexOf(b.mode))
  }, [entries])

  const byDay = useMemo(() => {
    const map = new Map<string, { date: string; count: number; moneyIn: number; moneyOut: number }>()
    for (const e of entries) {
      const r = map.get(e.date) ?? { date: e.date, count: 0, moneyIn: 0, moneyOut: 0 }
      r.count += 1
      r.moneyIn = r2(r.moneyIn + e.moneyIn)
      r.moneyOut = r2(r.moneyOut + e.moneyOut)
      map.set(e.date, r)
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
  }, [entries])

  const cash = byMode.find((m) => m.mode === 'cash')

  function exportTab() {
    const tag = `${from}_${to}`
    switch (tab) {
      case 'By mode':
        return downloadCsv(`cash-book-by-mode-${tag}`, byMode, [
          { header: 'Mode', value: (r) => paymentModeLabel(r.mode) },
          { header: 'Entries', value: (r) => r.count },
          { header: 'Money In', value: (r) => r.moneyIn },
          { header: 'Money Out', value: (r) => r.moneyOut },
          { header: 'Net', value: (r) => r2(r.moneyIn - r.moneyOut) },
        ])
      case 'By day':
        return downloadCsv(`cash-book-by-day-${tag}`, byDay, [
          { header: 'Date', value: (r) => r.date },
          { header: 'Entries', value: (r) => r.count },
          { header: 'Money In', value: (r) => r.moneyIn },
          { header: 'Money Out', value: (r) => r.moneyOut },
          { header: 'Net', value: (r) => r2(r.moneyIn - r.moneyOut) },
        ])
      default:
        return downloadCsv(`cash-book-${tag}`, entries, [
          { header: 'Date', value: (r) => r.date },
          { header: 'Type', value: (r) => r.kind },
          { header: 'Document No', value: (r) => r.no },
          { header: 'Party / Head', value: (r) => ('head' in r && r.head ? `${r.party} (${r.head})` : r.party) },
          { header: 'Mode', value: (r) => paymentModeLabel(r.mode) },
          { header: 'Reference', value: (r) => r.reference },
          { header: 'Money In', value: (r) => (r.moneyIn ? r.moneyIn : null) },
          { header: 'Money Out', value: (r) => (r.moneyOut ? r.moneyOut : null) },
        ])
    }
  }

  const presets = reportPeriods()

  return (
    <div>
      <PageHeader title="Cash & Bank Book" description="Money received from customers and paid to suppliers and on expenses, by day and by mode">
        <Button variant="outline" size="sm" onClick={exportTab} disabled={isLoading}>
          <Download className="w-4 h-4" />
          Export {tab.toLowerCase()} CSV
        </Button>
      </PageHeader>

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Money in"
          value={formatCurrency(totals.moneyIn)}
          sub={`${totals.receipts} ${totals.receipts === 1 ? 'receipt' : 'receipts'}`}
        />
        <StatCard
          label="Money out"
          value={formatCurrency(totals.moneyOut)}
          sub={`${totals.payments} supplier ${totals.payments === 1 ? 'payment' : 'payments'}, ${totals.expenses} ${totals.expenses === 1 ? 'expense' : 'expenses'}`}
        />
        <StatCard
          label="Net movement"
          value={`${net < 0 ? '−' : ''}${formatCurrency(Math.abs(net))}`}
          sub={net < 0 ? 'More paid out than received' : net > 0 ? 'More received than paid out' : 'In and out are equal'}
          className={net < 0 ? 'border-amber-200' : undefined}
        />
        <StatCard
          label="Of which cash"
          value={cash ? `${cash.moneyIn - cash.moneyOut < 0 ? '−' : ''}${formatCurrency(Math.abs(r2(cash.moneyIn - cash.moneyOut)))}` : '—'}
          sub={cash ? `${formatCurrency(cash.moneyIn)} in, ${formatCurrency(cash.moneyOut)} out` : 'No cash entries'}
        />
      </div>

      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-lg w-fit max-w-full overflow-x-auto *:shrink-0 *:whitespace-nowrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <TableLoader />
        ) : tab === 'Day book' ? (
          <div className="overflow-x-auto">
            <table className="stack w-full text-sm">
              <thead>
                <tr className={HEAD}>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Document</th>
                  <th className="text-left px-4 py-3">Party</th>
                  <th className="text-left px-4 py-3">Mode</th>
                  <th className="text-right px-4 py-3">Money in</th>
                  <th className="text-right px-4 py-3">Money out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {entries.length === 0 && <Empty cols={6} />}
                {entries.map((e) => (
                  <tr key={e.key}>
                    <td data-label="Date" className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(e.date)}</td>
                    <td data-main className="px-4 py-3">
                      <span className="font-mono font-semibold text-slate-900 whitespace-nowrap">{e.no}</span>
                      <div className="text-xs text-slate-400">
                        {e.kind === 'Receipt'
                          ? 'Receipt from customer'
                          : e.kind === 'Payment'
                            ? 'Payment to supplier'
                            : `Expense${'head' in e && e.head ? ` · ${e.head}` : ''}`}
                      </div>
                    </td>
                    <td data-label="Party" className="px-4 py-3 font-medium text-slate-900">{e.party}</td>
                    <td data-label="Mode" className="px-4 py-3 text-slate-600">
                      {paymentModeLabel(e.mode)}
                      {e.reference && <div className="text-xs text-slate-400">{e.reference}</div>}
                    </td>
                    <Num label="Money in" value={e.moneyIn} tone="in" />
                    <Num label="Money out" value={e.moneyOut} tone="out" />
                  </tr>
                ))}
              </tbody>
              {entries.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
                    <td colSpan={4} className="px-4 py-3">
                      Total
                    </td>
                    <Num value={totals.moneyIn} tone="in" />
                    <Num value={totals.moneyOut} tone="out" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : tab === 'By mode' ? (
          <div className="overflow-x-auto">
            <table className="stack w-full text-sm">
              <thead>
                <tr className={HEAD}>
                  <th className="text-left px-4 py-3">Mode</th>
                  <th className="text-right px-4 py-3">Entries</th>
                  <th className="text-right px-4 py-3">Money in</th>
                  <th className="text-right px-4 py-3">Money out</th>
                  <th className="text-right px-4 py-3">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {byMode.length === 0 && <Empty cols={5} />}
                {byMode.map((r) => (
                  <tr key={r.mode}>
                    <td data-main className="px-4 py-3 font-medium text-slate-900">{paymentModeLabel(r.mode)}</td>
                    <td data-label="Entries" className="px-4 py-3 text-right tabular-nums">{r.count}</td>
                    <Num label="Money in" value={r.moneyIn} tone="in" />
                    <Num label="Money out" value={r.moneyOut} tone="out" />
                    <Net label="Net" value={r2(r.moneyIn - r.moneyOut)} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="stack w-full text-sm">
              <thead>
                <tr className={HEAD}>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-right px-4 py-3">Entries</th>
                  <th className="text-right px-4 py-3">Money in</th>
                  <th className="text-right px-4 py-3">Money out</th>
                  <th className="text-right px-4 py-3">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {byDay.length === 0 && <Empty cols={5} />}
                {byDay.map((r) => (
                  <tr key={r.date}>
                    <td data-main className="px-4 py-3 font-medium text-slate-900">{formatDate(r.date)}</td>
                    <td data-label="Entries" className="px-4 py-3 text-right tabular-nums">{r.count}</td>
                    <Num label="Money in" value={r.moneyIn} tone="in" />
                    <Num label="Money out" value={r.moneyOut} tone="out" />
                    <Net label="Net" value={r2(r.moneyIn - r.moneyOut)} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && (
          <p className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100">
            Customer receipts, supplier payments and expenses, on the date each was recorded. Cancelled entries are left
            out. There is no opening balance here, so this shows movement in the period, not what is in the bank or the
            cash box. Money not recorded in the app (loans, capital, tax paid) is not included.
          </p>
        )}
      </div>
    </div>
  )
}

const HEAD = 'bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase'

function Num({ value, label, tone }: { value: number; label?: string; tone: 'in' | 'out' }) {
  return (
    <td
      data-label={label}
      className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${value ? (tone === 'in' ? 'text-green-700' : 'text-slate-900') : 'text-slate-300'}`}
    >
      {value ? formatCurrency(value) : '—'}
    </td>
  )
}

function Net({ value, label }: { value: number; label: string }) {
  return (
    <td
      data-label={label}
      className={`px-4 py-3 text-right tabular-nums whitespace-nowrap font-semibold ${value < 0 ? 'text-amber-700' : 'text-slate-900'}`}
    >
      {value < 0 ? '−' : ''}
      {formatCurrency(Math.abs(value))}
    </td>
  )
}

function Empty({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="text-center py-12 text-slate-400 text-sm">
        No money received or paid in this period
      </td>
    </tr>
  )
}
