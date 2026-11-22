import { describe, expect, it } from 'vitest'
import { creditCheck } from './credit'

describe('creditCheck', () => {
  it('has no limit when the customer has none', () => {
    const c = creditCheck({ credit_limit: 0, exposure: 900_000, overdue: 0 }, 50_000, false)
    expect(c).toMatchObject({ limit: null, afterOrder: 950_000, headroom: null, over: false, blocked: false })
  })

  it('allows an order that stays within the limit', () => {
    const c = creditCheck({ credit_limit: 100_000, exposure: 60_000, overdue: 0 }, 40_000, false)
    expect(c).toMatchObject({ limit: 100_000, afterOrder: 100_000, headroom: 0, over: false, blocked: false })
  })

  it('blocks a sales user once the order would cross the limit', () => {
    const c = creditCheck({ credit_limit: 100_000, exposure: 60_000, overdue: 5_000 }, 40_000.5, false)
    expect(c.over).toBe(true)
    expect(c.blocked).toBe(true)
    expect(c.headroom).toBeCloseTo(-0.5)
    expect(c.overdue).toBe(5_000)
  })

  it('lets a manager go over the limit', () => {
    const c = creditCheck({ credit_limit: 100_000, exposure: 120_000, overdue: 0 }, 10_000, true)
    expect(c).toMatchObject({ over: true, blocked: false, headroom: -30_000 })
  })

  it('counts unapplied receipts, which make exposure negative', () => {
    const c = creditCheck({ credit_limit: 50_000, exposure: -20_000, overdue: 0 }, 60_000, false)
    expect(c).toMatchObject({ afterOrder: 40_000, over: false })
  })

  it('accepts amounts that arrive as strings from numeric columns', () => {
    const c = creditCheck({ credit_limit: '100000' as unknown as number, exposure: '99000.00' as unknown as number, overdue: 0 }, 2_000, false)
    expect(c).toMatchObject({ limit: 100_000, afterOrder: 101_000, blocked: true })
  })
})
