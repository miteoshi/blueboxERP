'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TableLoader } from '@/components/ui/spinner'
import { OPEN_PO_STATUSES, poStatus, usePurchaseOrders, type PurchaseOrderStatus } from '@/lib/hooks/use-purchasing'
import { useCan } from '@/lib/hooks/use-profile'
import { formatCurrency, formatDate, isPastDate, todayISO } from '@/lib/utils/format'
import { downloadCsv } from '@/lib/utils/csv'
import { AlertTriangle, ClipboardList, Download, FilePen, Plus, Search, Truck } from 'lucide-react'

const TABS = [
  { value: 'open', label: 'Open' },
  { value: 'draft', label: 'Drafts' },
  { value: 'done', label: 'Received' },
  { value: 'ended', label: 'Closed / cancelled' },
  { value: 'all', label: 'All' },
] as const
type Tab = (typeof TABS)[number]['value']

const inTab = (status: string, tab: Tab) => {
  switch (tab) {
    case 'open':
      return OPEN_PO_STATUSES.includes(status as PurchaseOrderStatus)
    case 'draft':
      return status === 'draft'
    case 'done':
      return status === 'received'
    case 'ended':
      return status === 'closed' || status === 'cancelled'
    default:
      return true
  }
}

export default function PurchaseOrdersPage() {
  const canDraft = useCan('draftPurchaseOrders')
  const { data: orders, isLoading } = usePurchaseOrders()
  const [tab, setTab] = useState<Tab>('open')
  const [search, setSearch] = useState('')

  // Value still to come on each order
  const enriched = useMemo(
    () =>
      (orders ?? []).map((o) => {
        const lines = o.purchase_order_lines ?? []
        // Progress by value, since lines can be in different units
        const ordered = lines.reduce((s, l) => s + Number(l.qty) * Number(l.rate), 0)
        const received = lines.reduce((s, l) => s + Number(l.qty_received) * Number(l.rate), 0)
        const pendingValue = Math.max(ordered - received, 0)
        const open = OPEN_PO_STATUSES.includes(o.status as PurchaseOrderStatus)
        return {
          ...o,
          progress: ordered > 0 ? received / ordered : 0,
          pendingValue: open ? pendingValue : 0,
          overdue: open && isPastDate(o.expected_date),
        }
      }),
    [orders],
  )

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return enriched.filter(
      (o) =>
        inTab(o.status, tab) &&
        (!term || o.po_no.toLowerCase().includes(term) || (o.supplier?.name ?? '').toLowerCase().includes(term)),
    )
  }, [enriched, tab, search])

  const stats = useMemo(() => {
    const open = enriched.filter((o) => OPEN_PO_STATUSES.includes(o.status as PurchaseOrderStatus))
    return {
      open: open.length,
      pendingValue: open.reduce((s, o) => s + o.pendingValue, 0),
      overdue: open.filter((o) => o.overdue).length,
      drafts: enriched.filter((o) => o.status === 'draft').length,
    }
  }, [enriched])

  function exportCsv() {
    downloadCsv(`purchase-orders-${todayISO()}`, rows, [
      { header: 'PO No', value: (r) => r.po_no },
      { header: 'Date', value: (r) => r.po_date },
      { header: 'Supplier', value: (r) => r.supplier?.name },
      { header: 'Expected', value: (r) => r.expected_date },
      { header: 'Status', value: (r) => poStatus(r.status).label },
      { header: 'Received %', value: (r) => Math.round(r.progress * 100) },
      { header: 'Taxable Value', value: (r) => r.taxable_value },
      { header: 'GST', value: (r) => r.gst_amount },
      { header: 'Total', value: (r) => r.total_amount },
      { header: 'Pending Value (taxable)', value: (r) => Math.round(r.pendingValue * 100) / 100 },
    ])
  }

  return (
    <div>
      <PageHeader title="Purchase Orders" description="Orders placed with suppliers and what is still to arrive">
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="w-4 h-4" />
          Export
        </Button>
        {canDraft && (
          <Link href={'/purchase-orders/new' as Route}>
            <Button size="sm">
              <Plus className="w-4 h-4" />
              New Purchase Order
            </Button>
          </Link>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Open orders" value={String(stats.open)} icon={<ClipboardList className="w-5 h-5" />} />
        <StatCard
          label="Still to arrive"
          value={formatCurrency(stats.pendingValue)}
          sub="Taxable value of open orders"
          icon={<Truck className="w-5 h-5" />}
        />
        <StatCard
          label="Overdue"
          value={String(stats.overdue)}
          sub="Past the expected date"
          icon={<AlertTriangle className="w-5 h-5" />}
          className={stats.overdue > 0 ? 'border-amber-200' : ''}
        />
        <StatCard label="Drafts to issue" value={String(stats.drafts)} icon={<FilePen className="w-5 h-5" />} />
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
              placeholder="PO number or supplier…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <span className="text-xs text-slate-400 ml-auto">{rows.length} orders</span>
        </div>

        {isLoading ? (
          <TableLoader />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="text-left px-4 py-3">PO</th>
                  <th className="text-left px-4 py-3">Supplier</th>
                  <th className="text-left px-4 py-3">Expected</th>
                  <th className="text-left px-4 py-3 w-40">Received</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-center px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                      {orders?.length ? 'No purchase orders here' : 'No purchase orders yet'}
                    </td>
                  </tr>
                )}
                {rows.map((o) => {
                  const st = poStatus(o.status)
                  return (
                    <tr key={o.id} className={`hover:bg-slate-50 ${o.status === 'cancelled' ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <Link
                          href={`/purchase-orders/${o.id}` as Route}
                          className="font-mono text-sm font-semibold text-blue-600 hover:underline"
                        >
                          {o.po_no}
                        </Link>
                        <div className="text-xs text-slate-400">{formatDate(o.po_date)}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{o.supplier?.name}</td>
                      <td className={`px-4 py-3 ${o.overdue ? 'text-amber-700 font-medium' : 'text-slate-600'}`}>
                        {o.expected_date ? formatDate(o.expected_date) : '—'}
                        {o.overdue && <div className="text-xs">Overdue</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-teal-500"
                            style={{ width: `${Math.min(o.progress * 100, 100)}%` }}
                          />
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {Math.round(o.progress * 100)}%
                          {o.pendingValue > 0 && ` · ${formatCurrency(o.pendingValue)} to come`}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                        {formatCurrency(o.total_amount)}
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
