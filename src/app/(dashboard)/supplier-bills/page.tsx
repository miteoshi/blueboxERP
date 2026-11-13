'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TableLoader } from '@/components/ui/spinner'
import { BILL_STATE, billState, useSupplierBills, useUnbilledGrnLines } from '@/lib/hooks/use-payables'
import { useCan } from '@/lib/hooks/use-profile'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils/format'
import { downloadCsv } from '@/lib/utils/csv'
import { AlertTriangle, Download, FileClock, IndianRupee, Plus, Search } from 'lucide-react'

const TABS = [
  { value: 'open', label: 'To pay' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
] as const
type Tab = (typeof TABS)[number]['value']

export default function SupplierBillsPage() {
  const canManage = useCan('managePayables')
  const { data: bills, isLoading } = useSupplierBills()
  const { data: unbilled } = useUnbilledGrnLines(null)
  const [tab, setTab] = useState<Tab>('open')
  const [search, setSearch] = useState('')
  const today = todayISO()

  const enriched = useMemo(() => (bills ?? []).map((b) => ({ ...b, state: billState(b, today) })), [bills, today])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return enriched.filter((b) => {
      const inTab =
        tab === 'all' ||
        (tab === 'open' && b.state !== 'paid' && b.state !== 'settled' && b.state !== 'cancelled') ||
        (tab === 'paid' && (b.state === 'paid' || b.state === 'settled')) ||
        (tab === 'cancelled' && b.state === 'cancelled')
      return (
        inTab &&
        (!term ||
          b.bill_no.toLowerCase().includes(term) ||
          b.supplier_invoice_no.toLowerCase().includes(term) ||
          (b.supplier?.name ?? '').toLowerCase().includes(term))
      )
    })
  }, [enriched, tab, search])

  const stats = useMemo(() => {
    const open = enriched.filter((b) => b.state !== 'paid' && b.state !== 'settled' && b.state !== 'cancelled')
    const week = new Date(`${today}T00:00:00Z`)
    week.setUTCDate(week.getUTCDate() + 7)
    const weekISO = week.toISOString().slice(0, 10)
    return {
      toPay: open.reduce((s, b) => s + (b.balance_due ?? 0), 0),
      overdue: open.filter((b) => b.state === 'overdue').reduce((s, b) => s + (b.balance_due ?? 0), 0),
      dueSoon: open.filter((b) => b.due_date >= today && b.due_date <= weekISO).reduce((s, b) => s + (b.balance_due ?? 0), 0),
    }
  }, [enriched, today])

  // Value received from suppliers that no bill covers yet
  const unbilledValue = useMemo(
    () =>
      (unbilled ?? []).reduce(
        (s, g) =>
          s + g.inbound_receipt_lines.reduce((t, l) => t + (Number(l.qty_received) - Number(l.qty_billed)) * Number(l.rate), 0),
        0,
      ),
    [unbilled],
  )

  function exportCsv() {
    downloadCsv(`supplier-bills-${today}`, rows, [
      { header: 'Bill No', value: (r) => r.bill_no },
      { header: 'Supplier', value: (r) => r.supplier?.name },
      { header: 'Supplier Invoice No', value: (r) => r.supplier_invoice_no },
      { header: 'Invoice Date', value: (r) => r.bill_date },
      { header: 'Due Date', value: (r) => r.due_date },
      { header: 'Taxable Value', value: (r) => r.taxable_value },
      { header: 'Total', value: (r) => r.total_amount },
      { header: 'Paid', value: (r) => r.amount_paid },
      { header: 'Debited', value: (r) => r.amount_debited },
      { header: 'Balance', value: (r) => r.balance_due },
      { header: 'Status', value: (r) => BILL_STATE[r.state].label },
    ])
  }

  return (
    <div>
      <PageHeader title="Supplier Bills" description="Suppliers' invoices for goods received">
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="w-4 h-4" />
          Export
        </Button>
        {canManage && (
          <Link href={'/supplier-bills/new' as Route}>
            <Button size="sm">
              <Plus className="w-4 h-4" />
              Enter Bill
            </Button>
          </Link>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="To pay" value={formatCurrency(stats.toPay)} icon={<IndianRupee className="w-5 h-5" />} />
        <StatCard
          label="Overdue"
          value={formatCurrency(stats.overdue)}
          icon={<AlertTriangle className="w-5 h-5" />}
          className={stats.overdue > 0 ? 'border-red-200' : ''}
        />
        <StatCard label="Due in 7 days" value={formatCurrency(stats.dueSoon)} />
        <StatCard
          label="Received, not billed"
          value={formatCurrency(unbilledValue)}
          sub={`${unbilled?.length ?? 0} GRN${unbilled?.length === 1 ? '' : 's'} waiting for an invoice`}
          icon={<FileClock className="w-5 h-5" />}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 flex flex-wrap items-center gap-3 border-b border-slate-100">
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={`px-3 py-1.5 rounded-md font-medium ${
                  tab === t.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Bill, invoice number or supplier…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <span className="text-xs text-slate-400 ml-auto">{rows.length} bills</span>
        </div>

        {isLoading ? (
          <TableLoader />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="text-left px-4 py-3">Bill</th>
                  <th className="text-left px-4 py-3">Supplier</th>
                  <th className="text-left px-4 py-3">Due</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-right px-4 py-3">Balance</th>
                  <th className="text-center px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                      {bills?.length ? 'No bills here' : 'No supplier bills yet'}
                    </td>
                  </tr>
                )}
                {rows.map((b) => {
                  const st = BILL_STATE[b.state]
                  return (
                    <tr key={b.id} className={`hover:bg-slate-50 ${b.state === 'cancelled' ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <Link href={`/supplier-bills/${b.id}` as Route} className="font-mono text-sm font-semibold text-blue-600 hover:underline">
                          {b.bill_no}
                        </Link>
                        <div className="text-xs text-slate-400">
                          Inv {b.supplier_invoice_no} · {formatDate(b.bill_date)}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{b.supplier?.name}</td>
                      <td className={`px-4 py-3 ${b.state === 'overdue' ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                        {formatDate(b.due_date)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCurrency(b.total_amount)}
                        {b.amount_debited > 0 && (
                          <div className="text-xs text-slate-400">less {formatCurrency(b.amount_debited)} debited</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                        {b.state === 'cancelled' ? '—' : formatCurrency(b.balance_due)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
