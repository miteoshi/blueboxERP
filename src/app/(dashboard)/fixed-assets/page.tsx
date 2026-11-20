'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { TableLoader } from '@/components/ui/spinner'
import { FixedAssetForm, FixedAssetRegisterTable } from '@/components/finance/fixed-assets'
import { useFixedAssetRegister, useFixedAssets, type FixedAsset } from '@/lib/hooks/use-fixed-assets'
import { useRole } from '@/lib/hooks/use-profile'
import { financialYear } from '@/lib/gst'
import { describeMethod } from '@/lib/fixed-assets'
import { formatCurrency, todayISO } from '@/lib/utils/format'
import { reportPeriods } from '@/lib/utils/periods'
import { downloadCsv } from '@/lib/utils/csv'
import { Download, Plus } from 'lucide-react'

// Same roles as fixed_asset_register() and the read policy
const ROLES = ['admin', 'manager', 'viewer']

export default function FixedAssetsPage() {
  const role = useRole()
  const allowed = !!role && ROLES.includes(role)
  const canEdit = role === 'admin' || role === 'manager'
  const fy = financialYear(todayISO())

  const [from, setFrom] = useState(fy.from)
  const [to, setTo] = useState(fy.to)
  const [form, setForm] = useState<{ asset?: FixedAsset } | null>(null)

  const { data: register, isLoading, error } = useFixedAssetRegister(from, to, allowed)
  const { data: assets } = useFixedAssets(allowed)
  const details = useMemo(() => new Map((assets ?? []).map((a) => [a.id, a])), [assets])
  const cancelled = (assets ?? []).filter((a) => a.status === 'cancelled').length

  if (role && !allowed) {
    return (
      <div>
        <PageHeader title="Fixed Assets" description="Machines, vehicles, computers and furniture, with depreciation" />
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Your role cannot see fixed assets.</div>
      </div>
    )
  }

  const t = register?.totals
  const gain = t ? Number(t.gain) : 0

  function exportCsv() {
    if (!register) return
    downloadCsv(`fixed-assets-${from}_${to}`, register.assets, [
      { header: 'Asset No', value: (a) => a.asset_no },
      { header: 'Name', value: (a) => a.name },
      { header: 'Category', value: (a) => a.category },
      { header: 'Purchase Date', value: (a) => a.purchase_date },
      { header: 'Cost', value: (a) => Number(a.cost) },
      { header: 'Salvage Value', value: (a) => Number(a.salvage_value) },
      { header: 'Method', value: (a) => describeMethod(a) },
      { header: `Value On ${from}`, value: (a) => Number(a.opening) },
      { header: 'Bought In Period', value: (a) => Number(a.addition) },
      { header: 'Depreciation', value: (a) => Number(a.depreciation) },
      { header: 'Value When Sold Or Scrapped', value: (a) => Number(a.disposal_value) },
      { header: 'Sold Or Scrapped On', value: (a) => a.disposed_on },
      { header: 'Amount Received', value: (a) => (a.disposed_on ? Number(a.sale_amount) : null) },
      { header: 'Profit Or Loss On Sale', value: (a) => (Number(a.gain) ? Number(a.gain) : null) },
      { header: `Value On ${to}`, value: (a) => Number(a.closing) },
    ])
  }

  const presets = reportPeriods()

  return (
    <div>
      <PageHeader title="Fixed Assets" description="Machines, vehicles, computers and furniture the business owns, and their depreciation">
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!register?.assets.length}>
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
        {canEdit && (
          <Button size="sm" onClick={() => setForm({})} disabled={!!form && !form.asset}>
            <Plus className="w-4 h-4" />
            Add asset
          </Button>
        )}
      </PageHeader>

      {canEdit && form && <FixedAssetForm key={form.asset?.id ?? 'new'} asset={form.asset} onDone={() => setForm(null)} />}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
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
        {from > to && <p className="text-sm text-red-600">The period must start on or before the day it ends</p>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Book value at the end" value={t ? formatCurrency(Number(t.closing)) : '—'} sub={t ? `${t.in_use} ${t.in_use === 1 ? 'asset' : 'assets'} held` : undefined} />
        <StatCard label="Bought in the period" value={t ? formatCurrency(Number(t.additions)) : '—'} />
        <StatCard
          label="Depreciation"
          value={t ? formatCurrency(Number(t.depreciation)) : '—'}
          sub="an expense in the Profit & Loss"
          className={t && Number(t.depreciation) > 0 ? 'border-amber-200' : undefined}
        />
        <StatCard
          label={gain < 0 ? 'Loss on assets sold' : 'Profit on assets sold'}
          value={t ? formatCurrency(Math.abs(gain)) : '—'}
          sub={t ? `${formatCurrency(Number(t.disposals))} book value sold or scrapped` : undefined}
          className={gain < 0 ? 'border-amber-200' : gain > 0 ? 'border-green-200' : undefined}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {error ? (
          <div className="p-6 text-sm text-red-700">{(error as Error).message}</div>
        ) : isLoading || !register ? (
          <TableLoader />
        ) : (
          <FixedAssetRegisterTable rows={register.assets} details={details} canEdit={canEdit} onEdit={(a) => setForm({ asset: a })} />
        )}
        <div className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100 space-y-1">
          <p>
            Straight line takes the same share of (cost − salvage value) each day of the useful life. Written-down value takes
            the yearly rate of the value at the start of each financial year (1 April), pro rata by days in the year of purchase,
            and never goes below the salvage value. The day of purchase counts as a day in use.
          </p>
          <p>
            Depreciation and any loss on sale are expenses in the{' '}
            <Link href={'/reports/profit-loss' as Route} className="underline">
              Profit &amp; Loss
            </Link>
            ; a profit on sale is other income. Book values count in the{' '}
            <Link href={'/reports/position' as Route} className="underline">
              Financial Position
            </Link>
            . A purchase paid here, and sale money, move cash or bank. These are figures for running the business — your
            accountant may use different rates for the tax return.
            {cancelled > 0 && ` ${cancelled} cancelled ${cancelled === 1 ? 'asset is' : 'assets are'} left out.`}
          </p>
        </div>
      </div>
    </div>
  )
}
