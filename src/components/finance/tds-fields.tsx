'use client'

import { useState, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils/format'
import { TDS_CODES, tdsAmount, tdsCode, type TdsCode } from '@/lib/tds'

const SELECT = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const r2 = (n: number) => Math.round(n * 100) / 100

export type TdsInput = { code: string; rate: number; base: number; amount: number }

// TDS on a payment: tick it, choose the code (which sets the rate), give the
// amount it is worked out on, and the TDS follows unless typed over. Shared
// by supplier payments and expenses; the form puts `fields` where it wants.
export function useTdsFields({
  codes = TDS_CODES,
  initialBase,
  onToggle,
}: {
  codes?: TdsCode[]
  initialBase?: number
  // Called when TDS is ticked or unticked, with the TDS the defaults give
  onToggle?: (on: boolean, defaultTds: number) => void
} = {}) {
  const [on, setOn] = useState(false)
  const [code, setCode] = useState(codes[0].code)
  const [rate, setRate] = useState(String(codes[0].rate))
  const [base, setBase] = useState(initialBase ? String(initialBase) : '')
  const [typed, setTyped] = useState<string | null>(null)

  const rateValue = Number(rate)
  const baseValue = Number(base)
  const tds = on ? (typed !== null ? Number(typed) : tdsAmount(baseValue, rateValue)) : 0
  const safeTds = Number.isFinite(tds) ? tds : 0

  function chooseCode(next: string) {
    setCode(next)
    const c = tdsCode(next)
    if (c) setRate(String(c.rate))
    setTyped(null)
  }

  function toggle(next: boolean) {
    setOn(next)
    setTyped(null)
    onToggle?.(next, tdsAmount(baseValue, rateValue))
  }

  // The message to show, or null when the TDS is fine (or not deducted)
  function problem(): string | null {
    if (!on) return null
    if (!/^[0-9]{4}$/.test(code)) return 'Choose the TDS payment code'
    if (!(rateValue > 0 && rateValue <= 100)) return 'Give the TDS rate in percent, like 1 or 10'
    if (!(baseValue > 0)) return 'Give the amount TDS is worked out on'
    if (!(tds > 0) || r2(tds) !== tds) return 'Give the TDS amount'
    if (tds > baseValue) return 'TDS cannot be more than the amount it is worked out on'
    if (Math.abs(tds - (baseValue * rateValue) / 100) > 1) {
      return `TDS at ${rateValue}% of ${formatCurrency(baseValue)} is ${formatCurrency(r2((baseValue * rateValue) / 100))}`
    }
    return null
  }

  const input: TdsInput | undefined = on ? { code, rate: rateValue, base: baseValue, amount: tds } : undefined

  function fields({ summary, extra }: { summary?: ReactNode; extra?: ReactNode } = {}) {
    const c = tdsCode(code)
    return (
      <div className="rounded-lg border border-slate-200 p-3 space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={on} onChange={(e) => toggle(e.target.checked)} className="rounded border-slate-300" />
          Deduct TDS
        </label>
        {on && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="tds-code" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Payment code
                </label>
                <select id="tds-code" value={code} onChange={(e) => chooseCode(e.target.value)} className={SELECT}>
                  {codes.map((x) => (
                    <option key={x.code} value={x.code}>
                      {x.code} · {x.label} ({x.was}) — {x.rate}%
                    </option>
                  ))}
                </select>
                {c && <p className="mt-1 text-xs text-slate-500">Applies above: {c.threshold}</p>}
              </div>
              <Input
                label="Rate (%)"
                type="number"
                min="0"
                step="0.001"
                inputMode="decimal"
                value={rate}
                onChange={(e) => {
                  setRate(e.target.value)
                  setTyped(null)
                }}
                hint={c ? `${c.rateWithoutPan}% if no PAN` : undefined}
              />
              <Input
                label="TDS on (₹)"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={base}
                onChange={(e) => {
                  setBase(e.target.value)
                  setTyped(null)
                }}
                hint="Usually the value before GST"
              />
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-40">
                <Input
                  label="TDS (₹)"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="decimal"
                  value={typed ?? (tds > 0 ? String(tds) : '')}
                  onChange={(e) => setTyped(e.target.value)}
                />
              </div>
              {summary}
            </div>
            {extra}
          </>
        )}
      </div>
    )
  }

  return { on, toggle, tds: safeTds, rate: rateValue, input, problem, fields }
}
