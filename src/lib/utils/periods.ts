import { financialYear } from '@/lib/gst'
import { todayISO } from '@/lib/utils/format'

const iso = (d: Date) => d.toISOString().slice(0, 10)

// Calendar maths on today's IST date, so server and browser agree
export function monthRange(offset: number) {
  const [y, m] = todayISO().split('-').map(Number)
  return { from: iso(new Date(Date.UTC(y, m - 1 + offset, 1))), to: iso(new Date(Date.UTC(y, m + offset, 0))) }
}

// Quarters are the same months in the calendar and the Indian financial year
export function quarterRange() {
  const [y, m] = todayISO().split('-').map(Number)
  const start = Math.floor((m - 1) / 3) * 3
  return { from: iso(new Date(Date.UTC(y, start, 1))), to: iso(new Date(Date.UTC(y, start + 3, 0))) }
}

// Period shortcuts for report filters
export function reportPeriods() {
  const fy = financialYear(todayISO())
  return [
    { label: 'This month', ...monthRange(0) },
    { label: 'Last month', ...monthRange(-1) },
    { label: 'This quarter', ...quarterRange() },
    { label: 'This FY', from: fy.from, to: fy.to },
  ]
}
