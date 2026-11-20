import { describe, expect, it } from 'vitest'
import { dayAfter, earliestOpenDate, isInClosedPeriod } from './books-lock'

describe('dayAfter', () => {
  it('rolls over months and years', () => {
    expect(dayAfter('2026-10-31')).toBe('2026-11-01')
    expect(dayAfter('2026-12-31')).toBe('2027-01-01')
  })
  it('handles leap years', () => {
    expect(dayAfter('2028-02-28')).toBe('2028-02-29')
    expect(dayAfter('2027-02-28')).toBe('2027-03-01')
  })
})

describe('earliestOpenDate', () => {
  it('is the day after the lock when the books are closed', () => {
    expect(earliestOpenDate('2026-10-31')).toBe('2026-11-01')
  })
  it('keeps the field’s own minimum when it is later', () => {
    expect(earliestOpenDate('2026-10-31', '2026-11-05')).toBe('2026-11-05')
  })
  it('moves an earlier own minimum past the lock', () => {
    expect(earliestOpenDate('2026-10-31', '2026-09-01')).toBe('2026-11-01')
  })
  it('is the own minimum, or nothing, when the books are open', () => {
    expect(earliestOpenDate(null, '2026-09-01')).toBe('2026-09-01')
    expect(earliestOpenDate(null)).toBeUndefined()
    expect(earliestOpenDate(undefined, '')).toBeUndefined()
  })
})

describe('isInClosedPeriod', () => {
  it('includes the last closed day', () => {
    expect(isInClosedPeriod('2026-10-31', '2026-10-31')).toBe(true)
    expect(isInClosedPeriod('2026-11-01', '2026-10-31')).toBe(false)
  })
  it('is false with no date or no lock', () => {
    expect(isInClosedPeriod('', '2026-10-31')).toBe(false)
    expect(isInClosedPeriod('2026-01-01', null)).toBe(false)
  })
})
