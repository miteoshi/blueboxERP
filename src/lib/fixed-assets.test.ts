import { describe, expect, it } from 'vitest'
import { categorySuggestion, describeMethod } from './fixed-assets'

describe('describeMethod', () => {
  it('describes straight line', () => {
    expect(describeMethod({ method: 'slm', useful_life_years: 5, wdv_rate: null })).toBe('Straight line over 5 years')
    expect(describeMethod({ method: 'slm', useful_life_years: 1, wdv_rate: null })).toBe('Straight line over 1 year')
  })
  it('describes written-down value', () => {
    expect(describeMethod({ method: 'wdv', useful_life_years: null, wdv_rate: 15 })).toBe('WDV at 15% a year')
  })
  it('drops trailing zeros from numeric strings', () => {
    expect(describeMethod({ method: 'wdv', useful_life_years: null, wdv_rate: '13.91' as unknown as number })).toBe('WDV at 13.91% a year')
    expect(describeMethod({ method: 'slm', useful_life_years: '3.00' as unknown as number, wdv_rate: null })).toBe('Straight line over 3 years')
  })
})

describe('categorySuggestion', () => {
  it('finds a category whatever the case or spacing', () => {
    expect(categorySuggestion('  computers AND printers ')).toEqual({ name: 'Computers and printers', lifeYears: 3, wdvRate: 40 })
  })
  it('has nothing for a category of the business’s own', () => {
    expect(categorySuggestion('Moulds')).toBeNull()
  })
})
