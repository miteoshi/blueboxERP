// ─────────────────────────────────────────────────────────────
// GST challans and the GST ledger — pure helpers, no data access.
// The ledger itself is worked out by gst_ledger() in the database.
// ─────────────────────────────────────────────────────────────

import type { TaxHeads } from '@/lib/gst'

export const GST_HEADS = ['igst', 'cgst', 'sgst'] as const
export type GstHead = (typeof GST_HEADS)[number]

export const GST_HEAD_LABEL: Record<GstHead, string> = { igst: 'IGST', cgst: 'CGST', sgst: 'SGST' }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const PERIOD = /^(\d{4})-(0[1-9]|1[0-2])$/

/** '2026-10' → 'Oct 2026'; anything that is not a YYYY-MM month comes back as given */
export function returnPeriodLabel(period: string | null | undefined): string {
  if (!period) return ''
  const m = PERIOD.exec(period)
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : period
}

const monthOf = (date: string) => date.slice(0, 7)

function shiftMonth(period: string, by: number): string {
  const [y, m] = period.split('-').map(Number)
  const i = y * 12 + (m - 1) + by
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`
}

/**
 * The return a challan most likely pays: the month before the payment, since
 * the tax for a month is paid with its return in the following month.
 */
export function defaultReturnPeriod(paymentDate: string): string {
  return shiftMonth(monthOf(paymentDate), -1)
}

/** Months a challan paid on this day can be for, newest first: the payment month and the `count - 1` before it */
export function returnPeriodOptions(paymentDate: string, count = 13): { value: string; label: string }[] {
  const latest = monthOf(paymentDate)
  return Array.from({ length: Math.max(1, count) }, (_, i) => {
    const value = shiftMonth(latest, -i)
    return { value, label: returnPeriodLabel(value) }
  })
}

export type ChallanParts = TaxHeads & { interest: number; late_fee: number }

/** Total of a challan in rupees, summed in whole paise so it cannot drift */
export function challanTotal(parts: Partial<ChallanParts>): number {
  const paise = (n: number | undefined) => Math.round((Number(n) || 0) * 100)
  const keys: (keyof ChallanParts)[] = ['igst', 'cgst', 'sgst', 'interest', 'late_fee']
  return keys.reduce((s, k) => s + paise(parts[k]), 0) / 100
}

/** What a ledger balance means: positive is still payable, negative is credit in hand */
export function gstStanding(balance: number): { kind: 'payable' | 'credit' | 'nil'; amount: number } {
  const b = Math.round((Number(balance) || 0) * 100) / 100
  if (b > 0) return { kind: 'payable', amount: b }
  if (b < 0) return { kind: 'credit', amount: -b }
  return { kind: 'nil', amount: 0 }
}
