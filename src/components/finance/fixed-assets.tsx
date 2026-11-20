'use client'

import { Fragment, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PAYMENT_MODES, type PaymentMode } from '@/lib/hooks/use-finance'
import {
  useCancelFixedAsset,
  useDisposeFixedAsset,
  useSaveFixedAsset,
  useUndoAssetDisposal,
  type FixedAsset,
  type RegisterAsset,
} from '@/lib/hooks/use-fixed-assets'
import { ASSET_CATEGORIES, METHOD_LABEL, categorySuggestion, describeMethod, type DepreciationMethod } from '@/lib/fixed-assets'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils/format'
import { Armchair } from 'lucide-react'

const SELECT = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const twoDp = (n: number) => Number.isFinite(n) && Math.round(n * 100) / 100 === n
const signed = (n: number) => `${n < 0 ? '−' : ''}${formatCurrency(Math.abs(n))}`

// ── Adding or correcting an asset ──────────────────────────────
export function FixedAssetForm({ asset, onDone }: { asset?: FixedAsset; onDone: () => void }) {
  const save = useSaveFixedAsset()
  const [name, setName] = useState(asset?.name ?? '')
  const [category, setCategory] = useState(asset?.category ?? '')
  const [purchaseDate, setPurchaseDate] = useState(asset?.purchase_date ?? todayISO())
  const [cost, setCost] = useState(asset ? String(Number(asset.cost)) : '')
  const [salvage, setSalvage] = useState(asset && Number(asset.salvage_value) ? String(Number(asset.salvage_value)) : '')
  const [method, setMethod] = useState<DepreciationMethod>(asset?.method ?? 'slm')
  const [life, setLife] = useState(asset?.useful_life_years ? String(Number(asset.useful_life_years)) : '')
  const [rate, setRate] = useState(asset?.wdv_rate ? String(Number(asset.wdv_rate)) : '')
  const [payMode, setPayMode] = useState<PaymentMode | 'none'>((asset?.pay_mode as PaymentMode | 'none') ?? 'bank_transfer')
  const [payReference, setPayReference] = useState(asset?.pay_reference ?? '')
  const [notes, setNotes] = useState(asset?.notes ?? '')

  // Picking a known category fills in a suggested life and rate, if empty
  function pickCategory(value: string) {
    setCategory(value)
    const s = categorySuggestion(value)
    if (!s) return
    if (!life) setLife(String(s.lifeYears))
    if (!rate) setRate(String(s.wdvRate))
  }

  function submit() {
    const c = Number(cost)
    const sv = salvage.trim() === '' ? 0 : Number(salvage)
    const l = Number(life)
    const r = Number(rate)
    if (!name.trim()) return toast.error('Give the asset a name')
    if (!purchaseDate) return toast.error('Choose the purchase date')
    if (purchaseDate > todayISO()) return toast.error('The purchase date cannot be in the future')
    if (!(c > 0) || !twoDp(c)) return toast.error('Enter the cost, with at most 2 decimals')
    if (!(sv >= 0) || !twoDp(sv)) return toast.error('Enter a salvage value of nil or more, with at most 2 decimals')
    if (sv >= c) return toast.error('The salvage value must be less than the cost')
    if (method === 'slm' && !(l > 0 && l <= 100 && twoDp(l))) return toast.error('Give a useful life of more than 0 and up to 100 years')
    if (method === 'wdv' && !(r > 0 && r < 100 && twoDp(r))) return toast.error('Give a yearly rate of more than 0 and less than 100 percent')
    save.mutate(
      {
        id: asset?.id,
        name: name.trim(),
        category: category.trim(),
        purchaseDate,
        cost: c,
        salvage: sv,
        method,
        lifeYears: method === 'slm' ? l : null,
        wdvRate: method === 'wdv' ? r : null,
        payMode,
        payReference,
        notes,
      },
      { onSuccess: onDone }
    )
  }

  return (
    <Card className="mb-6 border-blue-200">
      <CardHeader>
        <h3 className="text-sm font-semibold text-slate-900">{asset ? `Correct ${asset.asset_no}` : 'Add a fixed asset'}</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Something the business keeps and uses for more than a year — a machine, a vehicle, a computer, furniture. Its book
          value falls each day by depreciation, worked out from the figures below.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input label="Name" placeholder="e.g. CNC wire cutting machine" value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <label htmlFor="asset-category" className="block text-sm font-medium text-slate-700 mb-1.5">
              Category
            </label>
            <input
              id="asset-category"
              list="asset-categories"
              value={category}
              onChange={(e) => pickCategory(e.target.value)}
              placeholder="Choose or type"
              className={SELECT}
            />
            <datalist id="asset-categories">
              {ASSET_CATEGORIES.map((c) => (
                <option key={c.name} value={c.name} />
              ))}
            </datalist>
          </div>
          <Input label="Purchase date" type="date" max={todayISO()} value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          <Input label="Cost (₹)" type="number" min="0" step="0.01" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
          <Input
            label="Salvage value (₹)"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0 — what it will fetch at the end"
            value={salvage}
            onChange={(e) => setSalvage(e.target.value)}
          />
          <div>
            <label htmlFor="asset-method" className="block text-sm font-medium text-slate-700 mb-1.5">
              Depreciation
            </label>
            <select id="asset-method" value={method} onChange={(e) => setMethod(e.target.value as DepreciationMethod)} className={SELECT}>
              <option value="slm">{METHOD_LABEL.slm} — equal amount each year</option>
              <option value="wdv">{METHOD_LABEL.wdv} — a rate on what is left</option>
            </select>
          </div>
          {method === 'slm' ? (
            <Input label="Useful life (years)" type="number" min="0" step="0.5" inputMode="decimal" value={life} onChange={(e) => setLife(e.target.value)} />
          ) : (
            <Input label="Rate (% a year)" type="number" min="0" max="99.99" step="0.01" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          )}
          <div>
            <label htmlFor="asset-pay" className="block text-sm font-medium text-slate-700 mb-1.5">
              Paid by
            </label>
            <select id="asset-pay" value={payMode} onChange={(e) => setPayMode(e.target.value as PaymentMode | 'none')} className={SELECT}>
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
              <option value="none">Not paid here — a supplier bill, or before the opening balances</option>
            </select>
          </div>
          {payMode !== 'none' && (
            <Input label="Reference (optional)" placeholder="UTR, cheque no." value={payReference} onChange={(e) => setPayReference(e.target.value)} />
          )}
          <div className="sm:col-span-3">
            <Input label="Notes" placeholder="e.g. serial number, where it is kept" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        {categorySuggestion(category) && (
          <p className="text-xs text-slate-500">
            Suggested for {categorySuggestion(category)!.name.toLowerCase()}: {categorySuggestion(category)!.lifeYears} years straight
            line (Companies Act, Schedule II), or {categorySuggestion(category)!.wdvRate}% WDV (income-tax rate). Use your own
            policy if it differs.
          </p>
        )}
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={onDone}>
            Close
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            {asset ? 'Save changes' : 'Add asset'}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

// ── Register for the period, with actions ──────────────────────
type Panel = { id: string; kind: 'dispose' | 'undo' | 'cancel' } | null

export function FixedAssetRegisterTable({
  rows,
  details,
  canEdit,
  onEdit,
}: {
  rows: RegisterAsset[]
  details: Map<string, FixedAsset>
  canEdit: boolean
  onEdit: (a: FixedAsset) => void
}) {
  const [panel, setPanel] = useState<Panel>(null)
  const totals = rows.reduce(
    (t, r) => ({
      opening: t.opening + Number(r.opening),
      addition: t.addition + Number(r.addition),
      depreciation: t.depreciation + Number(r.depreciation),
      disposal: t.disposal + Number(r.disposal_value),
      closing: t.closing + Number(r.closing),
    }),
    { opening: 0, addition: 0, depreciation: 0, disposal: 0, closing: 0 }
  )
  const r2 = (n: number) => Math.round(n * 100) / 100

  return (
    <div className="overflow-x-auto">
      <table className="stack w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
            <th className="text-left px-4 py-3">Asset</th>
            <th className="text-right px-4 py-3">At start</th>
            <th className="text-right px-4 py-3">Bought</th>
            <th className="text-right px-4 py-3">Depreciation</th>
            <th className="text-right px-4 py-3">Sold / scrapped</th>
            <th className="text-right px-4 py-3">At end</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center py-12 text-slate-400 text-sm">
                <Armchair className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                No fixed assets held in this period
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const d = details.get(r.id)
            const sold = r.status === 'disposed'
            return (
              <Fragment key={r.id}>
                <tr>
                  <td data-main className="px-4 py-3">
                    <span className="font-medium text-slate-900">{r.name}</span>
                    <span className="ml-2 font-mono text-xs text-slate-400">{r.asset_no}</span>
                    {sold && (
                      <Badge variant="default" className="ml-2">
                        {Number(r.sale_amount) > 0 ? 'Sold' : 'Scrapped'} {r.disposed_on ? formatDate(r.disposed_on) : ''}
                      </Badge>
                    )}
                    <div className="text-xs text-slate-400">
                      {r.category ? `${r.category} · ` : ''}
                      {formatCurrency(Number(r.cost))} on {formatDate(r.purchase_date)} · {describeMethod(r)}
                    </div>
                    {Number(r.gain) !== 0 && (
                      <div className={`text-xs ${Number(r.gain) > 0 ? 'text-green-700' : 'text-amber-700'}`}>
                        {Number(r.gain) > 0 ? 'Profit' : 'Loss'} on sale {formatCurrency(Math.abs(Number(r.gain)))}
                      </div>
                    )}
                  </td>
                  <Cell label="At start" value={Number(r.opening)} />
                  <Cell label="Bought" value={Number(r.addition)} />
                  <Cell label="Depreciation" value={Number(r.depreciation)} tone="text-amber-700" />
                  <Cell label="Sold / scrapped" value={Number(r.disposal_value)} />
                  <Cell label="At end" value={Number(r.closing)} strong />
                  <td data-hide={canEdit && d ? undefined : true} className="px-4 py-3 text-right whitespace-nowrap">
                    {canEdit && d && (
                      <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-xs">
                        {d.status === 'in_use' ? (
                          <>
                            <button type="button" className="text-blue-600 hover:underline" onClick={() => onEdit(d)}>
                              Edit
                            </button>
                            <button type="button" className="text-blue-600 hover:underline" onClick={() => setPanel({ id: r.id, kind: 'dispose' })}>
                              Sold / scrapped
                            </button>
                            <button type="button" className="text-red-600 hover:underline" onClick={() => setPanel({ id: r.id, kind: 'cancel' })}>
                              Cancel
                            </button>
                          </>
                        ) : d.status === 'disposed' ? (
                          <button type="button" className="text-blue-600 hover:underline" onClick={() => setPanel({ id: r.id, kind: 'undo' })}>
                            Undo sale
                          </button>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
                {panel?.id === r.id && d && (
                  <tr>
                    <td colSpan={7} className={`${panel.kind === 'cancel' ? 'bg-red-50' : 'bg-blue-50'} px-4 py-3`}>
                      {panel.kind === 'dispose' ? (
                        <DisposePanel asset={d} onDone={() => setPanel(null)} />
                      ) : (
                        <ReasonPanel kind={panel.kind} asset={d} onDone={() => setPanel(null)} />
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            {/* On phones only the label and the book value at the end show */}
            <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
              <td className="px-4 py-3">
                Total<span className="md:hidden"> at the end</span>
              </td>
              <FootCell value={r2(totals.opening)} />
              <FootCell value={r2(totals.addition)} />
              <FootCell value={r2(totals.depreciation)} tone="text-amber-700" />
              <FootCell value={r2(totals.disposal)} />
              <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-slate-900">{signed(r2(totals.closing))}</td>
              <td data-hide />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

function Cell({ label, value, tone, strong }: { label: string; value: number; tone?: string; strong?: boolean }) {
  return (
    <td
      data-label={label}
      className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${value ? (tone ?? (strong ? 'font-semibold text-slate-900' : '')) : 'text-slate-300'}`}
    >
      {value ? signed(value) : '—'}
    </td>
  )
}

function FootCell({ value, tone }: { value: number; tone?: string }) {
  return (
    <td data-hide className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${value ? (tone ?? '') : 'text-slate-300'}`}>
      {value ? signed(value) : '—'}
    </td>
  )
}

function DisposePanel({ asset, onDone }: { asset: FixedAsset; onDone: () => void }) {
  const dispose = useDisposeFixedAsset()
  const [disposedOn, setDisposedOn] = useState(todayISO)
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<PaymentMode>('bank_transfer')
  const [reference, setReference] = useState('')
  const value = amount.trim() === '' ? 0 : Number(amount)

  function submit() {
    if (!disposedOn) return toast.error('Give the date')
    if (disposedOn > todayISO()) return toast.error('The date cannot be in the future')
    if (disposedOn < asset.purchase_date) return toast.error(`The date cannot be before the purchase date, ${formatDate(asset.purchase_date)}`)
    if (!(value >= 0) || !twoDp(value)) return toast.error('Enter the amount received, nil or more, with at most 2 decimals')
    dispose.mutate({ id: asset.id, disposedOn, saleAmount: value, saleMode: mode, saleReference: reference }, { onSuccess: onDone })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-700">
        Sold or scrapped {asset.name}? Enter what it fetched — nil if scrapped. The difference from its book value on that day
        goes to the Profit &amp; Loss.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Input label="Date" type="date" min={asset.purchase_date} max={todayISO()} value={disposedOn} onChange={(e) => setDisposedOn(e.target.value)} />
        <Input label="Amount received (₹)" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        {value > 0 && (
          <>
            <div>
              <label htmlFor={`sale-mode-${asset.id}`} className="block text-sm font-medium text-slate-700 mb-1.5">
                Received by
              </label>
              <select id={`sale-mode-${asset.id}`} value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)} className={SELECT}>
                {PAYMENT_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <Input label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onDone}>
          Close
        </Button>
        <Button size="sm" loading={dispose.isPending} onClick={submit}>
          {value > 0 ? 'Record sale' : 'Record as scrapped'}
        </Button>
      </div>
    </div>
  )
}

function ReasonPanel({ kind, asset, onDone }: { kind: 'undo' | 'cancel'; asset: FixedAsset; onDone: () => void }) {
  const undo = useUndoAssetDisposal()
  const cancel = useCancelFixedAsset()
  const [reason, setReason] = useState('')
  const pending = undo.isPending || cancel.isPending

  function submit() {
    if (!reason.trim()) return toast.error('Give a reason')
    const m = kind === 'undo' ? undo : cancel
    m.mutate({ id: asset.id, reason: reason.trim() }, { onSuccess: onDone })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          autoFocus
          placeholder={kind === 'undo' ? `Why undo the sale of ${asset.asset_no}? e.g. sale fell through` : `Why cancel ${asset.asset_no}? e.g. entered twice`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <Button variant="outline" size="sm" onClick={onDone}>
          Keep
        </Button>
        <Button variant={kind === 'cancel' ? 'danger' : 'primary'} size="sm" loading={pending} onClick={submit}>
          {kind === 'undo' ? 'Undo sale' : 'Cancel asset'}
        </Button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {kind === 'undo'
          ? 'The asset goes back in use and the sale money and profit or loss drop out; the reason is kept in its notes.'
          : 'The asset stays on record, marked cancelled, and drops out of every report.'}
      </p>
    </div>
  )
}
