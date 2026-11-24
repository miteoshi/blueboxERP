'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useQuery } from '@tanstack/react-query'
import { FileUp, X, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useOrg, useOrgId } from '@/lib/hooks/use-tenant'
import { useCan } from '@/lib/hooks/use-profile'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/card'
import { TableLoader } from '@/components/ui/spinner'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { allRows } from '@/lib/utils/all-rows'
import { downloadCsv, type CsvColumn } from '@/lib/utils/csv'
import {
  billTax, combineInvoices, docTax, parse2b, periodRange, reconcile, summarise,
  type BookBill, type MatchRow, type TwoBDoc, type TwoBFile,
} from '@/lib/gstr2b'

const TABS = ['Not in 2B', 'Differences', 'Not in books', 'Matched', 'Notes'] as const
type Tab = (typeof TABS)[number]
const HEAD = 'bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase'

type Loaded = TwoBFile & { fileName: string }

const monthLabel = (p: string) => {
  const [y, m] = p.split('-').map(Number)
  return y && m ? new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Unknown period'
}

// Posted bills from the earliest invoice date in the files to the end of the
// last month loaded (2B carries late-filed invoices of earlier months)
function useBills(from: string | null, to: string | null) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['gstr2b-bills', orgId, from, to],
    queryFn: async (): Promise<BookBill[]> => {
      const { data, error } = await allRows(supabase
        .from('supplier_bills')
        .select('id, bill_no, supplier_invoice_no, bill_date, supplier_gstin, taxable_value, igst_amount, cgst_amount, sgst_amount, total_amount, supplier:suppliers ( name )')
        .eq('status', 'posted')
        .gte('bill_date', from!)
        .lte('bill_date', to!)
        .order('bill_date')
        .order('id'))
      if (error) throw error
      return (data ?? []).map((b) => ({
        id: b.id, bill_no: b.bill_no, supplier_invoice_no: b.supplier_invoice_no, bill_date: b.bill_date,
        supplier_gstin: b.supplier_gstin, supplier_name: b.supplier?.name ?? '',
        taxable: Number(b.taxable_value), igst: Number(b.igst_amount), cgst: Number(b.cgst_amount),
        sgst: Number(b.sgst_amount), total: Number(b.total_amount),
      }))
    },
    enabled: !!orgId && !!from && !!to,
    staleTime: 60 * 1000,
  })
}

