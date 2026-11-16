'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { creditNoteReasonLabel } from '@/lib/hooks/use-finance'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { TableLoader } from '@/components/ui/spinner'
import { formatCurrency, formatDate, formatQty } from '@/lib/utils/format'
import { allRows } from '@/lib/utils/all-rows'
import { reportPeriods } from '@/lib/utils/periods'
import { downloadCsv } from '@/lib/utils/csv'
import { Download } from 'lucide-react'

const TABS = ['Register', 'By customer', 'By item', 'By month'] as const
type Tab = (typeof TABS)[number]

const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + (f(r) || 0), 0)
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const tax = (d: { cgst_amount: number; sgst_amount: number; igst_amount: number }) =>
  d.cgst_amount + d.sgst_amount + d.igst_amount
const share = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '—')

// Issued tax invoices dated in the period, with their lines
function useInvoicesForPeriod(from: string, to: string) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['sales-register', orgId, from, to],
    queryFn: async () => {
      const { data, error } = await allRows(supabase
        .from('sales_invoices')
        .select(`
          id, invoice_no, invoice_date, client_id, buyer_name, buyer_gstin,
          taxable_value, cgst_amount, sgst_amount, igst_amount, total_amount,
          sales_invoice_lines (
            item_id, description, qty, unit_name, taxable_value,
            item:items ( item_code, name )
          )
        `)
        .eq('status', 'issued')
        .gte('invoice_date', from)
        .lte('invoice_date', to)
        .order('invoice_date')
        .order('invoice_no')
        .order('id'))
      if (error) throw error
      return data
    },
    enabled: !!orgId && !!from && !!to,
    staleTime: 60 * 1000,
  })
}

// Issued credit notes dated in the period take sales back out
function useCreditNotesForPeriod(from: string, to: string) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['sales-register-credit-notes', orgId, from, to],
    queryFn: async () => {
      const { data, error } = await allRows(supabase
        .from('credit_notes')
        .select(`
          id, credit_note_no, note_date, client_id, reason,
          taxable_value, cgst_amount, sgst_amount, igst_amount, total_amount,
          client:clients ( name ),
          invoice:sales_invoices ( invoice_no ),
          credit_note_lines (
            item_id, description, qty, unit_name, taxable_value,
            item:items ( item_code, name )
          )
        `)
        .eq('status', 'issued')
        .gte('note_date', from)
        .lte('note_date', to)
        .order('note_date')
        .order('credit_note_no')
        .order('id'))
      if (error) throw error
      return data
    },
    enabled: !!orgId && !!from && !!to,
    staleTime: 60 * 1000,
  })
}

