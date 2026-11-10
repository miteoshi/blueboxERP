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

const TABS = ['Summary', 'B2B', 'B2CL', 'B2CS', 'CDNR', 'CDNUR', 'HSN', 'Documents'] as const
type Tab = (typeof TABS)[number]

// Calendar maths on today's IST date, so server and browser agree
function monthRange(offset: number) {
  const [y, m] = todayISO().split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 + offset, 1))
  const last = new Date(Date.UTC(y, m + offset, 0))
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { from: iso(first), to: iso(last) }
}

function quarterRange() {
  const [y, m] = todayISO().split('-').map(Number)
  // Indian FY quarters: Apr–Jun, Jul–Sep, Oct–Dec, Jan–Mar
  const qStartMonth = Math.floor((m - 1) / 3) * 3
  const first = new Date(Date.UTC(y, qStartMonth, 1))
  const last = new Date(Date.UTC(y, qStartMonth + 3, 0))
  const iso = (d: Date) => d.toISOString().slice(0, 10)
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

function useCreditNotesForPeriod(from: string, to: string) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['gst-credit-notes', orgId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_notes')
        .select(`
          id, credit_note_no, note_date, status, buyer_gstin, place_of_supply, is_interstate,
          taxable_value, cgst_amount, sgst_amount, igst_amount, total_amount,
          client:clients ( name ),
          invoice:sales_invoices ( id, invoice_no, invoice_date, total_amount, buyer_name, reverse_charge ),
          credit_note_lines ( gst_rate, taxable_value, cgst_amount, sgst_amount, igst_amount )
        `)
        .gte('note_date', from)
        .lte('note_date', to)
        .order('credit_note_no')
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

  const { data: invoices, isLoading: loadingInvoices } = useInvoicesForPeriod(from, to)
  const { data: creditNotes, isLoading: loadingNotes } = useCreditNotesForPeriod(from, to)
  const isLoading = loadingInvoices || loadingNotes
  const { data: hsn, isLoading: loadingHsn } = useHsnSummary(from, to)
  const { data: states } = useGstStates()
  const stateLabel = (code: string | null) =>
    code ? `${code}-${states?.find((s) => s.code === code)?.name ?? ''}` : ''

  const issued = useMemo(() => (invoices ?? []).filter((i) => i.status === 'issued'), [invoices])
  const b2b = issued.filter((i) => !!i.buyer_gstin)
  const b2cl = issued.filter((i) => !i.buyer_gstin && i.is_interstate && i.total_amount > B2CL_THRESHOLD)
  const b2cInvoices = issued.filter((i) => !i.buyer_gstin && !(i.is_interstate && i.total_amount > B2CL_THRESHOLD))

  // Credit notes (Table 9B): registered buyers → CDNR; unregistered buyers on a
  // B2CL invoice → CDNUR; other B2C credit notes are netted into B2CS (Table 7).
  const issuedNotes = useMemo(() => (creditNotes ?? []).filter((n) => n.status === 'issued'), [creditNotes])
  const cdnr = issuedNotes.filter((n) => !!n.buyer_gstin)
  const cdnur = issuedNotes.filter(
    (n) => !n.buyer_gstin && n.is_interstate && (n.invoice?.total_amount ?? 0) > B2CL_THRESHOLD
  )
  const b2csNotes = issuedNotes.filter((n) => !cdnr.includes(n) && !cdnur.includes(n))

  // B2CS: consolidated by place of supply and rate, net of B2C credit notes
  const b2cs = useMemo(() => {
    const map = new Map<string, { pos: string; rate: number; taxable: number; igst: number; cgst: number; sgst: number }>()
    const add = (
      pos: string,
      l: { gst_rate: number; taxable_value: number; igst_amount: number; cgst_amount: number; sgst_amount: number },
      sign: 1 | -1
    ) => {
      const key = `${pos}|${l.gst_rate}`
      const row = map.get(key) ?? { pos, rate: l.gst_rate, taxable: 0, igst: 0, cgst: 0, sgst: 0 }
      row.taxable = r2(row.taxable + sign * l.taxable_value)
      row.igst = r2(row.igst + sign * l.igst_amount)
      row.cgst = r2(row.cgst + sign * l.cgst_amount)
      row.sgst = r2(row.sgst + sign * l.sgst_amount)
      map.set(key, row)
    }
    for (const inv of b2cInvoices) for (const l of inv.sales_invoice_lines) add(inv.place_of_supply, l, 1)
    for (const n of b2csNotes) for (const l of n.credit_note_lines) add(n.place_of_supply, l, -1)
    return [...map.values()].sort((a, b) => a.pos.localeCompare(b.pos) || a.rate - b.rate)
  }, [b2cInvoices, b2csNotes])

  // CDNR / CDNUR are reported note-wise and rate-wise
  type Note = (typeof issuedNotes)[number]
  const noteRateRows = (notes: Note[]) =>
    notes.flatMap((n) => {
      const byRate = new Map<number, number>()
      for (const l of n.credit_note_lines) byRate.set(l.gst_rate, r2((byRate.get(l.gst_rate) ?? 0) + l.taxable_value))
      return [...byRate.entries()].map(([rate, taxable]) => ({ note: n, rate, taxable }))
    })

  // Documents issued (GSTR-1 Table 13): per series, numbers used, cancelled
  const documents = useMemo(() => {
    type Doc = { nature: string; series: string; from: string; to: string; total: number; cancelled: number }
    const map = new Map<string, Doc>()
    const add = (nature: string, no: string, cancelled: boolean) => {
      const series = no.replace(/\d+$/, '')
      const key = `${nature}|${series}`
      const row = map.get(key) ?? { nature, series, from: no, to: no, total: 0, cancelled: 0 }
      if (no < row.from) row.from = no
      if (no > row.to) row.to = no
      row.total += 1
      if (cancelled) row.cancelled += 1
      map.set(key, row)
    }
    for (const inv of invoices ?? []) add('Invoices for outward supply', inv.invoice_no, inv.status === 'cancelled')
    for (const n of creditNotes ?? []) add('Credit Note', n.credit_note_no, n.status === 'cancelled')
    return [...map.values()]
  }, [invoices, creditNotes])

  // Net of credit notes issued in the period
  const totals = {
    taxable: sum(issued, (i) => i.taxable_value) - sum(issuedNotes, (n) => n.taxable_value),
    cgst: sum(issued, (i) => i.cgst_amount) - sum(issuedNotes, (n) => n.cgst_amount),
    sgst: sum(issued, (i) => i.sgst_amount) - sum(issuedNotes, (n) => n.sgst_amount),
    igst: sum(issued, (i) => i.igst_amount) - sum(issuedNotes, (n) => n.igst_amount),
    value: sum(issued, (i) => i.total_amount) - sum(issuedNotes, (n) => n.total_amount),
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
      case 'CDNR':
        return downloadCsv(`gstr1-cdnr-${tag}`, noteRateRows(cdnr), [
          { header: 'GSTIN/UIN of Recipient', value: (r) => r.note.buyer_gstin },
          { header: 'Receiver Name', value: (r) => r.note.invoice?.buyer_name ?? r.note.client?.name },
          { header: 'Note Number', value: (r) => r.note.credit_note_no },
          { header: 'Note Date', value: (r) => r.note.note_date },
          { header: 'Note Type', value: () => 'C' },
          { header: 'Place Of Supply', value: (r) => stateLabel(r.note.place_of_supply) },
          { header: 'Reverse Charge', value: (r) => (r.note.invoice?.reverse_charge ? 'Y' : 'N') },
          { header: 'Note Supply Type', value: () => 'Regular B2B' },
          { header: 'Note Value', value: (r) => r.note.total_amount },
          { header: 'Applicable % of Tax Rate', value: () => '' },
          { header: 'Rate', value: (r) => r.rate },
          { header: 'Taxable Value', value: (r) => r.taxable },
          { header: 'Cess Amount', value: () => 0 },
          { header: 'Original Invoice Number', value: (r) => r.note.invoice?.invoice_no },
          { header: 'Original Invoice Date', value: (r) => r.note.invoice?.invoice_date },
        ])
      case 'CDNUR':
        return downloadCsv(`gstr1-cdnur-${tag}`, noteRateRows(cdnur), [
          { header: 'UR Type', value: () => 'B2CL' },
          { header: 'Note Number', value: (r) => r.note.credit_note_no },
          { header: 'Note Date', value: (r) => r.note.note_date },
          { header: 'Note Type', value: () => 'C' },
          { header: 'Place Of Supply', value: (r) => stateLabel(r.note.place_of_supply) },
          { header: 'Note Value', value: (r) => r.note.total_amount },
          { header: 'Applicable % of Tax Rate', value: () => '' },
          { header: 'Rate', value: (r) => r.rate },
          { header: 'Taxable Value', value: (r) => r.taxable },
          { header: 'Cess Amount', value: () => 0 },
          { header: 'Original Invoice Number', value: (r) => r.note.invoice?.invoice_no },
          { header: 'Original Invoice Date', value: (r) => r.note.invoice?.invoice_date },
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
          { header: 'Nature of Document', value: (r) => r.nature },
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
      <PageHeader title="GST Reports" description="Outward supplies for GSTR-1, from issued tax invoices and credit notes">
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
        <StatCard label="Net taxable value" value={formatCurrency(totals.taxable)} sub="after credit notes" />
        <StatCard label="IGST" value={formatCurrency(totals.igst)} />
        <StatCard label="CGST" value={formatCurrency(totals.cgst)} />
        <StatCard label="SGST" value={formatCurrency(totals.sgst)} />
        <StatCard
          label="Net value"
          value={formatCurrency(totals.value)}
          sub={`${issued.length} invoices · ${issuedNotes.length} credit notes`}
        />
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
                <th className="text-right px-4 py-3">Documents</th>
                <th className="text-right px-4 py-3">Taxable</th>
                <th className="text-right px-4 py-3">IGST</th>
                <th className="text-right px-4 py-3">CGST</th>
                <th className="text-right px-4 py-3">SGST</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[
                { label: 'B2B — registered buyers (Table 4A)', rows: b2b, sign: 1 },
                { label: 'B2CL — inter-state B2C over ₹1 lakh (Table 5)', rows: b2cl, sign: 1 },
                { label: 'B2CS — other B2C invoices (Table 7)', rows: b2cInvoices, sign: 1 },
                { label: 'less: B2C credit notes netted in B2CS (Table 7)', rows: b2csNotes, sign: -1 },
                { label: 'CDNR — credit notes to registered buyers (Table 9B)', rows: cdnr, sign: -1 },
                { label: 'CDNUR — credit notes on B2CL invoices (Table 9B)', rows: cdnur, sign: -1 },
              ].map((s) => (
                <tr key={s.label} className={s.sign < 0 ? 'text-red-700' : undefined}>
                  <td className={`px-4 py-3 ${s.sign < 0 ? '' : 'text-slate-700'}`}>{s.label}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.rows.length}</td>
                  {(['taxable_value', 'igst_amount', 'cgst_amount', 'sgst_amount'] as const).map((k) => (
                    <td key={k} className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(s.sign * sum(s.rows as { [key in typeof k]: number }[], (i) => i[k]))}
                    </td>
                  ))}
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
        ) : tab === 'CDNR' || tab === 'CDNUR' ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <th className="text-left px-4 py-3">Credit note</th>
                <th className="text-left px-4 py-3">Buyer</th>
                <th className="text-left px-4 py-3">Original invoice</th>
                <th className="text-left px-4 py-3">POS</th>
                <th className="text-right px-4 py-3">Taxable</th>
                <th className="text-right px-4 py-3">IGST</th>
                <th className="text-right px-4 py-3">CGST + SGST</th>
                <th className="text-right px-4 py-3">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(tab === 'CDNR' ? cdnr : cdnur).length === 0 && <Empty cols={8} />}
              {(tab === 'CDNR' ? cdnr : cdnur).map((n) => (
                <tr key={n.id}>
                  <td className="px-4 py-3">
                    <Link href={`/credit-notes/${n.id}` as Route} className="font-mono text-xs text-blue-600 hover:underline">
                      {n.credit_note_no}
                    </Link>
                    <div className="text-xs text-slate-400">{formatDate(n.note_date)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{n.invoice?.buyer_name ?? n.client?.name}</div>
                    <div className="text-xs font-mono text-slate-400">{n.buyer_gstin ?? 'Unregistered'}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {n.invoice?.invoice_no}
                    <div className="text-slate-400">{formatDate(n.invoice?.invoice_date)}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{stateLabel(n.place_of_supply)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(n.taxable_value)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(n.igst_amount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(n.cgst_amount + n.sgst_amount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(n.total_amount)}</td>
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
                <th className="text-left px-4 py-3">Nature</th>
                <th className="text-left px-4 py-3">Series</th>
                <th className="text-left px-4 py-3">From</th>
                <th className="text-left px-4 py-3">To</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">Cancelled</th>
                <th className="text-right px-4 py-3">Net issued</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {documents.length === 0 && <Empty cols={7} />}
              {documents.map((d) => (
                <tr key={`${d.nature}-${d.series}`}>
                  <td className="px-4 py-3 text-xs text-slate-600">{d.nature}</td>
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
        Cancelled invoices and credit notes are excluded from tax totals and counted under Documents. Credit notes are
        reported in the period they are issued; HSN figures are net of them. Check figures against your books before
        filing.
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