// Why 2B marks credit as not available (rsn)
const REASONS: Record<string, string> = { P: 'place of supply', C: 'filed after the time limit' }
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`

function Flags({ d }: { d: TwoBDoc }) {
  const flags = [
    !d.itcAvailable && `No credit per 2B${d.reason ? ` (${REASONS[d.reason.toUpperCase()] ?? d.reason})` : ''}`,
    d.reverseCharge && 'Reverse charge',
    d.originalNo && `Amended from ${d.originalNo}`,
  ].filter(Boolean) as string[]
  if (!flags.length) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {flags.map((f) => <span key={f} className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">{f}</span>)}
    </div>
  )
}

function BillLink({ b }: { b: BookBill }) {
  return (
    <Link href={`/supplier-bills/${b.id}` as Route} className="font-mono font-semibold text-blue-600 hover:underline">{b.bill_no}</Link>
  )
}

function Supplier({ name, gstin }: { name: string; gstin: string | null }) {
  return (
    <>
      <div className="font-medium text-slate-900">{name || '—'}</div>
      {gstin && <div className="font-mono text-xs text-slate-400">{gstin}</div>}
    </>
  )
}

const Money = ({ v, className = '' }: { v: number; className?: string }) => (
  <span className={`tabular-nums ${className}`}>{formatCurrency(v)}</span>
)

const Diff = ({ v }: { v: number }) =>
  Math.abs(v) < 0.005 ? <span className="text-slate-400">—</span> : <Money v={v} className={v > 0 ? 'text-red-600' : 'text-amber-700'} />

export default function Gstr2bPage() {
  const canView = useCan('viewPayables')
  const org = useOrg()
  const [files, setFiles] = useState<Loaded[]>([])
  const [problems, setProblems] = useState<string[]>([])
  const [tab, setTab] = useState<Tab>('Not in 2B')

  async function pick(list: FileList | null) {
    if (!list?.length) return
    const errs: string[] = []
    const read: Loaded[] = []
    for (const file of Array.from(list)) {
      try {
        const f = parse2b(await file.text())
        if (!f.period) errs.push(`${file.name}: the return period (rtnprd) is missing.`)
        else read.push({ ...f, fileName: file.name })
      } catch (e) {
        errs.push(`${file.name}: ${e instanceof Error ? e.message : 'could not be read'}`)
      }
    }
    // A second file for the same month replaces the first
    setFiles((prev) => [...prev.filter((p) => !read.some((r) => r.period === p.period)), ...read].sort((a, b) => a.period.localeCompare(b.period)))
    setProblems(errs)
  }

  const invoices = useMemo(() => combineInvoices(files), [files])
  const notes = useMemo(() => files.flatMap((f) => f.docs.filter((d) => d.kind !== 'invoice')), [files])
  const range = useMemo(() => periodRange(files.map((f) => f.period)), [files])
  const from = useMemo(() => {
    if (!range) return null
    const dates = invoices.map((d) => d.date).filter(Boolean).sort()
    return dates[0] && dates[0] < range.from ? dates[0] : range.from
  }, [invoices, range])
  const { data: bills, isLoading, error } = useBills(from, range?.to ?? null)

  const rows = useMemo(() => (bills && range ? reconcile(invoices, bills, range.from, range.to) : []), [bills, invoices, range])
  const summary = useMemo(() => summarise(rows, notes), [rows, notes])
  const byStatus = (s: MatchRow['status']) => rows.filter((r) => r.status === s)
  const onlyBooks = byStatus('only_books')
  const different = byStatus('different')
  const only2b = byStatus('only_2b')
  const matched = byStatus('matched')

  const ownGstin = (org?.gst_number ?? '').toUpperCase()
  const otherGstin = files.filter((f) => ownGstin && f.gstin && f.gstin !== ownGstin)
  const skipped = files.flatMap((f) => f.skipped)

  const counts: Record<Tab, number> = {
    'Not in 2B': onlyBooks.length, Differences: different.length, 'Not in books': only2b.length, Matched: matched.length, Notes: notes.length,
  }

  function exportTab() {
    const tag = files.map((f) => f.period).join('_')
    const docCols: CsvColumn<MatchRow>[] = [
      { header: 'Supplier GSTIN', value: (r) => r.doc?.ctin ?? r.bill?.supplier_gstin },
      { header: 'Supplier', value: (r) => r.doc?.name || r.bill?.supplier_name },
      { header: 'Invoice no (2B)', value: (r) => r.doc?.no },
      { header: 'Invoice date (2B)', value: (r) => r.doc?.date },
      { header: '2B period', value: (r) => r.doc?.period },
      { header: 'Bill', value: (r) => r.bill?.bill_no },
      { header: 'Invoice no (books)', value: (r) => r.bill?.supplier_invoice_no },
      { header: 'Bill date', value: (r) => r.bill?.bill_date },
      { header: 'Taxable (books)', value: (r) => r.bill?.taxable },
      { header: 'Taxable (2B)', value: (r) => r.doc?.taxable },
      { header: 'IGST (books)', value: (r) => r.bill?.igst },
      { header: 'IGST (2B)', value: (r) => r.doc?.igst },
      { header: 'CGST (books)', value: (r) => r.bill?.cgst },
      { header: 'CGST (2B)', value: (r) => r.doc?.cgst },
      { header: 'SGST (books)', value: (r) => r.bill?.sgst },
      { header: 'SGST (2B)', value: (r) => r.doc?.sgst },
      { header: 'Cess (2B)', value: (r) => r.doc?.cess },
      { header: 'Credit available (2B)', value: (r) => (r.doc ? (r.doc.itcAvailable ? 'Y' : 'N') : '') },
      { header: 'Reverse charge', value: (r) => (r.doc ? (r.doc.reverseCharge ? 'Y' : 'N') : '') },
      { header: 'Possible bill', value: (r) => (r.suggestion ? `${r.suggestion.bill_no} (${r.suggestion.supplier_invoice_no})` : '') },
    ]
    if (tab === 'Notes') {
      return downloadCsv(`gstr2b-notes-${tag}`, notes, [
        { header: 'Type', value: (d) => (d.kind === 'credit_note' ? 'Credit note' : 'Debit note') },
        { header: 'Supplier GSTIN', value: (d) => d.ctin },
        { header: 'Supplier', value: (d) => d.name },
        { header: 'Note no', value: (d) => d.no },
        { header: 'Date', value: (d) => d.date },
        { header: '2B period', value: (d) => d.period },
        { header: 'Taxable', value: (d) => d.taxable },
        { header: 'IGST', value: (d) => d.igst },
        { header: 'CGST', value: (d) => d.cgst },
        { header: 'SGST', value: (d) => d.sgst },
        { header: 'Cess', value: (d) => d.cess },
        { header: 'Credit available', value: (d) => (d.itcAvailable ? 'Y' : 'N') },
      ])
    }
    const list = tab === 'Not in 2B' ? onlyBooks : tab === 'Differences' ? different : tab === 'Not in books' ? only2b : matched
    downloadCsv(`gstr2b-${tab.toLowerCase().replace(/\s+/g, '-')}-${tag}`, list, docCols)
  }

  if (!canView) {
    return (
      <div>
        <PageHeader title="GSTR-2B match" />
        <p className="text-sm text-slate-500">Matching GSTR-2B needs access to supplier bills (admin, manager or viewer).</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="GSTR-2B match" description="Supplier bills checked against the input credit your suppliers have reported">
        {files.length > 0 && (
          <Button variant="outline" size="sm" onClick={exportTab} disabled={isLoading}>
            <Download className="w-4 h-4" />
            Export {tab} CSV
          </Button>
        )}
      </PageHeader>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-6 space-y-3">
        <label className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
            <FileUp className="w-4 h-4" />
            {files.length ? 'Add another month' : 'Load GSTR-2B JSON'}
          </span>
          <input
            type="file"
            accept=".json,application/json"
            multiple
            className="sr-only"
            onChange={(e) => { void pick(e.target.files); e.target.value = '' }}
          />
          {files.map((f) => (
            <span key={f.period} className="inline-flex items-center gap-1.5 text-sm bg-slate-100 text-slate-700 rounded-full pl-3 pr-1 py-1">
              {monthLabel(f.period)}
              <span className="text-xs text-slate-400">· {f.docs.length} docs</span>
              <button
                type="button"
                aria-label={`Remove ${monthLabel(f.period)}`}
                onClick={() => setFiles((prev) => prev.filter((p) => p.period !== f.period))}
                className="p-0.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </label>
        <p className="text-xs text-slate-500">
          On the GST portal: Services → Returns → Returns Dashboard → pick the month → GSTR-2B → Download → Generate JSON file.
          Load one month or several. The file is read here in your browser and not uploaded.
        </p>
        {problems.map((p) => <p key={p} className="text-sm text-red-600 break-words">{p}</p>)}
        {otherGstin.map((f) => (
          <p key={f.period} className="text-sm text-amber-700">
            The {monthLabel(f.period)} file is for GSTIN {f.gstin}, not yours ({ownGstin}).
          </p>
        ))}
        {skipped.length > 0 && (
          <p className="text-xs text-slate-500">
            Not matched here (no supplier bills for these): {[...new Set(skipped.map((s) => s.section.toUpperCase()))].join(', ')}.
          </p>
        )}
      </div>

      {files.length === 0 ? null : error ? (
        <p className="text-sm text-red-600">Could not load supplier bills: {error.message}</p>
      ) : isLoading || !bills ? (
        <TableLoader />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <StatCard
              label="Credit in 2B"
              value={formatCurrency(summary.credit2b)}
              sub={summary.creditNotAvailable ? `${formatCurrency(summary.creditNotAvailable)} more not available` : `${plural(invoices.length, 'invoice')}, ${plural(notes.length, 'note')}`}
            />
            <StatCard label="Matched" value={String(summary.matched)} sub={`of ${plural(invoices.length, 'invoice')} in 2B`} />
            <StatCard
              label="Bills not in 2B"
              value={formatCurrency(summary.creditAtRisk)}
              sub={summary.onlyBooks ? `${plural(summary.onlyBooks, 'bill')} · credit at risk` : 'Every bill is in 2B'}
              className={summary.onlyBooks ? 'ring-1 ring-red-200' : ''}
            />
            <StatCard
              label="Amounts differ"
              value={formatCurrency(summary.creditDifference)}
              sub={summary.different ? `${plural(summary.different, 'invoice')} · books − 2B` : 'No differences'}
              className={summary.different ? 'ring-1 ring-amber-200' : ''}
            />
          </div>

          <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-lg w-fit max-w-full overflow-x-auto *:shrink-0 *:whitespace-nowrap">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t} <span className="text-xs text-slate-400">{counts[t]}</span>
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-500 mb-3">
            {tab === 'Not in 2B' && 'Bills dated in the loaded months that no supplier has reported yet. Credit on these can’t be claimed until they appear — ask the supplier to file GSTR-1.'}
            {tab === 'Differences' && 'The same invoice with different amounts (more than ₹1 a head). Differences are books − 2B: red means you recorded more than the supplier reported.'}
            {tab === 'Not in books' && 'Invoices your suppliers reported that match no posted bill. Record the bill, or correct its invoice number or supplier GSTIN.'}
            {tab === 'Matched' && 'Invoices that agree within ₹1 a head.'}
            {tab === 'Notes' && 'Credit and debit notes your suppliers reported. A credit note reduces your credit, a debit note adds to it.'}
          </p>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              {tab === 'Not in 2B' && (
                <table className="stack w-full text-sm">
                  <thead><tr className={HEAD}>
                    <th className="text-left px-4 py-3">Bill</th>
                    <th className="text-left px-4 py-3">Supplier</th>
                    <th className="text-left px-4 py-3">Invoice no</th>
                    <th className="text-right px-4 py-3">Taxable</th>
                    <th className="text-right px-4 py-3">Tax</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {onlyBooks.length === 0 && <Empty cols={5} text="Every bill in these months is in GSTR-2B." />}
                    {onlyBooks.map((r) => (
                      <tr key={r.bill!.id} className="hover:bg-slate-50">
                        <td data-main className="px-4 py-3"><BillLink b={r.bill!} /><div className="text-xs text-slate-400">{formatDate(r.bill!.bill_date)}</div></td>
                        <td data-label="Supplier" className="px-4 py-3"><Supplier name={r.bill!.supplier_name} gstin={r.bill!.supplier_gstin} /></td>
                        <td data-label="Invoice no" className="px-4 py-3 font-mono text-xs">{r.bill!.supplier_invoice_no}</td>
                        <td data-label="Taxable" className="px-4 py-3 text-right"><Money v={r.bill!.taxable} /></td>
                        <td data-label="Tax" className="px-4 py-3 text-right font-semibold"><Money v={billTax(r.bill!)} className="text-red-600" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === 'Differences' && (
                <table className="stack w-full text-sm">
                  <thead><tr className={HEAD}>
                    <th className="text-left px-4 py-3">Invoice</th>
                    <th className="text-left px-4 py-3">Supplier</th>
                    <th className="text-right px-4 py-3">Taxable</th>
                    <th className="text-right px-4 py-3">IGST</th>
                    <th className="text-right px-4 py-3">CGST</th>
                    <th className="text-right px-4 py-3">SGST</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {different.length === 0 && <Empty cols={6} text="No differences." />}
                    {different.map((r) => (
                      <tr key={r.bill!.id} className="hover:bg-slate-50">
                        <td data-main className="px-4 py-3">
                          <div className="font-mono text-xs text-slate-700">{r.doc!.no}</div>
                          <div className="text-xs text-slate-400"><BillLink b={r.bill!} /> · {formatDate(r.doc!.date)}</div>
                          <Flags d={r.doc!} />
                        </td>
                        <td data-label="Supplier" className="px-4 py-3"><Supplier name={r.doc!.name || r.bill!.supplier_name} gstin={r.doc!.ctin} /></td>
                        {(['taxable', 'igst', 'cgst', 'sgst'] as const).map((k) => (
                          <td key={k} data-label={k === 'taxable' ? 'Taxable' : k.toUpperCase()} className="px-4 py-3 text-right">
                            <div><Diff v={r.diff![k]} /></div>
                            <div className="text-xs text-slate-400 tabular-nums whitespace-nowrap">{formatCurrency(r.bill![k])} vs {formatCurrency(r.doc![k])}</div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === 'Not in books' && (
                <table className="stack w-full text-sm">
                  <thead><tr className={HEAD}>
                    <th className="text-left px-4 py-3">Invoice</th>
                    <th className="text-left px-4 py-3">Supplier</th>
                    <th className="text-right px-4 py-3">Value</th>
                    <th className="text-right px-4 py-3">Tax</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {only2b.length === 0 && <Empty cols={4} text="Every invoice in GSTR-2B is in your books." />}
                    {only2b.map((r) => (
                      <tr key={`${r.doc!.ctin}|${r.doc!.no}`} className="hover:bg-slate-50">
                        <td data-main className="px-4 py-3">
                          <div className="font-mono text-xs font-semibold text-slate-800">{r.doc!.no}</div>
                          <div className="text-xs text-slate-400">{formatDate(r.doc!.date)} · in {monthLabel(r.doc!.period)} 2B</div>
                          <Flags d={r.doc!} />
                          {r.suggestion && (
                            <div className="text-xs text-blue-700 mt-1">
                              Same supplier and total: <BillLink b={r.suggestion} /> recorded as {r.suggestion.supplier_invoice_no}
                            </div>
                          )}
                        </td>
                        <td data-label="Supplier" className="px-4 py-3"><Supplier name={r.doc!.name} gstin={r.doc!.ctin} /></td>
                        <td data-label="Value" className="px-4 py-3 text-right"><Money v={r.doc!.value} /></td>
                        <td data-label="Tax" className="px-4 py-3 text-right font-semibold"><Money v={docTax(r.doc!)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === 'Matched' && (
                <table className="stack w-full text-sm">
                  <thead><tr className={HEAD}>
                    <th className="text-left px-4 py-3">Invoice</th>
                    <th className="text-left px-4 py-3">Supplier</th>
                    <th className="text-right px-4 py-3">Taxable</th>
                    <th className="text-right px-4 py-3">Tax</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {matched.length === 0 && <Empty cols={4} text="Nothing matched yet." />}
                    {matched.map((r) => (
                      <tr key={r.bill!.id} className="hover:bg-slate-50">
                        <td data-main className="px-4 py-3">
                          <div className="font-mono text-xs text-slate-700">{r.doc!.no}</div>
                          <div className="text-xs text-slate-400"><BillLink b={r.bill!} /> · {formatDate(r.doc!.date)}</div>
                          <Flags d={r.doc!} />
                        </td>
                        <td data-label="Supplier" className="px-4 py-3"><Supplier name={r.doc!.name || r.bill!.supplier_name} gstin={r.doc!.ctin} /></td>
                        <td data-label="Taxable" className="px-4 py-3 text-right"><Money v={r.doc!.taxable} /></td>
                        <td data-label="Tax" className="px-4 py-3 text-right"><Money v={docTax(r.doc!)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === 'Notes' && (
                <table className="stack w-full text-sm">
                  <thead><tr className={HEAD}>
                    <th className="text-left px-4 py-3">Note</th>
                    <th className="text-left px-4 py-3">Supplier</th>
                    <th className="text-right px-4 py-3">Taxable</th>
                    <th className="text-right px-4 py-3">Tax</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {notes.length === 0 && <Empty cols={4} text="No credit or debit notes in these months." />}
                    {notes.map((d) => (
                      <tr key={`${d.period}|${d.ctin}|${d.no}`} className="hover:bg-slate-50">
                        <td data-main className="px-4 py-3">
                          <div className="font-mono text-xs font-semibold text-slate-800">{d.no}</div>
                          <div className="text-xs text-slate-400">{d.kind === 'credit_note' ? 'Credit note' : 'Debit note'} · {formatDate(d.date)}</div>
                          <Flags d={d} />
                        </td>
                        <td data-label="Supplier" className="px-4 py-3"><Supplier name={d.name} gstin={d.ctin} /></td>
                        <td data-label="Taxable" className="px-4 py-3 text-right"><Money v={d.taxable} /></td>
                        <td data-label="Tax" className="px-4 py-3 text-right">
                          <Money v={d.kind === 'credit_note' ? -docTax(d) : docTax(d)} className={d.kind === 'credit_note' ? 'text-amber-700' : ''} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Empty({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="text-center py-12 text-slate-400 text-sm">{text}</td>
    </tr>
  )
}