const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export default function SalesRegisterPage() {
  const presets = reportPeriods()
  const thisFy = presets[presets.length - 1]
  const [from, setFrom] = useState(thisFy.from)
  const [to, setTo] = useState(thisFy.to)
  const [tab, setTab] = useState<Tab>('Register')

  const { data: invoices, isLoading: loadingInvoices } = useInvoicesForPeriod(from, to)
  const { data: creditNotes, isLoading: loadingNotes } = useCreditNotesForPeriod(from, to)
  const isLoading = loadingInvoices || loadingNotes

  const rows = useMemo(() => invoices ?? [], [invoices])
  const noteRows = useMemo(() => creditNotes ?? [], [creditNotes])

  const totals = {
    taxable: r2(sum(rows, (i) => i.taxable_value) - sum(noteRows, (n) => n.taxable_value)),
    tax: r2(sum(rows, tax) - sum(noteRows, tax)),
    value: r2(sum(rows, (i) => i.total_amount) - sum(noteRows, (n) => n.total_amount)),
    credited: r2(sum(noteRows, (n) => n.taxable_value)),
  }

  // One list in date order: invoices add, credit notes take away
  const register = useMemo(() => {
    const list = [
      ...rows.map((i) => ({
        key: `i${i.id}`,
        kind: 'Invoice' as const,
        href: `/invoices/${i.id}`,
        no: i.invoice_no,
        date: i.invoice_date,
        customer: i.buyer_name,
        gstin: i.buyer_gstin,
        note: '',
        taxable: i.taxable_value,
        tax: r2(tax(i)),
        value: i.total_amount,
      })),
      ...noteRows.map((n) => ({
        key: `n${n.id}`,
        kind: 'Credit note' as const,
        href: `/credit-notes/${n.id}`,
        no: n.credit_note_no,
        date: n.note_date,
        customer: n.client?.name ?? '—',
        gstin: null as string | null,
        note: `${creditNoteReasonLabel(n.reason)}${n.invoice?.invoice_no ? ` on ${n.invoice.invoice_no}` : ''}`,
        taxable: -n.taxable_value,
        tax: -r2(tax(n)),
        value: -n.total_amount,
      })),
    ]
    return list.sort((a, b) => a.date.localeCompare(b.date) || a.no.localeCompare(b.no))
  }, [rows, noteRows])

  const byCustomer = useMemo(() => {
    const map = new Map<string, { id: string; name: string; invoices: number; taxable: number; tax: number; value: number }>()
    const row = (id: string, name: string) => {
      const r = map.get(id) ?? { id, name, invoices: 0, taxable: 0, tax: 0, value: 0 }
      map.set(id, r)
      return r
    }
    for (const i of rows) {
      const r = row(i.client_id, i.buyer_name)
      r.invoices += 1
      r.taxable = r2(r.taxable + i.taxable_value)
      r.tax = r2(r.tax + tax(i))
      r.value = r2(r.value + i.total_amount)
    }
    for (const n of noteRows) {
      const r = row(n.client_id, n.client?.name ?? '—')
      r.taxable = r2(r.taxable - n.taxable_value)
      r.tax = r2(r.tax - tax(n))
      r.value = r2(r.value - n.total_amount)
    }
    return [...map.values()].sort((a, b) => b.taxable - a.taxable)
  }, [rows, noteRows])

  const byItem = useMemo(() => {
    const map = new Map<string, { key: string; code: string; name: string; unit: string; qty: number; taxable: number }>()
    const add = (
      l: { item_id: string; description: string; qty: number | null; unit_name: string | null; taxable_value: number; item?: { item_code: string; name: string } | null },
      sign: 1 | -1,
    ) => {
      const unit = l.unit_name ?? ''
      const key = `${l.item_id}|${unit}`
      const r = map.get(key) ?? { key, code: l.item?.item_code ?? '', name: l.item?.name ?? l.description, unit, qty: 0, taxable: 0 }
      // A credit note for rate or discount has no quantity: the value comes down, the quantity sold does not
      r.qty += sign * Number(l.qty ?? 0)
      r.taxable = r2(r.taxable + sign * l.taxable_value)
      map.set(key, r)
    }
    for (const i of rows) for (const l of i.sales_invoice_lines) add(l, 1)
    for (const n of noteRows) for (const l of n.credit_note_lines) add(l, -1)
    return [...map.values()].sort((a, b) => b.taxable - a.taxable)
  }, [rows, noteRows])

  const byMonth = useMemo(() => {
    const map = new Map<string, { month: string; invoices: number; taxable: number; tax: number; value: number }>()
    const row = (date: string) => {
      const month = date.slice(0, 7)
      const r = map.get(month) ?? { month, invoices: 0, taxable: 0, tax: 0, value: 0 }
      map.set(month, r)
      return r
    }
    for (const i of rows) {
      const r = row(i.invoice_date)
      r.invoices += 1
      r.taxable = r2(r.taxable + i.taxable_value)
      r.tax = r2(r.tax + tax(i))
      r.value = r2(r.value + i.total_amount)
    }
    for (const n of noteRows) {
      const r = row(n.note_date)
      r.taxable = r2(r.taxable - n.taxable_value)
      r.tax = r2(r.tax - tax(n))
      r.value = r2(r.value - n.total_amount)
    }
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
  }, [rows, noteRows])

  const top = byCustomer[0]

  function exportTab() {
    const tag = `${from}_${to}`
    switch (tab) {
      case 'By customer':
        return downloadCsv(`sales-by-customer-${tag}`, byCustomer, [
          { header: 'Customer', value: (r) => r.name },
          { header: 'Invoices', value: (r) => r.invoices },
          { header: 'Net Taxable Value', value: (r) => r.taxable },
          { header: 'GST', value: (r) => r.tax },
          { header: 'Net Value', value: (r) => r.value },
        ])
      case 'By item':
        return downloadCsv(`sales-by-item-${tag}`, byItem, [
          { header: 'Item Code', value: (r) => r.code },
          { header: 'Item', value: (r) => r.name },
          { header: 'Net Qty', value: (r) => r.qty },
          { header: 'Unit', value: (r) => r.unit },
          { header: 'Net Taxable Value', value: (r) => r.taxable },
        ])
      case 'By month':
        return downloadCsv(`sales-by-month-${tag}`, byMonth, [
          { header: 'Month', value: (r) => r.month },
          { header: 'Invoices', value: (r) => r.invoices },
          { header: 'Net Taxable Value', value: (r) => r.taxable },
          { header: 'GST', value: (r) => r.tax },
          { header: 'Net Value', value: (r) => r.value },
        ])
      default:
        return downloadCsv(`sales-register-${tag}`, register, [
          { header: 'Type', value: (r) => r.kind },
          { header: 'Document No', value: (r) => r.no },
          { header: 'Date', value: (r) => r.date },
          { header: 'Customer', value: (r) => r.customer },
          { header: 'GSTIN', value: (r) => r.gstin },
          { header: 'Taxable Value', value: (r) => r.taxable },
          { header: 'GST', value: (r) => r.tax },
          { header: 'Total', value: (r) => r.value },
        ])
    }
  }

  return (
    <div>
      <PageHeader title="Sales Register" description="Issued tax invoices less credit notes, by customer, item and month">
        <Button variant="outline" size="sm" onClick={exportTab} disabled={isLoading}>
          <Download className="w-4 h-4" />
          Export {tab === 'Register' ? 'register' : tab.toLowerCase()} CSV
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
          label="Net sales (taxable)"
          value={formatCurrency(totals.taxable)}
          sub={
            totals.credited > 0
              ? `after ${formatCurrency(totals.credited)} of credit notes`
              : `${rows.length} ${rows.length === 1 ? 'invoice' : 'invoices'}`
          }
        />
        <StatCard label="GST charged" value={formatCurrency(totals.tax)} />
        <StatCard
          label="Average invoice"
          value={rows.length ? formatCurrency(r2(sum(rows, (i) => i.taxable_value) / rows.length)) : '—'}
          sub={`${rows.length} ${rows.length === 1 ? 'invoice' : 'invoices'}, before tax`}
        />
        <StatCard
          label="Largest customer"
          value={top && top.taxable > 0 ? share(top.taxable, totals.taxable) : '—'}
          sub={top && top.taxable > 0 ? top.name : 'No sales in this period'}
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
        ) : tab === 'Register' ? (
          <div className="overflow-x-auto">
            <table className="stack w-full text-sm">
              <thead>
                <tr className={HEAD}>
                  <th className="text-left px-4 py-3">Document</th>
                  <th className="text-left px-4 py-3">Customer</th>
                  <th className="text-right px-4 py-3">Taxable</th>
                  <th className="text-right px-4 py-3">GST</th>
                  <th className="text-right px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {register.length === 0 && <Empty cols={5} />}
                {register.map((r) => (
                  <tr key={r.key} className={r.kind === 'Credit note' ? 'bg-amber-50/30' : undefined}>
                    <td data-main className="px-4 py-3">
                      <Link href={r.href as Route} className="font-mono font-semibold text-blue-600 hover:underline">
                        {r.no}
                      </Link>
                      <div className="text-xs text-slate-400">
                        {r.kind === 'Credit note' ? `${r.note} · ` : ''}
                        {formatDate(r.date)}
                      </div>
                    </td>
                    <td data-label="Customer" className="px-4 py-3">
                      <div className="font-medium text-slate-900">{r.customer}</div>
                      {r.gstin && <div className="text-xs font-mono text-slate-400">{r.gstin}</div>}
                    </td>
                    <Num label="Taxable" value={r.taxable} />
                    <Num label="GST" value={r.tax} />
                    <Num label="Total" value={r.value} bold />
                  </tr>
                ))}
              </tbody>
              {register.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
                    <td className="px-4 py-3">Net</td>
                    <td data-hide />
                    <Num value={totals.taxable} hide />
                    <Num value={totals.tax} hide />
                    <Num value={totals.value} bold />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : tab === 'By customer' ? (
          <div className="overflow-x-auto">
            <table className="stack w-full text-sm">
              <thead>
                <tr className={HEAD}>
                  <th className="text-left px-4 py-3">Customer</th>
                  <th className="text-right px-4 py-3">Invoices</th>
                  <th className="text-right px-4 py-3">Net taxable</th>
                  <th className="text-right px-4 py-3">GST</th>
                  <th className="text-right px-4 py-3">Net value</th>
                  <th className="text-right px-4 py-3">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {byCustomer.length === 0 && <Empty cols={6} />}
                {byCustomer.map((r) => (
                  <tr key={r.id}>
                    <td data-main className="px-4 py-3">
                      <div className="font-medium text-slate-900">{r.name}</div>
                      <Link
                        href={`/statements?party=client&id=${r.id}&from=${from}&to=${to}` as Route}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Statement
                      </Link>
                    </td>
                    <td data-label="Invoices" className="px-4 py-3 text-right tabular-nums">{r.invoices}</td>
                    <Num label="Net taxable" value={r.taxable} bold />
                    <Num label="GST" value={r.tax} />
                    <Num label="Net value" value={r.value} />
                    <td data-label="Share" className="px-4 py-3 text-right tabular-nums text-slate-500">
                      {share(r.taxable, totals.taxable)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === 'By item' ? (
          <div className="overflow-x-auto">
            <table className="stack w-full text-sm">
              <thead>
                <tr className={HEAD}>
                  <th className="text-left px-4 py-3">Item</th>
                  <th className="text-right px-4 py-3">Net qty</th>
                  <th className="text-right px-4 py-3">Average rate</th>
                  <th className="text-right px-4 py-3">Net taxable</th>
                  <th className="text-right px-4 py-3">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {byItem.length === 0 && <Empty cols={5} />}
                {byItem.map((r) => (
                  <tr key={r.key}>
                    <td data-main className="px-4 py-3">
                      <div className="font-medium text-slate-900">{r.name}</div>
                      {r.code && <div className="text-xs font-mono text-slate-400">{r.code}</div>}
                    </td>
                    <td data-label="Net qty" className="px-4 py-3 text-right tabular-nums">{formatQty(r.qty, r.unit)}</td>
                    <td data-label="Average rate" className="px-4 py-3 text-right tabular-nums">
                      {r.qty > 0 && r.taxable > 0 ? formatCurrency(r2(r.taxable / r.qty)) : '—'}
                    </td>
                    <Num label="Net taxable" value={r.taxable} bold />
                    <td data-label="Share" className="px-4 py-3 text-right tabular-nums text-slate-500">
                      {share(r.taxable, totals.taxable)}
                    </td>
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
                  <th className="text-left px-4 py-3">Month</th>
                  <th className="text-right px-4 py-3">Invoices</th>
                  <th className="text-right px-4 py-3">Net taxable</th>
                  <th className="text-right px-4 py-3">GST</th>
                  <th className="text-right px-4 py-3">Net value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {byMonth.length === 0 && <Empty cols={5} />}
                {byMonth.map((r) => (
                  <tr key={r.month}>
                    <td data-main className="px-4 py-3 font-medium text-slate-900">{monthLabel(r.month)}</td>
                    <td data-label="Invoices" className="px-4 py-3 text-right tabular-nums">{r.invoices}</td>
                    <Num label="Net taxable" value={r.taxable} bold />
                    <Num label="GST" value={r.tax} />
                    <Num label="Net value" value={r.value} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && (
          <p className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100">
            Sales are counted on the invoice date and credit notes on their own date, so a return can fall in a later
            month than the sale it reverses. Cancelled documents are left out.
          </p>
        )}
      </div>
    </div>
  )
}

const HEAD = 'bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase'

function Num({ value, bold, label, hide }: { value: number; bold?: boolean; label?: string; hide?: boolean }) {
  return (
    <td
      data-label={label}
      data-hide={hide ? '' : undefined}
      className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${bold ? 'font-semibold text-slate-900' : ''} ${value < 0 ? 'text-amber-700' : ''}`}
    >
      {value ? formatCurrency(value) : '—'}
    </td>
  )
}

function Empty({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="text-center py-12 text-slate-400 text-sm">
        No invoices in this period
      </td>
    </tr>
  )
}
