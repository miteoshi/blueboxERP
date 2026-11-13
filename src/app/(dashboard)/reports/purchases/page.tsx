'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { TableLoader } from '@/components/ui/spinner'
import { formatCurrency, formatDate, formatQty } from '@/lib/utils/format'
import { allRows } from '@/lib/utils/all-rows'
import { monthRange, reportPeriods } from '@/lib/utils/periods'
import { downloadCsv } from '@/lib/utils/csv'
import { Download } from 'lucide-react'

const TABS = ['Register', 'By rate', 'By supplier', 'HSN', 'GST position'] as const
type Tab = (typeof TABS)[number]

const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + (f(r) || 0), 0)
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const tax = (b: { cgst_amount: number; sgst_amount: number; igst_amount: number }) =>
  b.cgst_amount + b.sgst_amount + b.igst_amount

// Posted supplier bills dated in the period (by the supplier's invoice date)
function useBillsForPeriod(from: string, to: string) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['purchase-register', orgId, from, to],
    queryFn: async () => {
      const { data, error } = await allRows(supabase
        .from('supplier_bills')
        .select(`
          id, bill_no, supplier_invoice_no, bill_date, supplier_gstin, is_interstate,
          taxable_value, cgst_amount, sgst_amount, igst_amount, round_off, total_amount,
          supplier:suppliers ( id, name ),
          supplier_bill_lines (
            qty, gst_percent, taxable_value, gst_amount,
            unit:units ( name ),
            item:items ( hsn_code, name )
          )
        `)
        .eq('status', 'posted')
        .gte('bill_date', from)
        .lte('bill_date', to)
        .order('bill_date')
        .order('bill_no')
        .order('id'))
      if (error) throw error
      return data
    },
    enabled: !!orgId && !!from && !!to,
    staleTime: 60 * 1000,
  })
}

// Output tax for the same period: issued invoices less issued credit notes
function useOutputTax(from: string, to: string) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['output-tax', orgId, from, to],
    queryFn: async () => {
      const [inv, cn] = await Promise.all([
        allRows(supabase
          .from('sales_invoices')
          .select('id, cgst_amount, sgst_amount, igst_amount')
          .eq('status', 'issued')
          .gte('invoice_date', from)
          .lte('invoice_date', to)
          .order('id')),
        allRows(supabase
          .from('credit_notes')
          .select('id, cgst_amount, sgst_amount, igst_amount')
          .eq('status', 'issued')
          .gte('note_date', from)
          .lte('note_date', to)
          .order('id')),
      ])
      if (inv.error) throw inv.error
      if (cn.error) throw cn.error
      const net = (k: 'cgst_amount' | 'sgst_amount' | 'igst_amount') =>
        r2(sum(inv.data ?? [], (r) => r[k]) - sum(cn.data ?? [], (r) => r[k]))
      return { cgst: net('cgst_amount'), sgst: net('sgst_amount'), igst: net('igst_amount') }
    },
    enabled: !!orgId && !!from && !!to,
    staleTime: 60 * 1000,
  })
}

