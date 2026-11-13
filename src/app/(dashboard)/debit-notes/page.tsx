'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TableLoader } from '@/components/ui/spinner'
import { debitNoteReasonLabel, useDebitNotes } from '@/lib/hooks/use-payables'
import { useCan } from '@/lib/hooks/use-profile'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils/format'
import { downloadCsv } from '@/lib/utils/csv'
import { Download, PackageX, Plus, Search, Undo2 } from 'lucide-react'

export default function DebitNotesPage() {
  const canManage = useCan('managePayables')
  const { data: notes, isLoading } = useDebitNotes()
  const [search, setSearch] = useState('')
  const [showCancelled, setShowCancelled] = useState(false)

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (notes ?? []).filter(
      (n) =>
        (showCancelled || n.status === 'issued') &&
        (!term ||
          n.debit_note_no.toLowerCase().includes(term) ||
          (n.supplier?.name ?? '').toLowerCase().includes(term) ||
          (n.bill?.bill_no ?? '').toLowerCase().includes(term) ||
          (n.bill?.supplier_invoice_no ?? '').toLowerCase().includes(term)),
    )
  }, [notes, search, showCancelled])

  const stats = useMemo(() => {
    const issued = (notes ?? []).filter((n) => n.status === 'issued')
    return {
      count: issued.length,
      value: issued.reduce((s, n) => s + n.total_amount, 0),
      gst: issued.reduce((s, n) => s + n.cgst_amount + n.sgst_amount + n.igst_amount, 0),
      returns: issued.filter((n) => n.reason === 'purchase_return').length,
    }
  }, [notes])

  function exportCsv() {
    downloadCsv(`debit-notes-${todayISO()}`, rows, [
      { header: 'Debit Note No', value: (n) => n.debit_note_no },
      { header: 'Date', value: (n) => n.note_date },
      { header: 'Supplier', value: (n) => n.supplier?.name },
      { header: 'Against Bill', value: (n) => n.bill?.bill_no },
      { header: 'Supplier Invoice No', value: (n) => n.bill?.supplier_invoice_no },
      { header: 'Reason', value: (n) => debitNoteReasonLabel(n.reason) },
      { header: 'Stock Returned', value: (n) => n.returned_stock },
      { header: 'Taxable Value', value: (n) => n.taxable_value },
      { header: 'IGST', value: (n) => n.igst_amount },
      { header: 'CGST', value: (n) => n.cgst_amount },
      { header: 'SGST', value: (n) => n.sgst_amount },
      { header: 'Total', value: (n) => n.total_amount },
      { header: 'Status', value: (n) => n.status },
    ])
  }

  return (
    <div>
      <PageHeader title="Debit Notes" description="Purchase returns and other reductions to what you owe suppliers">
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="w-4 h-4" />
          Export
        </Button>
        {canManage && (
          <Link href={'/debit-notes/new' as Route}>
            <Button size="sm">
              <Plus className="w-4 h-4" />
              Raise Debit Note
            </Button>
          </Link>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Debit notes" value={String(stats.count)} icon={<Undo2 className="w-5 h-5" />} />
        <StatCard label="Total value" value={formatCurrency(stats.value)} />
        <StatCard label="Input GST reversed" value={formatCurrency(stats.gst)} sub="Taken off input credit" />
        <StatCard label="Goods returned" value={String(stats.returns)} icon={<PackageX className="w-5 h-5" />} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 flex flex-wrap items-center gap-3 border-b border-slate-100">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Note, bill or supplier…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={showCancelled}
              onChange={(e) => setShowCancelled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Show cancelled
          </label>
          <span className="text-xs text-slate-400 ml-auto">{rows.length} notes</span>
        </div>

        {isLoading ? (
          <TableLoader />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="text-left px-4 py-3">Note</th>
                  <th className="text-left px-4 py-3">Supplier</th>
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
                      {notes?.length ? 'No debit notes here' : 'No debit notes yet'}
                    </td>
                  </tr>
                )}
                {rows.map((n) => (
                  <tr key={n.id} className={`hover:bg-slate-50 ${n.status === 'cancelled' ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <Link href={`/debit-notes/${n.id}` as Route} className="font-mono text-sm font-semibold text-blue-600 hover:underline">
                        {n.debit_note_no}
                      </Link>
                      <div className="text-xs text-slate-400">{formatDate(n.note_date)}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{n.supplier?.name}</td>
                    <td className="px-4 py-3">
                      <Link href={`/supplier-bills/${n.bill?.id}` as Route} className="font-mono text-xs text-blue-600 hover:underline">
                        {n.bill?.bill_no}
                      </Link>
                      <div className="text-xs text-slate-400">inv {n.bill?.supplier_invoice_no}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-600">{debitNoteReasonLabel(n.reason)}</span>
                      {n.returned_stock && <div className="text-xs text-slate-400">stock sent back</div>}
                      {n.status === 'cancelled' && (
                        <div className="mt-0.5">
                          <Badge variant="default">Cancelled</Badge>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(n.taxable_value)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(n.cgst_amount + n.sgst_amount + n.igst_amount)}
                      <div className="text-xs text-slate-400">{n.is_interstate ? 'IGST' : 'CGST+SGST'}</div>
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
