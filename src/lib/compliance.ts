// Statutory due dates a business like this one has to meet, worked out from
// the calendar alone. Amounts (TDS still to deposit, GST payable) come from
// the ledgers and are joined on by the caller.
//
// TDS: deposit by the 7th of the next month (March's by 30 April); quarterly
// return on Form 140 (was 26Q) by 31 July, 31 October, 31 January, 31 May.
// GST, monthly filers: GSTR-1 by the 11th, GSTR-3B and the tax by the 20th
// (quarterly QRMP filers: 13th, and 22nd or 24th by state); GSTR-9 by
// 31 December. Advance tax: 15 June, September, December and March.

export type ComplianceKind = 'tds' | 'gst' | 'income_tax'

export type ComplianceItem = {
  key: string
  date: string
  kind: ComplianceKind
  title: string
  detail: string
  /** For TDS deposits and GSTR-3B: the month the item is for, YYYY-MM */
  period?: string
  href: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthLabel = (y: number, m: number) => `${MONTHS[m - 1]} ${y}`
const fyLabel = (startYear: number) => `${startYear}-${String(startYear + 1).slice(2)}`

/** One month before (y, m) */
function prev(y: number, m: number): [number, number] {
  return m === 1 ? [y - 1, 12] : [y, m - 1]
}

// Everything due in a calendar month (y, m)
function dueIn(y: number, m: number): ComplianceItem[] {
  const items: ComplianceItem[] = []
  const [py, pm] = prev(y, m)
  const lastPeriod = `${py}-${pad(pm)}`

  // TDS deducted last month; March's TDS is due on 30 April instead of 7 April
  if (m !== 4) {
    items.push({
      key: `tds-${lastPeriod}`,
      date: iso(y, m, 7),
      kind: 'tds',
      title: 'Deposit TDS',
      detail: `TDS deducted in ${monthLabel(py, pm)}`,
      period: lastPeriod,
      href: '/tds',
    })
  } else {
    items.push(
      {
        key: `tds-${y}-03`,
        date: iso(y, 4, 30),
        kind: 'tds',
        title: 'Deposit TDS',
        detail: `TDS deducted in ${monthLabel(y, 3)}`,
        period: `${y}-03`,
        href: '/tds',
      },
    )
  }

  // Quarterly TDS return
  const quarter: Record<number, { q: number; fyStart: number; label: string }> = {
    7: { q: 1, fyStart: y, label: 'April–June' },
    10: { q: 2, fyStart: y, label: 'July–September' },
    1: { q: 3, fyStart: y - 1, label: 'October–December' },
    5: { q: 4, fyStart: y - 1, label: 'January–March' },
  }
  const ret = quarter[m]
  if (ret) {
    items.push({
      key: `tdsr-${ret.fyStart}-q${ret.q}`,
      date: iso(y, m, m === 5 ? 31 : new Date(Date.UTC(y, m, 0)).getUTCDate()),
      kind: 'tds',
      title: `File TDS return (Form 140), Q${ret.q}`,
      detail: `${ret.label}, tax year ${fyLabel(ret.fyStart)}`,
      href: '/tds',
    })
  }

  // GST returns for last month
  items.push(
    {
      key: `gstr1-${lastPeriod}`,
      date: iso(y, m, 11),
      kind: 'gst',
      title: 'File GSTR-1',
      detail: `Sales of ${monthLabel(py, pm)} (monthly filers; quarterly filers by the 13th after the quarter)`,
      period: lastPeriod,
      href: '/reports/gst',
    },
    {
      key: `gstr3b-${lastPeriod}`,
      date: iso(y, m, 20),
      kind: 'gst',
      title: 'File GSTR-3B and pay GST',
      detail: `For ${monthLabel(py, pm)} (monthly filers; quarterly filers by the 22nd or 24th after the quarter)`,
      period: lastPeriod,
      href: '/gst-payments',
    },
  )

  // Annual GST return for the year that ended last March
  if (m === 12) {
    items.push({
      key: `gstr9-${y - 1}`,
      date: iso(y, 12, 31),
      kind: 'gst',
      title: 'File GSTR-9 (annual return)',
      detail: `Financial year ${fyLabel(y - 1)}`,
      href: '/reports/gst',
    })
  }

  // Advance tax instalments
  const advance: Record<number, string> = { 6: '15%', 9: '45%', 12: '75%', 3: '100%' }
  if (advance[m]) {
    const fyStart = m === 3 ? y - 1 : y
    items.push({
      key: `adv-${fyStart}-${m}`,
      date: iso(y, m, 15),
      kind: 'income_tax',
      title: 'Pay advance tax',
      detail: `At least ${advance[m]} of the year's tax, tax year ${fyLabel(fyStart)}`,
      href: '/reports/profit-loss',
    })
  }
  return items
}

/** Items due from `today` up to `days` days ahead, soonest first */
export function upcomingCompliance(today: string, days = 45): ComplianceItem[] {
  const end = new Date(`${today}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + days)
  const last = end.toISOString().slice(0, 10)
  let y = Number(today.slice(0, 4))
  let m = Number(today.slice(5, 7))
  const out: ComplianceItem[] = []
  while (`${y}-${pad(m)}-01` <= last) {
    for (const item of dueIn(y, m)) if (item.date >= today && item.date <= last) out.push(item)
    ;[y, m] = m === 12 ? [y + 1, 1] : [y, m + 1]
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key))
}

/** Whole days from today to a date (0 = today) */
export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
}
