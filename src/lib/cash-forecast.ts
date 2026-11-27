// A rolling 13-week cash-flow forecast: cash and bank today, plus what is due
// in from customers and out to suppliers and the tax authorities, week by week.
//
// Money owed by the business (supplier bills, TDS, GST) that is already
// overdue is assumed to go out in the current week. Overdue customer invoices
// are uncertain, so by default they are left out of the projection and shown
// on their own; the caller can choose to count them in the current week.
// Weeks run Monday to Sunday; the first is the week containing today.

export type FlowKind = 'receivable' | 'payable' | 'tds' | 'gst'

export type Flow = {
  kind: FlowKind
  date: string     // due date, ISO
  amount: number   // positive; direction comes from kind
  party: string
  ref: string
  href?: string
}

export type ForecastWeek = {
  start: string
  end: string
  inflow: number
  outflow: number
  net: number
  balance: number  // projected cash + bank at the end of the week
  flows: Flow[]
}

export type Forecast = {
  opening: number
  weeks: ForecastWeek[]
  overdueIn: number     // overdue customer invoices
  overdueOut: number    // overdue bills and tax, already in the first week
  countedOverdueIn: boolean
  laterIn: number       // due after the last week
  laterOut: number
  lowest: { balance: number; start: string }
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
export const isInflow = (k: FlowKind) => k === 'receivable'

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Monday of the week containing the date
export function weekStart(iso: string): string {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay() // 0 Sunday
  return addDays(iso, -((day + 6) % 7))
}

export function buildForecast(input: {
  today: string
  opening: number
  flows: Flow[]
  weeks?: number
  countOverdueIn?: boolean
}): Forecast {
  const { today, opening, countOverdueIn = false } = input
  const count = input.weeks ?? 13
  const first = weekStart(today)
  const weeks: ForecastWeek[] = Array.from({ length: count }, (_, i) => ({
    start: addDays(first, i * 7),
    end: addDays(first, i * 7 + 6),
    inflow: 0, outflow: 0, net: 0, balance: 0, flows: [],
  }))
  const lastDay = weeks[weeks.length - 1].end
  let overdueIn = 0, overdueOut = 0, laterIn = 0, laterOut = 0

  const sorted = [...input.flows].filter((f) => f.amount > 0.004).sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref))
  for (const f of sorted) {
    const inflow = isInflow(f.kind)
    let week: ForecastWeek | undefined
    if (f.date < today) {
      if (inflow) {
        overdueIn += f.amount
        if (!countOverdueIn) continue
      } else {
        overdueOut += f.amount
      }
      week = weeks[0]
    } else if (f.date > lastDay) {
      if (inflow) laterIn += f.amount
      else laterOut += f.amount
      continue
    } else {
      week = weeks[Math.floor((Date.parse(f.date) - Date.parse(first)) / (7 * 86400000))]
    }
    week.flows.push(f)
    if (inflow) week.inflow += f.amount
    else week.outflow += f.amount
  }

  let balance = opening
  let lowest = { balance: opening, start: first }
  for (const w of weeks) {
    w.inflow = r2(w.inflow)
    w.outflow = r2(w.outflow)
    w.net = r2(w.inflow - w.outflow)
    balance = r2(balance + w.net)
    w.balance = balance
    if (balance < lowest.balance) lowest = { balance, start: w.start }
  }

  return {
    opening: r2(opening),
    weeks,
    overdueIn: r2(overdueIn),
    overdueOut: r2(overdueOut),
    countedOverdueIn: countOverdueIn,
    laterIn: r2(laterIn),
    laterOut: r2(laterOut),
    lowest,
  }
}
