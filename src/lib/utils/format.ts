import { format, formatDistanceToNow, parseISO } from 'date-fns'

// ── Currency ──────────────────────────────────────────────────
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// Short version: ₹1,23,456 (no decimals for large amounts)
export function formatCurrencyShort(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// ── Quantity ──────────────────────────────────────────────────
export function formatQty(
  qty: number | null | undefined,
  unit?: string | null
): string {
  if (qty === null || qty === undefined) return '—'
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(qty)
  return unit ? `${formatted} ${unit}` : formatted
}

// ── Date ──────────────────────────────────────────────────────
// The business runs on Indian time (the database uses Asia/Kolkata too).
// Format explicitly in IST so server-rendered pages (UTC on Vercel) and the
// browser agree, and "today" doesn't lag a day between 00:00 and 05:30.
const IST = 'Asia/Kolkata'

const istDateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' })
const istTimeFmt = new Intl.DateTimeFormat('en-IN', { timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: true })

// YYYY-MM-DD of an instant, in IST
function istDate(d: Date): string {
  return istDateFmt.format(d)
}

export function formatDate(
  date: string | null | undefined,
  fmt = 'dd MMM yyyy'
): string {
  if (!date) return '—'
  try {
    // A bare date (2026-11-10) is a calendar day; a timestamp is an instant
    // that must be read in IST before taking its day.
    const day = date.length <= 10 ? date : istDate(new Date(date))
    return format(parseISO(day), fmt)
  } catch {
    return '—'
  }
}

// Today's date (YYYY-MM-DD) in IST
export function todayISO(): string {
  return istDate(new Date())
}

// True when a YYYY-MM-DD date is strictly before today.
// A document due today is not overdue yet.
export function isPastDate(date: string | null | undefined): boolean {
  if (!date) return false
  return date.slice(0, 10) < todayISO()
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return `${formatDate(date)}, ${istTimeFmt.format(d).toUpperCase()}`
}

export function formatRelative(date: string | null | undefined): string {
  if (!date) return '—'
  try {
    return formatDistanceToNow(parseISO(date), { addSuffix: true })
  } catch {
    return '—'
  }
}

// ── GST ───────────────────────────────────────────────────────
export function calculateGst(amount: number, gstPercent: string): number {
  return (amount * Number(gstPercent)) / 100
}

export function calculateTotal(
  subtotal: number,
  gstPercent: string
): { gst: number; total: number } {
  const gst = calculateGst(subtotal, gstPercent)
  return { gst, total: subtotal + gst }
}

// ── Document numbers ──────────────────────────────────────────
export function isQuotationNo(no: string) { return no.startsWith('QT-') }
export function isSalesOrderNo(no: string) { return no.startsWith('SO-') }
export function isGrnNo(no: string)        { return no.startsWith('GRN-') }
export function isPrdNo(no: string)        { return no.startsWith('PRD-') }
export function isDcNo(no: string)         { return no.startsWith('DC-') }