'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
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
import { ArrowLeftRight, Download } from 'lucide-react'
import { MoneyBalances } from '@/components/finance/money-balances'
import { TransferForm, TransferList } from '@/components/finance/money-transfers'
import { TRANSFER_LABEL, useMoneyTransfers } from '@/lib/hooks/use-money-transfers'
import { useRole } from '@/lib/hooks/use-profile'
import { returnPeriodLabel } from '@/lib/gst-payments'

const TABS = ['Day book', 'By mode', 'By day', 'Transfers'] as const
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

// Other income received in the period (cancelled entries left out)
function useIncomeForPeriod(from: string, to: string) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['cash-book-income', orgId, from, to],
    queryFn: async () => {
      const { data, error } = await allRows(supabase
        .from('other_income')
        .select('id, income_no, income_date, amount, mode, reference, received_from, created_at, head:income_heads ( name )')
        .eq('status', 'active')
        .gte('income_date', from)
        .lte('income_date', to)
        .order('income_date')
        .order('id'))
      if (error) throw error
      return data
    },
    enabled: !!orgId && !!from && !!to,
    staleTime: 60 * 1000,
  })
}

// GST challans paid in the period (cancelled ones left out)
function useGstPaidForPeriod(from: string, to: string) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['cash-book-gst', orgId, from, to],
    queryFn: async () => {
      const { data, error } = await allRows(supabase
        .from('gst_payments')
        .select('id, payment_no, payment_date, amount, mode, reference, period, created_at')
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

export default function CashBookPage() {
  const role = useRole()
  const canEdit = role === 'admin' || role === 'manager'
  const thisMonth = monthRange(0)
  const [from, setFrom] = useState(thisMonth.from)
  const [to, setTo] = useState(thisMonth.to)
  const [tab, setTab] = useState<Tab>('Day book')
  const [showTransfer, setShowTransfer] = useState(false)

  const { data: receipts, isLoading: loadingReceipts } = useReceiptsForPeriod(from, to)
  const { data: payments, isLoading: loadingPayments } = usePaymentsForPeriod(from, to)
  const { data: expenses, isLoading: loadingExpenses } = useExpensesForPeriod(from, to)
  const { data: income, isLoading: loadingIncome } = useIncomeForPeriod(from, to)
  const { data: gstPaid, isLoading: loadingGst } = useGstPaidForPeriod(from, to)
  const { data: transfers, isLoading: loadingTransfers } = useMoneyTransfers(from, to)
  const isLoading = loadingReceipts || loadingPayments || loadingExpenses || loadingIncome || loadingGst || loadingTransfers

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
      ...(income ?? []).map((i) => ({
        key: `i${i.id}`,
        date: i.income_date,
        at: i.created_at,
        no: i.income_no,
        kind: 'Income' as const,
        party: i.received_from || i.head?.name || '—',
        head: i.head?.name ?? '',
        mode: i.mode,
        reference: i.reference ?? '',
        moneyIn: Number(i.amount),
        moneyOut: 0,
      })),
      ...(gstPaid ?? []).map((g) => ({
        key: `g${g.id}`,
        date: g.payment_date,
        at: g.created_at,
        no: g.payment_no,
        kind: 'GST' as const,
        party: 'GST payment',
        head: g.period ? `for ${returnPeriodLabel(g.period)}` : '',
        mode: g.mode,
        reference: g.reference ?? '',
        moneyIn: 0,
        moneyOut: Number(g.amount),
      })),
    ]
    return list.sort(byWhen)
  }, [receipts, payments, expenses, income, gstPaid])

  // Transfers between cash and bank are not money in or out of the business:
  // they appear in the day book but stay out of the totals, by mode and by day
  const activeTransfers = useMemo(() => (transfers ?? []).filter((t) => t.status === 'active'), [transfers])
  const dayBook = useMemo(
    () =>
      [
        ...entries.map((e) => ({ ...e, moved: 0 })),
        ...activeTransfers.map((t) => ({
          key: `t${t.id}`,
          date: t.transfer_date,
          at: t.created_at,
          no: t.transfer_no,
          kind: 'Transfer' as const,
          party: TRANSFER_LABEL[t.direction],
          mode: t.direction === 'cash_to_bank' ? 'Cash → Bank' : 'Bank → Cash',
          reference: t.reference ?? '',
          moneyIn: 0,
          moneyOut: 0,
          moved: Number(t.amount),
        })),
      ].sort(byWhen),
    [entries, activeTransfers]
  )

  const totals = {
    moneyIn: r2(sum(entries, (e) => e.moneyIn)),
    moneyOut: r2(sum(entries, (e) => e.moneyOut)),
    receipts: receipts?.length ?? 0,
    payments: payments?.length ?? 0,
    expenses: expenses?.length ?? 0,
    income: income?.length ?? 0,
    gst: gstPaid?.length ?? 0,
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
  const transferTotals = {
    count: activeTransfers.length,
    deposited: r2(sum(activeTransfers.filter((t) => t.direction === 'cash_to_bank'), (t) => Number(t.amount))),
    drawn: r2(sum(activeTransfers.filter((t) => t.direction === 'bank_to_cash'), (t) => Number(t.amount))),
  }

  function exportTab() {
    const tag = `${from}_${to}`
    switch (tab) {
      case 'Transfers':
        return downloadCsv(`cash-bank-transfers-${tag}`, transfers ?? [], [
          { header: 'Transfer No', value: (t) => t.transfer_no },
          { header: 'Date', value: (t) => t.transfer_date },
          { header: 'Direction', value: (t) => TRANSFER_LABEL[t.direction] },
          { header: 'Reference', value: (t) => t.reference },
          { header: 'Amount', value: (t) => Number(t.amount) },
          { header: 'Status', value: (t) => (t.status === 'cancelled' ? `Cancelled: ${t.cancel_reason ?? ''}` : 'Active') },
          { header: 'Notes', value: (t) => t.notes },
        ])
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
        return downloadCsv(`cash-book-${tag}`, dayBook, [
          { header: 'Date', value: (r) => r.date },
          { header: 'Type', value: (r) => r.kind },
          { header: 'Document No', value: (r) => r.no },
          { header: 'Party / Head', value: (r) => ('head' in r && r.head ? `${r.party} (${r.head})` : r.party) },
          { header: 'Mode', value: (r) => (r.kind === 'Transfer' ? r.mode : paymentModeLabel(r.mode)) },
          { header: 'Reference', value: (r) => r.reference },
          { header: 'Money In', value: (r) => (r.moneyIn ? r.moneyIn : null) },
          { header: 'Money Out', value: (r) => (r.moneyOut ? r.moneyOut : null) },
          { header: 'Moved Between Cash And Bank', value: (r) => (r.moved ? r.moved : null) },
        ])
    }
  }

  const presets = reportPeriods()

  return (
    <div>
      <PageHeader title="Cash & Bank Book" description="Money received from customers and as other income, and paid to suppliers, on expenses and as GST, by day and by mode">
        <Button variant="outline" size="sm" onClick={exportTab} disabled={isLoading}>
          <Download className="w-4 h-4" />
          Export {tab.toLowerCase()} CSV
        </Button>
        {canEdit && (
          <Button size="sm" onClick={() => setShowTransfer(true)} disabled={showTransfer}>
            <ArrowLeftRight className="w-4 h-4" />
            Record transfer
          </Button>
        )}
      </PageHeader>

      {showTransfer && canEdit && <TransferForm onDone={() => setShowTransfer(false)} />}

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

      {from <= to && <MoneyBalances from={from} to={to} canEdit={canEdit} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Money in"
          value={formatCurrency(totals.moneyIn)}
          sub={`${totals.receipts} ${totals.receipts === 1 ? 'receipt' : 'receipts'}${totals.income ? `, ${totals.income} other income` : ''}`}
        />
        <StatCard
          label="Money out"
          value={formatCurrency(totals.moneyOut)}
          sub={`${totals.payments} supplier ${totals.payments === 1 ? 'payment' : 'payments'}, ${totals.expenses} ${totals.expenses === 1 ? 'expense' : 'expenses'}${totals.gst ? `, ${totals.gst} GST` : ''}`}
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
                {dayBook.length === 0 && <Empty cols={6} />}
                {dayBook.map((e) =>
                  e.kind === 'Transfer' ? (
                    <tr key={e.key} className="bg-slate-50/60">
                      <td data-label="Date" className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(e.date)}</td>
                      <td data-main className="px-4 py-3">
                        <span className="font-mono font-semibold text-slate-900 whitespace-nowrap">{e.no}</span>
                        <div className="text-xs text-slate-400">Transfer · not in or out</div>
                      </td>
                      <td data-label="Party" className="px-4 py-3 font-medium text-slate-900">{e.party}</td>
                      <td data-label="Mode" className="px-4 py-3 text-slate-600">
                        <span className="whitespace-nowrap">{e.mode}</span>
                        {e.reference && <div className="text-xs text-slate-400">{e.reference}</div>}
                      </td>
                      <td data-label="Moved" colSpan={2} className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-slate-500">
                        {formatCurrency(e.moved)} moved
                      </td>
                    </tr>
                  ) : (
                  <tr key={e.key}>
                    <td data-label="Date" className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(e.date)}</td>
                    <td data-main className="px-4 py-3">
                      <span className="font-mono font-semibold text-slate-900 whitespace-nowrap">{e.no}</span>
                      <div className="text-xs text-slate-400">
                        {e.kind === 'Receipt'
                          ? 'Receipt from customer'
                          : e.kind === 'Payment'
                            ? 'Payment to supplier'
                            : `${e.kind === 'Income' ? 'Other income' : e.kind === 'GST' ? 'GST challan' : 'Expense'}${'head' in e && e.head ? ` · ${e.head}` : ''}`}
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
                  )
                )}
              </tbody>
              {entries.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
                    <td colSpan={4} className="px-4 py-3">
                      Total{activeTransfers.length > 0 ? ', transfers left out' : ''}
                    </td>
                    <Num value={totals.moneyIn} tone="in" />
                    <Num value={totals.moneyOut} tone="out" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : tab === 'Transfers' ? (
          <TransferList rows={transfers ?? []} canEdit={canEdit} />
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
            {transferTotals.count > 0 && (
              <p className="px-4 py-3 text-sm text-slate-600 border-t border-slate-100">
                Also in the period: {formatCurrency(transferTotals.deposited)} of cash deposited in the bank and{' '}
                {formatCurrency(transferTotals.drawn)} drawn from it. These move money between cash and bank, so they change
                the balances above but not the figures here.
              </p>
            )}
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
            Customer receipts, other income, supplier payments and expenses, on the date each was recorded. Cancelled entries are left
            out. Cash deposited in or drawn from the bank is listed in the day book but not counted as money in or out —
            it only moves money between the two balances above. The balances start from the opening balance you set and
            add everything recorded since. Money not recorded in the app (loans, capital, tax paid) is not included, so
            check the bank figure against your bank statement on{' '}
            <Link href={'/reports/bank-reconciliation' as Route} className="text-blue-600 hover:underline">
              Bank Reconciliation
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  )
}

const HEAD = 'bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase'

// Oldest first; entries saved together keep the order they were saved in
const byWhen = (a: { date: string; at: string | null; no: string }, b: { date: string; at: string | null; no: string }) =>
  a.date.localeCompare(b.date) || (a.at ?? '').localeCompare(b.at ?? '') || a.no.localeCompare(b.no)

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
