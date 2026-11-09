'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/card'
import { TableLoader } from '@/components/ui/spinner'
import { InvoiceStatusBadge, paymentState, type PaymentState } from '@/components/finance/invoice-status'
import { useInvoices } from '@/lib/hooks/use-finance'
import { useCanBill } from '@/lib/hooks/use-profile'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils/format'
import { downloadCsv } from '@/lib/utils/csv'
import { Plus, Search, Download, Receipt, AlertTriangle, IndianRupee } from 'lucide-react'

const FILTERS: { label: string; value: 'all' | PaymentState | 'open' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Paid', value: 'paid' },
  { label: 'Cancelled', value: 'cancelled' },
]

export default function InvoicesPage() {
  const canBill = useCanBill()
  const { data: invoices, isLoading } = useInvoices()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('all')
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (invoices ?? []).filter((inv) => {
      const state = paymentState(inv)
      if (filter === 'open' && !['unpaid', 'partial', 'overdue'].includes(state)) return false
      if (filter !== 'all' && filter !== 'open' && state !== filter) return false
      if (!term) return true
      return (
        inv.invoice_no.toLowerCase().includes(term) ||
        (inv.client?.name ?? '').toLowerCase().includes(term) ||
        (inv.buyer_gstin ?? '').toLowerCase().includes(term)
      )
    })
  }, [invoices, filter, search])

  const stats = useMemo(() => {
    const issued = (invoices ?? []).filter((i) => i.status === 'issued')
    const month = todayISO().slice(0, 7)
    return {
      thisMonth: issued.filter((i) => i.invoice_date.startsWith(month)).reduce((s, i) => s + i.total_amount, 0),
      outstanding: issued.reduce((s, i) => s + (i.balance_due ?? 0), 0),
      overdue: issued
        .filter((i) => paymentState(i) === 'overdue')
        .reduce((s, i) => s + (i.balance_due ?? 0), 0),
    }
  }, [invoices])

  function exportCsv() {
    downloadCsv(`invoices-${todayISO()}`, rows, [
      { header: 'Invoice No', value: (r) => r.invoice_no },
      { header: 'Date', value: (r) => r.invoice_date },
      { header: 'Client', value: (r) => r.buyer_name },
      { header: 'GSTIN', value: (r) => r.buyer_gstin },
      { header: 'Place of Supply', value: (r) => r.place_of_supply },
      { header: 'Taxable Value', value: (r) => r.taxable_value },
      { header: 'CGST', value: (r) => r.cgst_amount },
      { header: 'SGST', value: (r) => r.sgst_amount },
      { header: 'IGST', value: (r) => r.igst_amount },
      { header: 'Round Off', value: (r) => r.round_off },
      { header: 'Invoice Value', value: (r) => r.total_amount },
      { header: 'Paid', value: (r) => r.amount_paid },
      { header: 'Balance', value: (r) => r.balance_due },
      { header: 'Due Date', value: (r) => r.due_date },
      { header: 'Status', value: (r) => paymentState(r) },
    ])
  }

  return (
    <div>
      <PageHeader title="Tax Invoices" description="GST invoices raised from delivery challans">
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="w-4 h-4" />
          Export
        </Button>
        {canBill && (
          <Link href={'/invoices/new' as Route}>
            <Button size="sm">
              <Plus className="w-4 h-4" />
              New Invoice
            </Button>
          </Link>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Invoiced this month" value={formatCurrency(stats.thisMonth)} icon={<Receipt className="w-5 h-5" />} />
        <StatCard label="Outstanding" value={formatCurrency(stats.outstanding)} icon={<IndianRupee className="w-5 h-5" />} />
        <StatCard
          label="Overdue"
          value={formatCurrency(stats.overdue)}
          icon={<AlertTriangle className="w-5 h-5" />}
          className={stats.overdue > 0 ? 'border-red-200' : undefined}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 flex flex-wrap items-center gap-3 border-b border-slate-100">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  filter === f.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Invoice no., client or GSTIN…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <span className="text-xs text-slate-400 ml-auto">{rows.length} invoices</span>
        </div>

        {isLoading ? (
          <TableLoader />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="text-left px-4 py-3">Invoice</th>
                  <th className="text-left px-4 py-3">Client</th>
                  <th className="text-right px-4 py-3">Taxable</th>
                  <th className="text-right px-4 py-3">GST</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-right px-4 py-3">Balance</th>
                  <th className="text-left px-4 py-3">Due</th>
                  <th className="text-center px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400 text-sm">
                      {invoices?.length ? 'No invoices match this filter' : 'No invoices yet — raise one from a delivered challan'}
                    </td>
                  </tr>
                )}
                {rows.map((inv) => (
                  <tr key={inv.id} className={`hover:bg-slate-50 ${inv.status === 'cancelled' ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/invoices/${inv.id}` as Route}
                        className="font-mono text-sm font-semibold text-blue-600 hover:underline"
                      >
                        {inv.invoice_no}
                      </Link>
                      <div className="text-xs text-slate-400">{formatDate(inv.invoice_date)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{inv.buyer_name}</div>
                      <div className="text-xs text-slate-400 font-mono">{inv.buyer_gstin ?? 'Unregistered'}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{formatCurrency(inv.taxable_value)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {formatCurrency(inv.cgst_amount + inv.sgst_amount + inv.igst_amount)}
                      <div className="text-[10px] text-slate-400">{inv.is_interstate ? 'IGST' : 'CGST + SGST'}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                      {formatCurrency(inv.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {inv.status === 'cancelled' ? (
                        <span className="text-slate-300">—</span>
                      ) : (inv.balance_due ?? 0) > 0 ? (
                        <span className="font-medium text-amber-600">{formatCurrency(inv.balance_due)}</span>
                      ) : (
                        <span className="text-green-600">Nil</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(inv.due_date)}</td>
                    <td className="px-4 py-3 text-center">
                      <InvoiceStatusBadge invoice={inv} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
