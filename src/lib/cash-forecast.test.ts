import { describe, expect, it } from 'vitest'
import { buildForecast, weekStart, type Flow } from './cash-forecast'

const flow = (kind: Flow['kind'], date: string, amount: number, ref = `${kind}-${date}`): Flow => ({ kind, date, amount, party: 'P', ref })

describe('weekStart', () => {
  it('returns the Monday of the week', () => {
    expect(weekStart('2026-11-27')).toBe('2026-11-23') // Friday
    expect(weekStart('2026-11-23')).toBe('2026-11-23') // Monday
    expect(weekStart('2026-11-29')).toBe('2026-11-23') // Sunday
    expect(weekStart('2027-01-01')).toBe('2026-12-28') // across the year end
  })
})

describe('buildForecast', () => {
  const today = '2026-11-27' // Friday; week 1 is 23–29 Nov

  it('builds 13 Monday-to-Sunday weeks from the opening balance', () => {
    const f = buildForecast({ today, opening: 50000, flows: [] })
    expect(f.weeks).toHaveLength(13)
    expect(f.weeks[0]).toMatchObject({ start: '2026-11-23', end: '2026-11-29', balance: 50000 })
    expect(f.weeks[12]).toMatchObject({ start: '2027-02-15', end: '2027-02-21' })
    expect(f.lowest).toEqual({ balance: 50000, start: '2026-11-23' })
  })

  it('places flows in their week and carries the balance forward', () => {
    const f = buildForecast({
      today, opening: 10000,
      flows: [
        flow('receivable', '2026-11-28', 20000),
        flow('payable', '2026-12-01', 35000),   // week 2
        flow('tds', '2026-12-07', 1200),        // week 3 (Monday)
        flow('receivable', '2026-12-06', 5000), // week 2 (Sunday)
      ],
    })
    expect(f.weeks.slice(0, 3).map((w) => [w.inflow, w.outflow, w.net, w.balance])).toEqual([
      [20000, 0, 20000, 30000],
      [5000, 35000, -30000, 0],
      [0, 1200, -1200, -1200],
    ])
    expect(f.weeks[1].flows.map((x) => x.kind)).toEqual(['payable', 'receivable'])
    expect(f.lowest).toEqual({ balance: -1200, start: '2026-12-07' })
  })

  it('puts overdue bills and tax in the first week, but leaves overdue invoices out unless asked', () => {
    const flows = [
      flow('payable', '2026-10-31', 8000),
      flow('tds', '2026-11-07', 500),
      flow('receivable', '2026-11-01', 15000),
      flow('receivable', '2026-11-27', 1000), // due today: not overdue
    ]
    const f = buildForecast({ today, opening: 0, flows })
    expect(f.weeks[0]).toMatchObject({ inflow: 1000, outflow: 8500, balance: -7500 })
    expect(f).toMatchObject({ overdueIn: 15000, overdueOut: 8500, countedOverdueIn: false })

    const counted = buildForecast({ today, opening: 0, flows, countOverdueIn: true })
    expect(counted.weeks[0]).toMatchObject({ inflow: 16000, outflow: 8500, balance: 7500 })
    expect(counted.overdueIn).toBe(15000)
  })

  it('totals what falls after the last week separately', () => {
    const f = buildForecast({ today, opening: 0, flows: [flow('receivable', '2027-03-01', 900), flow('payable', '2027-02-22', 400), flow('payable', '2027-02-21', 100)] })
    expect(f).toMatchObject({ laterIn: 900, laterOut: 400 })
    expect(f.weeks[12].outflow).toBe(100)
  })

  it('ignores settled amounts and rounds to paise', () => {
    const f = buildForecast({ today, opening: 0.1, flows: [flow('receivable', '2026-11-28', 0.2), flow('payable', '2026-11-28', 0.001)] })
    expect(f.weeks[0]).toMatchObject({ inflow: 0.2, outflow: 0, balance: 0.3 })
    expect(f.weeks[0].flows).toHaveLength(1)
  })
})
