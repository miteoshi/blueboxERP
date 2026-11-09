'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { useGstStates, useHsnSummary } from '@/lib/hooks/use-finance'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { TableLoader } from '@/components/ui/spinner'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils/format'
import { financialYear } from '@/lib/gst'
import { downloadCsv, type CsvColumn } from '@/lib/utils/csv'
import { Download } from 'lucide-react'

// Inter-state B2C invoices above this value are reported invoice-wise
// (GSTR-1 Table 5, B2CL) — ₹1 lakh from 1 Aug 2024 (Notification 12/2024-CT).
const B2CL_THRESHOLD = 100000

const TABS = ['Summary', 'B2B', 'B2CL', 'B2CS', 'HSN', 'Documents'] as const
type Tab = (typeof TABS)[number]

function monthRange(offset: number) {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: iso(first), to: iso(last) }
}

function quarterRange() {
  const now = new Date()
  // Indian FY quarters: Apr–Jun, Jul–Sep, Oct–Dec, Jan–Mar
  const qStartMonth = Math.floor(now.getMonth() / 3) * 3
  const first = new Date(now.getFullYear(), qStartMonth, 1)
  const last = new Date(now.getFullYear(), qStartMonth + 3, 0)
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: iso(first), to: iso(last) }
}

function useInvoicesForPeriod(from: string, to: string) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['gst-invoices', orgId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_invoices')
        .select(`
          id, invoice_no, invoice_date, status, buyer_name, buyer_gstin, place_of_supply, is_interstate,
          reverse_charge, taxable_value, cgst_amount, sgst_amount, igst_amount, total_amount,
          sales_invoice_lines ( gst_rate, taxable_value, cgst_amount, sgst_amount, igst_amount )
        `)
        .gte('invoice_date', from)
        .lte('invoice_date', to)
        .order('invoice_no')
      if (error) throw error
      return data
    },
    enabled: !!orgId && !!from && !!to,
    staleTime: 60 * 1000,
  })
}

