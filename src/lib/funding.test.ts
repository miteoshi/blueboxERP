import { describe, expect, it } from 'vitest'
import { firstEntryDate, fundingDirections, fundingEntryLabel } from './funding'

describe('fundingEntryLabel', () => {
  it('names capital entries', () => {
    expect(fundingEntryLabel('capital', 'in')).toBe('Capital introduced')
    expect(fundingEntryLabel('capital', 'out')).toBe('Drawings')
  })
  it('names loan entries', () => {
    expect(fundingEntryLabel('loan', 'in')).toBe('Loan received')
    expect(fundingEntryLabel('loan', 'out')).toBe('Loan repayment')
  })
})

describe('fundingDirections', () => {
  it('offers money in first, then out', () => {
    expect(fundingDirections('capital').map((d) => d.value)).toEqual(['in', 'out'])
    expect(fundingDirections('loan').map((d) => d.title)).toEqual(['Loan received', 'Repayment'])
  })
})

describe('firstEntryDate', () => {
  it('is the day after the opening date', () => {
    expect(firstEntryDate('2026-10-31')).toBe('2026-11-01')
  })
  it('crosses the year and leap days', () => {
    expect(firstEntryDate('2026-12-31')).toBe('2027-01-01')
    expect(firstEntryDate('2028-02-28')).toBe('2028-02-29')
  })
})
