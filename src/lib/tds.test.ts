import { describe, expect, it } from 'vitest'
import { TDS_CODES, deducteePan, tdsAmount, tdsCodeLabel, tdsQuarter } from './tds'

describe('TDS_CODES', () => {
  it('has unique four-digit codes', () => {
    const codes = TDS_CODES.map((c) => c.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const c of codes) expect(c).toMatch(/^[0-9]{4}$/)
  })
})

describe('tdsCodeLabel', () => {
  it('names a known code with its old section', () => {
    expect(tdsCodeLabel('1031')).toBe('1031 · Purchase of goods (194Q)')
  })
  it('falls back to the bare code', () => {
    expect(tdsCodeLabel('1099')).toBe('1099')
    expect(tdsCodeLabel(null)).toBe('—')
  })
})

describe('tdsAmount', () => {
  it('rounds to the rupee', () => {
    expect(tdsAmount(10000, 1)).toBe(100)
    expect(tdsAmount(123456, 0.1)).toBe(123)
    expect(tdsAmount(12345, 2)).toBe(247)
  })
  it('is nil without a base or rate', () => {
    expect(tdsAmount(0, 2)).toBe(0)
    expect(tdsAmount(1000, 0)).toBe(0)
  })
})

describe('deducteePan', () => {
  it('prefers the saved PAN', () => {
    expect(deducteePan('ABCDE1234F', '24PQRST5678K1Z5')).toBe('ABCDE1234F')
  })
  it('takes it from the GSTIN', () => {
    expect(deducteePan(null, '24pqrst5678k1z5')).toBe('PQRST5678K')
  })
  it('is null when neither has one', () => {
    expect(deducteePan('', 'URP')).toBeNull()
    expect(deducteePan(null, null)).toBeNull()
  })
})

describe('tdsQuarter', () => {
  it('maps months to quarters of the financial year', () => {
    expect(tdsQuarter('2026-04-01')).toEqual({ label: 'Q1 2026-27', from: '2026-04-01', to: '2026-06-30' })
    expect(tdsQuarter('2026-11-20')).toEqual({ label: 'Q3 2026-27', from: '2026-10-01', to: '2026-12-31' })
    expect(tdsQuarter('2027-02-28')).toEqual({ label: 'Q4 2026-27', from: '2027-01-01', to: '2027-03-31' })
  })
})
