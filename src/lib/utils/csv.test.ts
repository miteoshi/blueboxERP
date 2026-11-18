import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'

describe('toCsv', () => {
  type Row = { name: string; amount: number | null; paid: boolean }
  const cols = [
    { header: 'Name', value: (r: Row) => r.name },
    { header: 'Amount', value: (r: Row) => r.amount },
    { header: 'Paid', value: (r: Row) => r.paid },
  ]

  it('writes numbers as numbers, quotes commas and quotes, and uses Excel line endings', () => {
    expect(toCsv([{ name: 'Shah, "Sons"', amount: 1180.5, paid: true }, { name: 'B', amount: null, paid: false }], cols)).toBe(
      'Name,Amount,Paid\r\n"Shah, ""Sons""",1180.5,Yes\r\nB,,No'
    )
  })

  it('stops spreadsheet formulas in text from running', () => {
    for (const name of ['=HYPERLINK("x")', '+91 98250', '-5', '@SUM(A1)']) {
      expect(toCsv([{ name, amount: 1, paid: false }], cols).split('\r\n')[1].replace(/^"/, '').startsWith("'")).toBe(true)
    }
  })

  it('drops non-finite numbers', () => {
    expect(toCsv([{ name: 'x', amount: Number.NaN, paid: false }], cols).split('\r\n')[1]).toBe('x,,No')
  })
})
