import { describe, expect, it } from 'vitest'
import { daysUntil, upcomingCompliance } from './compliance'

const keys = (today: string, days?: number) => upcomingCompliance(today, days).map((i) => `${i.date} ${i.key}`)

describe('upcomingCompliance', () => {
  it('lists late November and December 2026 in date order', () => {
    expect(keys('2026-11-20', 45)).toEqual([
      '2026-11-20 gstr3b-2026-10',
      '2026-12-07 tds-2026-11',
      '2026-12-11 gstr1-2026-11',
      '2026-12-15 adv-2026-12',
      '2026-12-20 gstr3b-2026-11',
      '2026-12-31 gstr9-2025',
    ])
  })

  it('puts the Q3 TDS return on 31 January', () => {
    const r = upcomingCompliance('2027-01-25', 10).find((i) => i.key === 'tdsr-2026-q3')
    expect(r?.date).toBe('2027-01-31')
    expect(r?.detail).toBe('October–December, tax year 2026-27')
  })

  it('moves March TDS to 30 April and puts the Q4 return on 31 May', () => {
    const april = upcomingCompliance('2027-04-01', 30)
    expect(april.find((i) => i.key === 'tds-2027-03')?.date).toBe('2027-04-30')
    expect(april.some((i) => i.date === '2027-04-07' && i.kind === 'tds')).toBe(false)
    expect(upcomingCompliance('2027-05-20', 15).find((i) => i.key === 'tdsr-2026-q4')?.date).toBe('2027-05-31')
  })

  it('puts the Q1 return on 31 July and advance tax in June and March', () => {
    expect(upcomingCompliance('2026-07-25', 10).find((i) => i.key === 'tdsr-2026-q1')?.date).toBe('2026-07-31')
    expect(upcomingCompliance('2026-06-01', 20).find((i) => i.kind === 'income_tax')?.detail).toBe(
      "At least 15% of the year's tax, tax year 2026-27",
    )
    expect(upcomingCompliance('2027-03-01', 20).find((i) => i.kind === 'income_tax')?.detail).toBe(
      "At least 100% of the year's tax, tax year 2026-27",
    )
  })

  it('names the month each GST and TDS item is for', () => {
    const dec = upcomingCompliance('2026-12-01', 10)
    expect(dec.find((i) => i.key === 'tds-2026-11')?.period).toBe('2026-11')
    expect(dec.find((i) => i.key === 'tds-2026-11')?.detail).toBe('TDS deducted in Nov 2026')
  })
})

describe('daysUntil', () => {
  it('counts whole days', () => {
    expect(daysUntil('2026-11-20', '2026-11-20')).toBe(0)
    expect(daysUntil('2026-12-07', '2026-11-20')).toBe(17)
  })
})