const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + (f(r) || 0), 0)
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export default function GstReportsPage() {
  const thisMonth = monthRange(0)
  const [from, setFrom] = useState(thisMonth.from)
  const [to, setTo] = useState(thisMonth.to)
  const [tab, setTab] = useState<Tab>('Summary')

  const { data: invoices, isLoading } = useInvoicesForPeriod(from, to)
  const { data: hsn, isLoading: loadingHsn } = useHsnSummary(from, to)
  const { data: states } = useGstStates()
  const stateLabel = (code: string | null) =>
    code ? `${code}-${states?.find((s) => s.code === code)?.name ?? ''}` : ''

  const issued = useMemo(() => (invoices ?? []).filter((i) => i.status === 'issued'), [invoices])
  const b2b = issued.filter((i) => !!i.buyer_gstin)
  const b2cl = issued.filter((i) => !i.buyer_gstin && i.is_interstate && i.total_amount > B2CL_THRESHOLD)
  const b2cInvoices = issued.filter((i) => !i.buyer_gstin && !(i.is_interstate && i.total_amount > B2CL_THRESHOLD))

  // B2CS: consolidated by place of supply and rate
  const b2cs = useMemo(() => {
    const map = new Map<string, { pos: string; rate: number; taxable: number; igst: number; cgst: number; sgst: number }>()
    for (const inv of b2cInvoices) {
      for (const l of inv.sales_invoice_lines) {
        const key = `${inv.place_of_supply}|${l.gst_rate}`
        const row = map.get(key) ?? { pos: inv.place_of_supply, rate: l.gst_rate, taxable: 0, igst: 0, cgst: 0, sgst: 0 }
        row.taxable = r2(row.taxable + l.taxable_value)
        row.igst = r2(row.igst + l.igst_amount)
        row.cgst = r2(row.cgst + l.cgst_amount)
        row.sgst = r2(row.sgst + l.sgst_amount)
        map.set(key, row)
      }
    }
    return [...map.values()].sort((a, b) => a.pos.localeCompare(b.pos) || a.rate - b.rate)
  }, [b2cInvoices])

  // Documents issued (GSTR-1 Table 13): per series, numbers used, cancelled
  const documents = useMemo(() => {
    const map = new Map<string, { series: string; from: string; to: string; total: number; cancelled: number }>()
    for (const inv of invoices ?? []) {
      const series = inv.invoice_no.replace(/\d+$/, '')
      const row = map.get(series) ?? { series, from: inv.invoice_no, to: inv.invoice_no, total: 0, cancelled: 0 }
      if (inv.invoice_no < row.from) row.from = inv.invoice_no
      if (inv.invoice_no > row.to) row.to = inv.invoice_no
      row.total += 1
      if (inv.status === 'cancelled') row.cancelled += 1
      map.set(series, row)
    }
    return [...map.values()]
  }, [invoices])

  const totals = {
    taxable: sum(issued, (i) => i.taxable_value),
    cgst: sum(issued, (i) => i.cgst_amount),
    sgst: sum(issued, (i) => i.sgst_amount),
    igst: sum(issued, (i) => i.igst_amount),
    value: sum(issued, (i) => i.total_amount),
  }

  type Inv = (typeof issued)[number]
  const invoiceColumns: CsvColumn<Inv>[] = [
    { header: 'GSTIN/UIN of Recipient', value: (i) => i.buyer_gstin },
    { header: 'Receiver Name', value: (i) => i.buyer_name },
    { header: 'Invoice Number', value: (i) => i.invoice_no },
    { header: 'Invoice date', value: (i) => i.invoice_date },
    { header: 'Invoice Value', value: (i) => i.total_amount },
    { header: 'Place Of Supply', value: (i) => stateLabel(i.place_of_supply) },
    { header: 'Reverse Charge', value: (i) => (i.reverse_charge ? 'Y' : 'N') },
    { header: 'Taxable Value', value: (i) => i.taxable_value },
    { header: 'IGST', value: (i) => i.igst_amount },
    { header: 'CGST', value: (i) => i.cgst_amount },
    { header: 'SGST', value: (i) => i.sgst_amount },
  ]

  function exportTab() {
    const tag = `${from}_to_${to}`
    switch (tab) {
      case 'Summary':
      case 'B2B':
        return downloadCsv(`gstr1-b2b-${tag}`, b2b, invoiceColumns)
      case 'B2CL':
        return downloadCsv(`gstr1-b2cl-${tag}`, b2cl, invoiceColumns.filter((c) => c.header !== 'GSTIN/UIN of Recipient'))
      case 'B2CS':
        return downloadCsv(`gstr1-b2cs-${tag}`, b2cs, [
          { header: 'Type', value: () => 'OE' },
          { header: 'Place Of Supply', value: (r) => stateLabel(r.pos) },
          { header: 'Rate', value: (r) => r.rate },
          { header: 'Taxable Value', value: (r) => r.taxable },
          { header: 'IGST', value: (r) => r.igst },
          { header: 'CGST', value: (r) => r.cgst },
          { header: 'SGST', value: (r) => r.sgst },
        ])
      case 'HSN':
        return downloadCsv(`gstr1-hsn-${tag}`, hsn ?? [], [
          { header: 'Type', value: (r) => (r.b2b ? 'B2B' : 'B2C') },
          { header: 'HSN', value: (r) => r.hsn_code },
          { header: 'Description', value: (r) => r.description },
          { header: 'UQC', value: (r) => r.unit_name },
          { header: 'Total Quantity', value: (r) => r.total_qty },
          { header: 'Total Value', value: (r) => r.total_value },
          { header: 'Rate', value: (r) => r.gst_rate },
          { header: 'Taxable Value', value: (r) => r.taxable_value },
          { header: 'Integrated Tax Amount', value: (r) => r.igst_amount },
          { header: 'Central Tax Amount', value: (r) => r.cgst_amount },
          { header: 'State/UT Tax Amount', value: (r) => r.sgst_amount },
        ])
      case 'Documents':
        return downloadCsv(`gstr1-docs-${tag}`, documents, [
          { header: 'Nature of Document', value: () => 'Invoices for outward supply' },
          { header: 'Sr. No. From', value: (r) => r.from },
          { header: 'Sr. No. To', value: (r) => r.to },
          { header: 'Total Number', value: (r) => r.total },
          { header: 'Cancelled', value: (r) => r.cancelled },
        ])
    }
  }

  const presets = [
    { label: 'This month', ...monthRange(0) },
    { label: 'Last month', ...monthRange(-1) },
    { label: 'This quarter', ...quarterRange() },
    { label: 'This FY', from: financialYear(todayISO()).from, to: financialYear(todayISO()).to },
  ]

  return (
    <div>
      <PageHeader title="GST Reports" description="Outward supplies for GSTR-1, from issued tax invoices">
        <Button variant="outline" size="sm" onClick={exportTab} disabled={isLoading}>
          <Download className="w-4 h-4" />
          Export {tab === 'Summary' ? 'B2B' : tab} CSV
        </Button>
      </PageHeader>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 flex flex-wrap items-end gap-3">
        <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <div className="flex gap-1">
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

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard label="Taxable value" value={formatCurrency(totals.taxable)} />
        <StatCard label="IGST" value={formatCurrency(totals.igst)} />
        <StatCard label="CGST" value={formatCurrency(totals.cgst)} />
        <StatCard label="SGST" value={formatCurrency(totals.sgst)} />
        <StatCard label="Invoice value" value={formatCurrency(totals.value)} sub={`${issued.length} invoices`} />
      </div>

      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-lg w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <TableLoader />
        ) : tab === 'Summary' ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <th className="text-left px-4 py-3">Section</th>
                <th className="text-right px-4 py-3">Invoices</th>
                <th className="text-right px-4 py-3">Taxable</th>
                <th className="text-right px-4 py-3">IGST</th>
                <th className="text-right px-4 py-3">CGST</th>
                <th className="text-right px-4 py-3">SGST</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[
                { label: 'B2B — registered buyers (Table 4A)', rows: b2b },
                { label: 'B2CL — inter-state B2C over ₹1 lakh (Table 5)', rows: b2cl },
                { label: 'B2CS — other B2C (Table 7)', rows: b2cInvoices },
              ].map((s) => (
                <tr key={s.label}>
                  <td className="px-4 py-3 text-slate-700">{s.label}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.rows.length}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(sum(s.rows, (i) => i.taxable_value))}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(sum(s.rows, (i) => i.igst_amount))}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(sum(s.rows, (i) => i.cgst_amount))}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(sum(s.rows, (i) => i.sgst_amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'B2B' || tab === 'B2CL' ? (
          <InvoiceTable rows={tab === 'B2B' ? b2b : b2cl} stateLabel={stateLabel} />
        ) : tab === 'B2CS' ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <th className="text-left px-4 py-3">Place of supply</th>
                <th className="text-right px-4 py-3">Rate</th>
                <th className="text-right px-4 py-3">Taxable</th>
                <th className="text-right px-4 py-3">IGST</th>
                <th className="text-right px-4 py-3">CGST</th>
                <th className="text-right px-4 py-3">SGST</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {b2cs.length === 0 && <Empty cols={6} />}
              {b2cs.map((r) => (
                <tr key={`${r.pos}-${r.rate}`}>
                  <td className="px-4 py-3">{stateLabel(r.pos)}</td>
                  <td className="px-4 py-3 text-right">{r.rate}%</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(r.taxable)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(r.igst)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(r.cgst)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(r.sgst)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'HSN' ? (
          loadingHsn ? (
            <TableLoader />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">HSN</th>
                  <th className="text-left px-4 py-3">Description</th>
                  <th className="text-right px-4 py-3">Qty</th>
                  <th className="text-right px-4 py-3">Rate</th>
                  <th className="text-right px-4 py-3">Taxable</th>
                  <th className="text-right px-4 py-3">IGST</th>
                  <th className="text-right px-4 py-3">CGST + SGST</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(hsn ?? []).length === 0 && <Empty cols={8} />}
                {(hsn ?? []).map((r) => (
                  <tr key={`${r.b2b}-${r.hsn_code}-${r.gst_rate}-${r.unit_name}`}>
                    <td className="px-4 py-3 text-xs">{r.b2b ? 'B2B' : 'B2C'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.hsn_code}</td>
                    <td className="px-4 py-3 text-slate-700">{r.description}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.total_qty} {r.unit_name}
                    </td>
                    <td className="px-4 py-3 text-right">{r.gst_rate}%</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(r.taxable_value)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(r.igst_amount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(r.cgst_amount + r.sgst_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <th className="text-left px-4 py-3">Series</th>
                <th className="text-left px-4 py-3">From</th>
                <th className="text-left px-4 py-3">To</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">Cancelled</th>
                <th className="text-right px-4 py-3">Net issued</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {documents.length === 0 && <Empty cols={6} />}
              {documents.map((d) => (
                <tr key={d.series}>
                  <td className="px-4 py-3 font-mono text-xs">{d.series}</td>
                  <td className="px-4 py-3 font-mono text-xs">{d.from}</td>
                  <td className="px-4 py-3 font-mono text-xs">{d.to}</td>
                  <td className="px-4 py-3 text-right">{d.total}</td>
                  <td className="px-4 py-3 text-right">{d.cancelled}</td>
                  <td className="px-4 py-3 text-right font-medium">{d.total - d.cancelled}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-slate-400 mt-3">
        Cancelled invoices are excluded from tax totals and counted under Documents. Check figures against your books
        before filing.
      </p>
    </div>
  )
}

function Empty({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="text-center py-10 text-slate-400 text-sm">
        Nothing in this period
      </td>
    </tr>
  )
}

function InvoiceTable({
  rows,
  stateLabel,
}: {
  rows: {
    id: string
    invoice_no: string
    invoice_date: string
    buyer_name: string
    buyer_gstin: string | null
    place_of_supply: string
    taxable_value: number
    igst_amount: number
    cgst_amount: number
    sgst_amount: number
    total_amount: number
  }[]
  stateLabel: (code: string | null) => string
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
          <th className="text-left px-4 py-3">Invoice</th>
          <th className="text-left px-4 py-3">Buyer</th>
          <th className="text-left px-4 py-3">POS</th>
          <th className="text-right px-4 py-3">Taxable</th>
          <th className="text-right px-4 py-3">IGST</th>
          <th className="text-right px-4 py-3">CGST + SGST</th>
          <th className="text-right px-4 py-3">Value</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {rows.length === 0 && <Empty cols={7} />}
        {rows.map((i) => (
          <tr key={i.id}>
            <td className="px-4 py-3">
              <Link href={`/invoices/${i.id}` as Route} className="font-mono text-xs text-blue-600 hover:underline">
                {i.invoice_no}
              </Link>
              <div className="text-xs text-slate-400">{formatDate(i.invoice_date)}</div>
            </td>
            <td className="px-4 py-3">
              <div>{i.buyer_name}</div>
              <div className="text-xs font-mono text-slate-400">{i.buyer_gstin ?? 'Unregistered'}</div>
            </td>
            <td className="px-4 py-3 text-xs">{stateLabel(i.place_of_supply)}</td>
            <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(i.taxable_value)}</td>
            <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(i.igst_amount)}</td>
            <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(i.cgst_amount + i.sgst_amount)}</td>
            <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(i.total_amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
