// TDS on payments to suppliers, under the Income-tax Act 2025 (from 1 April
// 2026), which names each kind of payment by a four-digit payment code in
// place of the old sections (194C, 194Q, ...). Rates and thresholds are as
// commonly published for tax year 2026-27; they are suggestions the user can
// change on each payment, not rules the app enforces.

export type TdsCode = {
  code: string
  label: string
  /** The 1961 Act section it replaces, for people who still think in those */
  was: string
  /** Rate in percent when the supplier has given a PAN */
  rate: number
  /** Rate in percent when they have not */
  rateWithoutPan: number
  threshold: string
}

export const TDS_CODES: TdsCode[] = [
  { code: '1031', label: 'Purchase of goods', was: '194Q', rate: 0.1, rateWithoutPan: 5, threshold: 'Purchases from one supplier above ₹50 lakh in the year, when your turnover last year was above ₹10 crore' },
  { code: '1024', label: 'Contract work — company, firm or others', was: '194C', rate: 2, rateWithoutPan: 20, threshold: '₹30,000 in one payment, or ₹1,00,000 in the year' },
  { code: '1023', label: 'Contract work — individual or HUF', was: '194C', rate: 1, rateWithoutPan: 20, threshold: '₹30,000 in one payment, or ₹1,00,000 in the year' },
  { code: '1027', label: 'Professional services', was: '194J', rate: 10, rateWithoutPan: 20, threshold: '₹50,000 in the year' },
  { code: '1026', label: 'Technical services', was: '194J', rate: 2, rateWithoutPan: 20, threshold: '₹50,000 in the year' },
  { code: '1006', label: 'Commission or brokerage', was: '194H', rate: 2, rateWithoutPan: 20, threshold: '₹20,000 in the year' },
  { code: '1008', label: 'Rent of plant or machinery', was: '194I', rate: 2, rateWithoutPan: 20, threshold: '₹50,000 a month' },
  { code: '1009', label: 'Rent of land or building', was: '194I', rate: 10, rateWithoutPan: 20, threshold: '₹50,000 a month' },
]

// For expenses: what is usually paid as an expense, most common first (no purchase of goods)
export const EXPENSE_TDS_CODES: TdsCode[] = ['1009', '1027', '1024', '1023', '1026', '1006', '1008'].map(
  (c) => TDS_CODES.find((x) => x.code === c) as TdsCode,
)

export function tdsCode(code: string | null | undefined): TdsCode | undefined {
  return TDS_CODES.find((c) => c.code === code)
}

/** "1024 · Contract work — company, firm or others (194C)", or the bare code when it is not in the list */
export function tdsCodeLabel(code: string | null | undefined): string {
  if (!code) return '—'
  const c = tdsCode(code)
  return c ? `${c.code} · ${c.label} (${c.was})` : code
}

/** TDS on an amount at a rate in percent, rounded to the rupee as it is deposited */
export function tdsAmount(base: number, rate: number): number {
  if (!(base > 0) || !(rate > 0)) return 0
  return Math.round((base * rate) / 100)
}

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/

export function isPan(value: string | null | undefined): boolean {
  return !!value && PAN.test(value)
}

/** The supplier's PAN: the one saved, else the one inside their GSTIN (characters 3 to 12) */
export function deducteePan(pan: string | null | undefined, gstin: string | null | undefined): string | null {
  if (isPan(pan)) return pan as string
  const fromGstin = gstin?.trim().toUpperCase().slice(2, 12)
  return fromGstin && PAN.test(fromGstin) ? fromGstin : null
}

/** The quarter of the TDS return a date falls in: Q1 April–June ... Q4 January–March */
export function tdsQuarter(date: string): { label: string; from: string; to: string } {
  const y = Number(date.slice(0, 4))
  const m = Number(date.slice(5, 7))
  const fyStart = m >= 4 ? y : y - 1
  const q = m >= 4 ? Math.floor((m - 4) / 3) + 1 : 4
  const startMonth = [4, 7, 10, 1][q - 1]
  const startYear = q === 4 ? fyStart + 1 : fyStart
  const endMonth = startMonth + 2
  const lastDay = new Date(Date.UTC(startYear, endMonth, 0)).getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    label: `Q${q} ${fyStart}-${String(fyStart + 1).slice(2)}`,
    from: `${startYear}-${pad(startMonth)}-01`,
    to: `${startYear}-${pad(endMonth)}-${pad(lastDay)}`,
  }
}
