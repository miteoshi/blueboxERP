import type { Enums } from '@/lib/types/database'

export type GstRate = Enums<'gst_rate'>

// ─────────────────────────────────────────────────────────────
// GST rates offered on new documents.
// GST 2.0 (from 22 Sep 2025): 0 / 5 / 18 / 40 %, plus the special
// 3 % and 0.25 % rates. 12 % and 28 % were largely removed but stay
// selectable for goods still notified at those rates.
// ─────────────────────────────────────────────────────────────
export const GST_RATE_OPTIONS: { value: GstRate; label: string }[] = [
  { value: '0', label: '0%' },
  { value: '0.25', label: '0.25%' },
  { value: '3', label: '3%' },
  { value: '5', label: '5%' },
  { value: '12', label: '12% (old)' },
  { value: '18', label: '18%' },
  { value: '28', label: '28% (old)' },
  { value: '40', label: '40%' },
]

// ── GSTIN ─────────────────────────────────────────────────────
// Same rules as public.is_valid_gstin(): 15 characters, 2-digit state
// code, and a mod-36 check character over the first 14.
const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function normalizeGstin(value: string): string {
  return value.replace(/\s/g, '').toUpperCase()
}

export function isValidGstin(value: string): boolean {
  const g = normalizeGstin(value)
  if (!/^[0-9]{2}[A-Z0-9]{13}$/.test(g)) return false
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const v = GSTIN_CHARS.indexOf(g[i])
    const p = v * (i % 2 === 0 ? 1 : 2)
    sum += Math.floor(p / 36) + (p % 36)
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36] === g[14]
}

/** Error text for a GSTIN field, or null when empty / valid. */
export function gstinError(value: string): string | null {
  const g = normalizeGstin(value)
  if (!g) return null
  if (g.length !== 15) return `GSTIN has 15 characters (${g.length} entered)`
  if (!isValidGstin(g)) return 'Check the GSTIN — the last character does not match'
  return null
}

export const stateCodeFromGstin = (value: string): string | null => {
  const g = normalizeGstin(value)
  return isValidGstin(g) ? g.slice(0, 2) : null
}

// ── Amount in words (Indian numbering) ────────────────────────
const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function belowHundred(n: number): string {
  if (n < 20) return ONES[n]
  return [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(' ')
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  return [h ? `${ONES[h]} Hundred` : '', r ? belowHundred(r) : ''].filter(Boolean).join(' ')
}

function integerInWords(n: number): string {
  if (n === 0) return 'Zero'
  const parts: string[] = []
  const crore = Math.floor(n / 10000000)
  const lakh = Math.floor((n % 10000000) / 100000)
  const thousand = Math.floor((n % 100000) / 1000)
  const rest = n % 1000
  if (crore) parts.push(`${integerInWords(crore)} Crore`)
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`)
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`)
  if (rest) parts.push(belowThousand(rest))
  return parts.join(' ')
}

/** e.g. 1522.5 → "Rupees One Thousand Five Hundred Twenty Two and Fifty Paise Only" */
export function amountInWords(amount: number): string {
  const sign = amount < 0 ? 'Minus ' : ''
  const abs = Math.abs(Math.round(amount * 100))
  const rupees = Math.floor(abs / 100)
  const paise = abs % 100
  const words = `Rupees ${integerInWords(rupees)}${paise ? ` and ${belowHundred(paise)} Paise` : ''} Only`
  return sign + words
}

// ── Financial year ────────────────────────────────────────────
/** Indian FY for a YYYY-MM-DD date → { label: '26-27', from: '2026-04-01', to: '2027-03-31' } */
export function financialYear(date: string) {
  const [y, m] = date.split('-').map(Number)
  const start = m >= 4 ? y : y - 1
  const pad = (n: number) => String(n % 100).padStart(2, '0')
  return {
    label: `${pad(start)}-${pad(start + 1)}`,
    from: `${start}-04-01`,
    to: `${start + 1}-03-31`,
  }
}
