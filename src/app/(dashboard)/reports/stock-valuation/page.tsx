'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TableLoader } from '@/components/ui/spinner'
import {
  COST_BASIS_HINT,
  COST_BASIS_LABEL,
  useStockValuation,
  type CostBasis,
} from '@/lib/hooks/use-valuation'
import { formatCurrency, formatQty, todayISO } from '@/lib/utils/format'
import { downloadCsv } from '@/lib/utils/csv'
import { AlertTriangle, Boxes, Download, IndianRupee, Search } from 'lucide-react'

const TABS = [
  { value: 'valued', label: 'Valued stock' },
  { value: 'no_cost', label: 'No cost yet' },
  { value: 'warnings', label: 'Needs checking' },
  { value: 'all', label: 'All items' },
] as const
type Tab = (typeof TABS)[number]['value']

const basisVariant = (basis: string): 'success' | 'info' | 'warning' | 'default' =>
  basis === 'purchases' ? 'success' : basis === 'bom' ? 'info' : basis === 'price list' ? 'warning' : 'default'

export default function StockValuationPage() {
  const { data: rows, isLoading } = useStockValuation()
  const [tab, setTab] = useState<Tab>('valued')
  const [search, setSearch] = useState('')

  const all = useMemo(() => rows ?? [], [rows])

  const stats = useMemo(() => {
    const held = all.filter((r) => Number(r.qty_on_hand) > 0)
    const uncosted = held.filter((r) => r.cost_basis === 'none')
    return {
      total: held.reduce((s, r) => s + Number(r.stock_value ?? 0), 0),
      itemsHeld: held.length,
      // Stock we hold but cannot put a value on — the gap in the total
      uncosted: uncosted.length,
      uncostedQty: uncosted.reduce((s, r) => s + Number(r.qty_on_hand), 0),
      warnings: all.filter((r) => r.cost_warning).length,
      noCostAtAll: all.filter((r) => r.cost_basis === 'none').length,
    }
  }, [all])

  const byBasis = useMemo(() => {
    const map = new Map<string, { basis: string; items: number; value: number }>()
    for (const r of all.filter((x) => Number(x.qty_on_hand) > 0)) {
      const basis = r.cost_basis ?? 'none'
      const row = map.get(basis) ?? { basis, items: 0, value: 0 }
      row.items += 1
      row.value += Number(r.stock_value ?? 0)
      map.set(basis, row)
    }
    return [...map.values()].sort((a, b) => b.value - a.value)
  }, [all])

  const byCategory = useMemo(() => {
    const map = new Map<string, { category: string; items: number; value: number }>()
    for (const r of all.filter((x) => Number(x.qty_on_hand) > 0)) {
      const key = r.category ?? 'Uncategorised'
      const row = map.get(key) ?? { category: key, items: 0, value: 0 }
      row.items += 1
      row.value += Number(r.stock_value ?? 0)
      map.set(key, row)
    }
    return [...map.values()].sort((a, b) => b.value - a.value)
  }, [all])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return all.filter((r) => {
      const inTab =
        tab === 'all' ||
        (tab === 'valued' && Number(r.qty_on_hand) > 0) ||
        (tab === 'no_cost' && r.cost_basis === 'none') ||
        (tab === 'warnings' && !!r.cost_warning)
      return (
        inTab &&
        (!term ||
          (r.name ?? '').toLowerCase().includes(term) ||
          (r.item_code ?? '').toLowerCase().includes(term) ||
          (r.category ?? '').toLowerCase().includes(term))
      )
    })
  }, [all, tab, search])

  function exportCsv() {
    downloadCsv(`stock-valuation-${todayISO()}`, visible, [
      { header: 'Item Code', value: (r) => r.item_code },
      { header: 'Item', value: (r) => r.name },
      { header: 'Category', value: (r) => r.category },
      { header: 'Unit', value: (r) => r.unit },
      { header: 'Made In-House', value: (r) => r.is_manufactured },
      { header: 'Qty On Hand', value: (r) => r.qty_on_hand },
      { header: 'Qty Reserved', value: (r) => r.qty_reserved },
      { header: 'Unit Cost', value: (r) => r.unit_cost },
      { header: 'Cost Basis', value: (r) => COST_BASIS_LABEL[(r.cost_basis ?? 'none') as CostBasis] },
      { header: 'Stock Value', value: (r) => r.stock_value },
      { header: 'Note', value: (r) => r.cost_warning },
    ])
  }

  return (
    <div>
      <PageHeader
        title="Stock Valuation"
        description="What the stock on hand is worth, and where each cost comes from"
      >
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={visible.length === 0}>
          <Download className="w-4 h-4" />
          Export
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Closing stock value" value={formatCurrency(stats.total)} icon={<IndianRupee className="w-5 h-5" />} />
        <StatCard label="Items in stock" value={String(stats.itemsHeld)} icon={<Boxes className="w-5 h-5" />} />
        <StatCard
          label="Held but not valued"
          value={String(stats.uncosted)}
          sub={stats.uncosted > 0 ? `${formatQty(stats.uncostedQty)} units missing from the total` : 'Everything held has a cost'}
          icon={<AlertTriangle className="w-5 h-5" />}
          className={stats.uncosted > 0 ? 'border-amber-200' : ''}
        />
        <StatCard label="Needs checking" value={String(stats.warnings)} sub="Costs that may be understated" />
      </div>

      {stats.uncosted > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {stats.uncosted} item{stats.uncosted === 1 ? '' : 's'} you hold stock of {stats.uncosted === 1 ? 'has' : 'have'} no
          cost to work from, so {stats.uncosted === 1 ? 'it is' : 'they are'} excluded from the total above. Receive those
          goods against a purchase order, or set a purchase rate under{' '}
          <Link href={'/items' as Route} className="underline">
            Items
          </Link>
          , and the value will fill in. {stats.noCostAtAll} item{stats.noCostAtAll === 1 ? '' : 's'} in the catalogue{' '}
          {stats.noCostAtAll === 1 ? 'has' : 'have'} no cost on record at all.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Where the cost comes from</h3>
          </div>
          <div className="overflow-x-auto">
          <table className="stack w-full text-sm">
            <tbody className="divide-y divide-slate-50">
              {byBasis.length === 0 && (
                <tr>
                  <td className="px-5 py-6 text-slate-400 text-sm">No stock on hand</td>
                </tr>
              )}
              {byBasis.map((r) => (
                <tr key={r.basis}>
                  <td data-main className="px-5 py-3">
                    <Badge variant={basisVariant(r.basis)}>{COST_BASIS_LABEL[r.basis as CostBasis] ?? r.basis}</Badge>
                    <div className="text-xs text-slate-400 mt-1">{COST_BASIS_HINT[r.basis as CostBasis]}</div>
                  </td>
                  <td data-label="Items" className="px-5 py-3 text-right tabular-nums text-slate-600">{r.items} items</td>
                  <td data-label="Value" className="px-5 py-3 text-right tabular-nums font-semibold text-slate-900">{formatCurrency(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">By category</h3>
          </div>
          <div className="overflow-x-auto">
          <table className="stack w-full text-sm">
            <tbody className="divide-y divide-slate-50">
              {byCategory.length === 0 && (
                <tr>
                  <td className="px-5 py-6 text-slate-400 text-sm">No stock on hand</td>
                </tr>
              )}
              {byCategory.slice(0, 8).map((r) => (
                <tr key={r.category}>
                  <td data-main className="px-5 py-3 text-slate-900">{r.category}</td>
                  <td data-label="Items" className="px-5 py-3 text-right tabular-nums text-slate-500">{r.items} items</td>
                  <td data-label="Value" className="px-5 py-3 text-right tabular-nums font-medium">{formatCurrency(r.value)}</td>
                  <td data-label="Share" className="px-5 py-3 text-right tabular-nums text-xs text-slate-400">
                    {stats.total ? `${Math.round((r.value / stats.total) * 100)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 flex flex-wrap items-center gap-3 border-b border-slate-100">
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs max-w-full overflow-x-auto *:shrink-0 *:whitespace-nowrap">
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
              placeholder="Item, code or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <span className="text-xs text-slate-400 ml-auto">{visible.length} items</span>
        </div>

        {isLoading ? (
          <TableLoader />
        ) : (
          <div className="overflow-x-auto">
            <table className="stack w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="text-left px-4 py-3">Item</th>
                  <th className="text-right px-4 py-3">On hand</th>
                  <th className="text-right px-4 py-3">Unit cost</th>
                  <th className="text-left px-4 py-3">Basis</th>
                  <th className="text-right px-4 py-3">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400 text-sm">
                      Nothing here
                    </td>
                  </tr>
                )}
                {visible.map((r) => (
                  <tr key={r.item_id} className="hover:bg-slate-50">
                    <td data-main className="px-4 py-3">
                      <Link href={`/items/${r.item_id}` as Route} className="font-medium text-slate-900 hover:text-blue-600">
                        {r.name}
                      </Link>
                      <div className="text-xs text-slate-400 font-mono">
                        {r.item_code}
                        {r.category ? ` · ${r.category}` : ''}
                        {r.is_manufactured ? ' · made in-house' : ''}
                      </div>
                      {r.cost_warning && <div className="text-xs text-amber-700 mt-0.5">{r.cost_warning}</div>}
                    </td>
                    <td data-label="On hand" className="px-4 py-3 text-right tabular-nums">
                      {formatQty(r.qty_on_hand, r.unit ?? undefined)}
                      {Number(r.qty_reserved) > 0 && (
                        <div className="text-xs text-slate-400">{formatQty(r.qty_reserved)} reserved</div>
                      )}
                    </td>
                    <td data-label="Unit cost" className="px-4 py-3 text-right tabular-nums">
                      {r.unit_cost != null ? formatCurrency(r.unit_cost) : <span className="text-slate-300">—</span>}
                    </td>
                    <td data-label="Basis" className="px-4 py-3">
                      <Badge variant={basisVariant(r.cost_basis ?? 'none')}>
                        {COST_BASIS_LABEL[(r.cost_basis ?? 'none') as CostBasis] ?? r.cost_basis}
                      </Badge>
                    </td>
                    <td data-label="Value" className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                      {Number(r.stock_value) > 0 ? formatCurrency(r.stock_value) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              {visible.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
                    <td className="px-4 py-3" colSpan={4}>
                      Total shown
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(visible.reduce((s, r) => s + Number(r.stock_value ?? 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        <p className="px-5 py-3 text-xs text-slate-500 border-t border-slate-100">
          Costs are the weighted average of every priced goods receipt for an item. An item made in-house is costed from its
          components, stopping at any component that was itself bought. An item never received is costed from its price-list
          purchase rate, and one with neither is listed without a value. Confirm the basis with your accountant before using
          these figures in accounts.
        </p>
      </div>
    </div>
  )
}
