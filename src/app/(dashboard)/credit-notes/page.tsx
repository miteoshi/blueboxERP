'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TableLoader } from '@/components/ui/spinner'
import { creditNoteReasonLabel, useCreditNotes } from '@/lib/hooks/use-finance'
import { useCanManageFinance } from '@/lib/hooks/use-profile'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils/format'
import { financialYear } from '@/lib/gst'
import { downloadCsv } from '@/lib/utils/csv'
import { Download, FileMinus, PackageCheck, Plus, Search } from 'lucide-react'

export default function CreditNotesPage() {
  const canManage = useCanManageFinance()
  const { data: notes, isLoading } = useCreditNotes()
  const [search, setSearch] = useState('')
  const [showCancelled, setShowCancelled] = useState(false)

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (notes ?? []).filter((n) => {
      if (!showCancelled && n.status === 'cancelled') return false
      if (!term) return true
      return (
        n.credit_note_no.toLowerCase().includes(term) ||
        (n.invoice?.invoice_no ?? '').toLowerCase().includes(term) ||
        (n.client?.name ?? '').toLowerCase().includes(term)
      )
    })
  }, [notes, search, showCancelled])

  const stats = useMemo(() => {
    const issued = (notes ?? []).filter((n) => n.status === 'issued')
    const fy = financialYear(todayISO())
    const month = todayISO().slice(0, 7)
    const inFy = issued.filter((n) => n.note_date >= fy.from && n.note_date <= fy.to)
    return {
      month: issued.filter((n) => n.note_date.startsWith(month)).reduce((s, n) => s + n.total_amount, 0),
      fy: inFy.reduce((s, n) => s + n.total_amount, 0),
      returns: inFy.filter((n) => n.reason === 'sales_return').length,
    }
  }, [notes])

  function exportCsv() {
    downloadCsv(`credit-notes-${todayISO()}`, rows, [
      { header: 'Credit Note No', value: (r) => r.credit_note_no },
      { header: 'Date', value: (r) => r.note_date },
      { header: 'Invoice No', value: (r) => r.invoice?.invoice_no },
      { header: 'Invoice Date', value: (r) => r.invoice?.invoice_date },
      { header: 'Client', value: (r) => r.client?.name },
      { header: 'GSTIN', value: (r) => r.buyer_gstin },
      { header: 'Reason', value: (r) => creditNoteReasonLabel(r.reason) },
      { header: 'Restocked', value: (r) => (r.restocked ? 'Y' : 'N') },
      { header: 'Taxable Value', value: (r) => r.taxable_value },
      { header: 'CGST', value: (r) => r.cgst_amount },
      { header: 'SGST', value: (r) => r.sgst_amount },
      { header: 'IGST', value: (r) => r.igst_amount },
      { header: 'Round Off', value: (r) => r.round_off },
      { header: 'Total', value: (r) => r.total_amount },
      { header: 'Status', value: (r) => r.status },
    ])
  }

  return (
    <div>
      <PageHeader title="Credit Notes" description="Sales returns and value reductions against tax invoices">
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="w-4 h-4" />
          Export
        </Button>
        {canManage && (
          <Link href={'/credit-notes/new' as Route}>
            <Button size="sm">
              <Plus className="w-4 h-4" />
              New Credit Note
            </Button>
          </Link>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Credited this month" value={formatCurrency(stats.month)} icon={<FileMinus className="w-5 h-5" />} />
        <StatCard label="Credited this FY" value={formatCurrency(stats.fy)} icon={<FileMinus className="w-5 h-5" />} />
        <StatCard label="Sales returns this FY" value={String(stats.returns)} icon={<PackageCheck className="w-5 h-5" />} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 flex flex-wrap items-center gap-3 border-b border-slate-100">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Credit note, invoice or client…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
            Show cancelled
          </label>
          <span className="text-xs text-slate-400 ml-auto">{rows.length} credit notes</span>
        </div>

        {isLoading ? (
          <TableLoader />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="text-left px-4 py-3">Credit note</th>
                  <th className="text-left px-4 py-3">Client</th>
                  <th className="text-left px-4 py-3">Against</th>
                  <th className="text-left px-4 py-3">Reason</th>
                  <th className="text-right px-4 py-3">Taxable</th>
                  <th className="text-right px-4 py-3">GST</th>
                  <th className="text-right px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400 text-sm">
                      {notes?.length ? 'No credit notes match' : 'No credit notes yet — issue one from an invoice'}
                    </td>
                  </tr>
                )}
                {rows.map((n) => (
                  <tr key={n.id} className={`hover:bg-slate-50 ${n.status === 'cancelled' ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/credit-notes/${n.id}` as Route}
                        className="font-mono text-sm font-semibold text-blue-600 hover:underline"
                      >
                        {n.credit_note_no}
                      </Link>
                      <div className="text-xs text-slate-400">{formatDate(n.note_date)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{n.client?.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{n.buyer_gstin ?? 'Unregistered'}</div>
                    </td>
                    <td className="px-4 py-3">
                      {n.invoice && (
                        <Link href={`/invoices/${n.invoice.id}` as Route} className="font-mono text-xs text-blue-600 hover:underline">
                          {n.invoice.invoice_no}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {creditNoteReasonLabel(n.reason)}
                      {n.restocked && <div className="text-xs text-slate-400">Restocked</div>}
                      {n.status === 'cancelled' && (
                        <div>
                          <Badge variant="default">Cancelled</Badge>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{formatCurrency(n.taxable_value)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {formatCurrency(n.cgst_amount + n.sgst_amount + n.igst_amount)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                      {formatCurrency(n.total_amount)}
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
