import { describe, expect, it } from 'vitest'
import { challanTotal, defaultReturnPeriod, gstStanding, returnPeriodLabel, returnPeriodOptions } from './gst-payments'

describe('returnPeriodLabel', () => {
  it('names the month', () => {
    expect(returnPeriodLabel('2026-10')).toBe('Oct 2026')
    expect(returnPeriodLabel('2027-01')).toBe('Jan 2027')
  })
  it('leaves anything else alone', () => {
    expect(returnPeriodLabel(null)).toBe('')
    expect(returnPeriodLabel('')).toBe('')
    expect(returnPeriodLabel('2026-13')).toBe('2026-13')
  })
})

describe('defaultReturnPeriod', () => {
  it('is the month before the payment', () => {
    expect(defaultReturnPeriod('2026-11-20')).toBe('2026-10')
  })
  it('crosses the year', () => {
    expect(defaultReturnPeriod('2027-01-05')).toBe('2026-12')
  })
})

describe('returnPeriodOptions', () => {
  it('starts at the payment month and goes back', () => {
    const o = returnPeriodOptions('2026-02-10', 3)
    expect(o.map((x) => x.value)).toEqual(['2026-02', '2026-01', '2025-12'])
    expect(o[2].label).toBe('Dec 2025')
  })
  it('never offers a month after the payment', () => {
    expect(returnPeriodOptions('2026-11-20').every((x) => x.value <= '2026-11')).toBe(true)
  })
  it('gives at least one month', () => {
    expect(returnPeriodOptions('2026-11-20', 0)).toHaveLength(1)
  })
})

describe('challanTotal', () => {
  it('adds every head, interest and late fee', () => {
    expect(challanTotal({ igst: 0, cgst: 300, sgst: 300, interest: 50, late_fee: 25 })).toBe(675)
  })
  it('does not drift on paise', () => {
    expect(challanTotal({ cgst: 0.1, sgst: 0.2 })).toBe(0.3)
  })
  it('treats missing or blank parts as nil', () => {
    expect(challanTotal({ igst: NaN })).toBe(0)
    expect(challanTotal({})).toBe(0)
  })
})

describe('gstStanding', () => {
  it('reads a positive balance as payable', () => {
    expect(gstStanding(281)).toEqual({ kind: 'payable', amount: 281 })
  })
  it('reads a negative balance as credit in hand', () => {
    expect(gstStanding(-2410)).toEqual({ kind: 'credit', amount: 2410 })
  })
  it('treats less than half a paisa as nil', () => {
    expect(gstStanding(0.004)).toEqual({ kind: 'nil', amount: 0 })
  })
})