export default function PurchaseRegisterPage() {
  const thisMonth = monthRange(0)
  const [from, setFrom] = useState(thisMonth.from)
  const [to, setTo] = useState(thisMonth.to)
  const [tab, setTab] = useState<Tab>('Register')

  const { data: bills, isLoading } = useBillsForPeriod(from, to)
  const { data: output } = useOutputTax(from, to)
  const rows = useMemo(() => bills ?? [], [bills])

  // Input credit needs a registered supplier: a bill with no GSTIN carries none
  const eligible = rows.filter((b) => !!b.supplier_gstin)
  const ineligible = rows.filter((b) => !b.supplier_gstin)

  const totals = {
    taxable: sum(rows, (b) => b.taxable_value),
    value: sum(rows, (b) => b.total_amount),
    cgst: sum(eligible, (b) => b.cgst_amount),
    sgst: sum(eligible, (b) => b.sgst_amount),
    igst: sum(eligible, (b) => b.igst_amount),
    noCredit: sum(ineligible, tax),
  }
  const itc = r2(totals.cgst + totals.sgst + totals.igst)

  const byRate = useMemo(() => {
    const map = new Map<string, { rate: string; taxable: number; cgst: number; sgst: number; igst: number }>()
    for (const b of rows) {
      for (const l of b.supplier_bill_lines) {
        const row = map.get(l.gst_percent) ?? { rate: l.gst_percent, taxable: 0, cgst: 0, sgst: 0, igst: 0 }
        row.taxable = r2(row.taxable + l.taxable_value)
        if (b.is_interstate) row.igst = r2(row.igst + l.gst_amount)
        else {
          const half = r2(l.gst_amount / 2)
          row.cgst = r2(row.cgst + half)
          row.sgst = r2(row.sgst + l.gst_amount - half)
        }
        map.set(l.gst_percent, row)
      }
    }
    return [...map.values()].sort((a, b) => Number(a.rate) - Number(b.rate))
  }, [rows])

  const bySupplier = useMemo(() => {
    const map = new Map<string, { id: string; name: string; gstin: string | null; bills: number; taxable: number; tax: number; value: number }>()
    for (const b of rows) {
      const id = b.supplier?.id ?? ''
      const row = map.get(id) ?? { id, name: b.supplier?.name ?? '—', gstin: b.supplier_gstin, bills: 0, taxable: 0, tax: 0, value: 0 }
      row.bills += 1
      row.taxable = r2(row.taxable + b.taxable_value)
      row.tax = r2(row.tax + tax(b))
      row.value = r2(row.value + b.total_amount)
      map.set(id, row)
    }
    return [...map.values()].sort((a, b) => b.value - a.value)
  }, [rows])

  const hsn = useMemo(() => {
    const map = new Map<string, { hsn: string; unit: string; rate: string; qty: number; taxable: number; tax: number }>()
    for (const b of rows) {
      for (const l of b.supplier_bill_lines) {
        const code = l.item?.hsn_code || 'No HSN'
        const unit = l.unit?.name ?? ''
        const key = `${code}|${unit}|${l.gst_percent}`
        const row = map.get(key) ?? { hsn: code, unit, rate: l.gst_percent, qty: 0, taxable: 0, tax: 0 }
        row.qty += Number(l.qty)
        row.taxable = r2(row.taxable + l.taxable_value)
        row.tax = r2(row.tax + l.gst_amount)
        map.set(key, row)
      }
    }
    return [...map.values()].sort((a, b) => a.hsn.localeCompare(b.hsn) || Number(a.rate) - Number(b.rate))
  }, [rows])

  const outputTotal = output ? r2(output.cgst + output.sgst + output.igst) : 0
  const netPayable = r2(outputTotal - itc)
  const position = [
    { head: 'IGST', out: output?.igst ?? 0, inp: totals.igst },
    { head: 'CGST', out: output?.cgst ?? 0, inp: totals.cgst },
    { head: 'SGST', out: output?.sgst ?? 0, inp: totals.sgst },
  ]

  function exportTab() {
    const tag = `${from}_${to}`
    switch (tab) {
      case 'By rate':
        return downloadCsv(`purchases-by-rate-${tag}`, byRate, [
          { header: 'GST Rate %', value: (r) => Number(r.rate) },
          { header: 'Taxable Value', value: (r) => r.taxable },
          { header: 'IGST', value: (r) => r.igst },
          { header: 'CGST', value: (r) => r.cgst },
          { header: 'SGST', value: (r) => r.sgst },
        ])
      case 'By supplier':
        return downloadCsv(`purchases-by-supplier-${tag}`, bySupplier, [
          { header: 'Supplier', value: (r) => r.name },
          { header: 'GSTIN', value: (r) => r.gstin },
          { header: 'Bills', value: (r) => r.bills },
          { header: 'Taxable Value', value: (r) => r.taxable },
          { header: 'GST', value: (r) => r.tax },
          { header: 'Total', value: (r) => r.value },
        ])
      case 'HSN':
        return downloadCsv(`purchases-hsn-${tag}`, hsn, [
          { header: 'HSN', value: (r) => r.hsn },
          { header: 'UQC', value: (r) => r.unit },
          { header: 'Total Quantity', value: (r) => r.qty },
          { header: 'Rate %', value: (r) => Number(r.rate) },
          { header: 'Taxable Value', value: (r) => r.taxable },
          { header: 'GST', value: (r) => r.tax },
        ])
      case 'GST position':
        return downloadCsv(`gst-position-${tag}`, position, [
          { header: 'Tax', value: (r) => r.head },
          { header: 'Output tax (sales)', value: (r) => r.out },
          { header: 'Input credit (purchases)', value: (r) => r.inp },
          { header: 'Net', value: (r) => r2(r.out - r.inp) },
        ])
      default:
        return downloadCsv(`purchase-register-${tag}`, rows, [
          { header: 'Bill No', value: (b) => b.bill_no },
          { header: 'GSTIN of Supplier', value: (b) => b.supplier_gstin },
          { header: 'Supplier', value: (b) => b.supplier?.name },
          { header: 'Invoice Number', value: (b) => b.supplier_invoice_no },
          { header: 'Invoice Date', value: (b) => b.bill_date },
          { header: 'Invoice Value', value: (b) => b.total_amount },
          { header: 'Supply Type', value: (b) => (b.is_interstate ? 'Inter-State' : 'Intra-State') },
          { header: 'Taxable Value', value: (b) => b.taxable_value },
          { header: 'IGST', value: (b) => b.igst_amount },
          { header: 'CGST', value: (b) => b.cgst_amount },
          { header: 'SGST', value: (b) => b.sgst_amount },
          { header: 'Round Off', value: (b) => b.round_off },
          { header: 'Input Credit', value: (b) => (b.supplier_gstin ? 'Yes' : 'No - unregistered supplier') },
        ])
    }
  }

  return (
    <div>
      <PageHeader title="Purchase Register" description="Supplier bills by invoice date, with the GST you can claim as input credit">
        <Button variant="outline" size="sm" onClick={exportTab} disabled={isLoading}>
          <Download className="w-4 h-4" />
          Export {tab} CSV
        </Button>
      </PageHeader>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 flex flex-wrap items-end gap-3">
        <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <div className="flex gap-1">
          {reportPeriods().map((p) => (
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
        <StatCard label="Purchases (taxable)" value={formatCurrency(totals.taxable)} sub={`${rows.length} bills`} />
        <StatCard label="Input IGST" value={formatCurrency(totals.igst)} />
        <StatCard label="Input CGST" value={formatCurrency(totals.cgst)} />
        <StatCard label="Input SGST" value={formatCurrency(totals.sgst)} />
        <StatCard
          label="Input credit"
          value={formatCurrency(itc)}
          sub={totals.noCredit > 0 ? `${formatCurrency(totals.noCredit)} more has no credit` : 'From registered suppliers'}
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
        ) : tab === 'Register' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={HEAD}>
                  <th className="text-left px-4 py-3">Bill</th>
                  <th className="text-left px-4 py-3">Supplier</th>
                  <th className="text-right px-4 py-3">Taxable</th>
                  <th className="text-right px-4 py-3">IGST</th>
                  <th className="text-right px-4 py-3">CGST</th>
                  <th className="text-right px-4 py-3">SGST</th>
                  <th className="text-right px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.length === 0 && <Empty cols={7} />}
                {rows.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/supplier-bills/${b.id}` as Route} className="font-mono font-semibold text-blue-600 hover:underline">
                        {b.bill_no}
                      </Link>
                      <div className="text-xs text-slate-400">
                        Inv {b.supplier_invoice_no} · {formatDate(b.bill_date)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{b.supplier?.name}</div>
                      {b.supplier_gstin ? (
                        <div className="text-xs font-mono text-slate-400">{b.supplier_gstin}</div>
                      ) : (
                        <div className="text-xs text-amber-700">No GSTIN — no input credit</div>
                      )}
                    </td>
                    <Num value={b.taxable_value} />
                    <Num value={b.igst_amount} />
                    <Num value={b.cgst_amount} />
                    <Num value={b.sgst_amount} />
                    <Num value={b.total_amount} bold />
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
                    <td className="px-4 py-3" colSpan={2}>
                      Total
                    </td>
                    <Num value={totals.taxable} />
                    <Num value={sum(rows, (b) => b.igst_amount)} />
                    <Num value={sum(rows, (b) => b.cgst_amount)} />
                    <Num value={sum(rows, (b) => b.sgst_amount)} />
                    <Num value={totals.value} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : tab === 'By rate' ? (
          <table className="w-full text-sm">
            <thead>
              <tr className={HEAD}>
                <th className="text-left px-4 py-3">GST rate</th>
                <th className="text-right px-4 py-3">Taxable</th>
                <th className="text-right px-4 py-3">IGST</th>
                <th className="text-right px-4 py-3">CGST</th>
                <th className="text-right px-4 py-3">SGST</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {byRate.length === 0 && <Empty cols={5} />}
              {byRate.map((r) => (
                <tr key={r.rate}>
                  <td className="px-4 py-3 font-medium">{r.rate}%</td>
                  <Num value={r.taxable} />
                  <Num value={r.igst} />
                  <Num value={r.cgst} />
                  <Num value={r.sgst} />
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'By supplier' ? (
          <table className="w-full text-sm">
            <thead>
              <tr className={HEAD}>
                <th className="text-left px-4 py-3">Supplier</th>
                <th className="text-right px-4 py-3">Bills</th>
                <th className="text-right px-4 py-3">Taxable</th>
                <th className="text-right px-4 py-3">GST</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {bySupplier.length === 0 && <Empty cols={6} />}
              {bySupplier.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{r.name}</div>
                    <div className="text-xs font-mono text-slate-400">{r.gstin ?? 'Unregistered'}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.bills}</td>
                  <Num value={r.taxable} />
                  <Num value={r.tax} />
                  <Num value={r.value} bold />
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                    {totals.value ? `${Math.round((r.value / totals.value) * 100)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'HSN' ? (
          <table className="w-full text-sm">
            <thead>
              <tr className={HEAD}>
                <th className="text-left px-4 py-3">HSN</th>
                <th className="text-right px-4 py-3">Quantity</th>
                <th className="text-right px-4 py-3">Rate</th>
                <th className="text-right px-4 py-3">Taxable</th>
                <th className="text-right px-4 py-3">GST</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {hsn.length === 0 && <Empty cols={5} />}
              {hsn.map((r) => (
                <tr key={`${r.hsn}|${r.unit}|${r.rate}`}>
                  <td className={`px-4 py-3 font-mono ${r.hsn === 'No HSN' ? 'text-amber-700' : ''}`}>{r.hsn}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatQty(r.qty, r.unit)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.rate}%</td>
                  <Num value={r.taxable} />
                  <Num value={r.tax} />
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className={HEAD}>
                  <th className="text-left px-4 py-3">Tax</th>
                  <th className="text-right px-4 py-3">Output tax (sales)</th>
                  <th className="text-right px-4 py-3">Input credit (purchases)</th>
                  <th className="text-right px-4 py-3">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {position.map((r) => (
                  <tr key={r.head}>
                    <td className="px-4 py-3 font-medium">{r.head}</td>
                    <Num value={r.out} />
                    <Num value={r.inp} />
                    <Num value={r2(r.out - r.inp)} />
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
                  <td className="px-4 py-3">Total</td>
                  <Num value={outputTotal} />
                  <Num value={itc} />
                  <td className={`px-4 py-3 text-right tabular-nums ${netPayable > 0 ? 'text-slate-900' : 'text-teal-700'}`}>
                    {netPayable >= 0
                      ? `${formatCurrency(netPayable)} payable`
                      : `${formatCurrency(-netPayable)} credit carried forward`}
                  </td>
                </tr>
              </tfoot>
            </table>
            <p className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100">
              An estimate from the books, before any opening credit balance. Output tax is issued invoices less credit notes;
              input credit is bills from registered suppliers. The credit you can actually claim is what shows in GSTR-2B
              once the supplier files, and IGST credit can also be set against CGST and SGST — confirm with your accountant
              before filing GSTR-3B.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

const HEAD = 'bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase'

function Num({ value, bold }: { value: number; bold?: boolean }) {
  return (
    <td className={`px-4 py-3 text-right tabular-nums ${bold ? 'font-semibold text-slate-900' : ''}`}>
      {value ? formatCurrency(value) : '—'}
    </td>
  )
}

function Empty({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="text-center py-12 text-slate-400 text-sm">
        No supplier bills in this period
      </td>
    </tr>
  )
}
