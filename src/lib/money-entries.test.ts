import { describe, expect, it } from 'vitest'
import { EXPENSE_RULES, INCOME_RULES, suggestHead, type MoneyHead } from './money-entries'

const expenseHeads: MoneyHead[] = ['Rent', 'Bank charges', 'Electricity', 'Other'].map((name, i) => ({ id: `e${i}`, name, is_active: true }))
const incomeHeads: MoneyHead[] = ['Interest received', 'Discount received', 'Scrap sales', 'Commission received', 'Rent received', 'Other'].map(
  (name, i) => ({ id: `i${i}`, name, is_active: true })
)
const nameOf = (heads: MoneyHead[], id: string) => heads.find((h) => h.id === id)?.name ?? ''

describe('suggestHead for money going out', () => {
  it.each([
    ['SMS ALERT CHARGES', 'Bank charges'],
    ['CHRG: IMPS P2A', 'Bank charges'],
    ['AMC DEBIT CARD FEE', 'Bank charges'],
    ['GST ON CHARGES', 'Bank charges'],
    ['NEFT DR-SOMEONE', 'Other'],
  ])('%s → %s', (text, head) => {
    expect(nameOf(expenseHeads, suggestHead(expenseHeads, text, EXPENSE_RULES))).toBe(head)
  })
})

describe('suggestHead for money coming in', () => {
  it.each([
    ['INT CREDIT', 'Interest received'],
    ['Int.Pd:50100012345678:01-07-2026 to 30-09-2026', 'Interest received'],
    ['SB INTEREST', 'Interest received'],
    ['CASHBACK UPI', 'Discount received'],
    ['NEFT CR-SHREE SCRAP TRADERS', 'Scrap sales'],
    ['NEFT CR-ALPHA TRADERS', 'Other'],
  ])('%s → %s', (text, head) => {
    expect(nameOf(incomeHeads, suggestHead(incomeHeads, text, INCOME_RULES))).toBe(head)
  })

  it('skips heads that are switched off, and gives nothing when there is no Other head', () => {
    const heads = incomeHeads.map((h) => (h.name === 'Interest received' ? { ...h, is_active: false } : h))
    expect(nameOf(heads, suggestHead(heads, 'INT CREDIT', INCOME_RULES))).toBe('Other')
    expect(suggestHead([], 'INT CREDIT', INCOME_RULES)).toBe('')
  })
})
