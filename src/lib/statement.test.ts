import { describe, expect, it } from 'vitest'
import { balanceMeaning, balanceSide, statementDetail, statementDocHref, statementKindLabel, statementTotals, type StatementRow } from './statement'

describe('statementDetail', () => {
  it('names the payment mode and keeps the free-text reference whole', () => {
    expect(statementDetail({ kind: 'receipt', detail: 'upi · UTR 99 · part payment' })).toBe('UPI · UTR 99 · part payment')
    expect(statementDetail({ kind: 'payment', detail: 'bank_transfer' })).toBe('Bank transfer')
  })

  it('turns note reasons and bill numbers into words', () => {
    expect(statementDetail({ kind: 'credit_note', detail: 'sales_return' })).toBe('Sales return')
    expect(statementDetail({ kind: 'debit_note', detail: 'purchase_return' })).toBe('Goods returned')
    expect(statementDetail({ kind: 'bill', detail: 'INV/778' })).toBe('Supplier invoice INV/778')
    expect(statementDetail({ kind: 'invoice', detail: '  ' })).toBe('')
  })
})

describe('links and labels', () => {
  it('links documents that have a page', () => {
    expect(statementDocHref({ kind: 'invoice', doc_id: 'a' })).toBe('/invoices/a')
    expect(statementDocHref({ kind: 'debit_note', doc_id: 'b' })).toBe('/debit-notes/b')
    expect(statementDocHref({ kind: 'receipt', doc_id: 'c' })).toBeNull()
    expect(statementDocHref({ kind: 'invoice', doc_id: null })).toBeNull()
  })

  it('labels kinds, falling back to the raw value', () => {
    expect(statementKindLabel('credit_note')).toBe('Credit note')
    expect(statementKindLabel('mystery')).toBe('mystery')
  })
})

describe('balances', () => {
  it('uses Dr for money owed to us and Cr for money we owe', () => {
    expect(balanceSide('client', 450)).toBe('Dr')
    expect(balanceSide('client', -10)).toBe('Cr')
    expect(balanceSide('supplier', 1372)).toBe('Cr')
    expect(balanceSide('supplier', -5)).toBe('Dr')
    expect(balanceSide('client', 0.004)).toBe('')
  })

  it('says it in plain words', () => {
    expect(balanceMeaning('client', 450)).toBe('They owe you')
    expect(balanceMeaning('client', -1)).toBe('Advance you hold for them')
    expect(balanceMeaning('supplier', 1372)).toBe('You owe them')
    expect(balanceMeaning('supplier', -1)).toBe('Advance lying with them')
    expect(balanceMeaning('supplier', 0)).toBe('Nothing owed either way')
  })

  it('totals a statement (the customer from the end-to-end test closes at 450)', () => {
    const row = (seq: number, kind: string, debit: number, credit: number, balance: number): StatementRow => ({
      seq, entry_date: '2026-11-01', kind, doc_id: null, doc_no: null, detail: null, debit, credit, balance,
    })
    const rows = [row(0, 'opening', 0, 0, 0), row(1, 'invoice', 3540, 0, 3540), row(2, 'credit_note', 0, 590, 2950), row(3, 'receipt', 0, 2000, 950), row(4, 'receipt', 0, 500, 450)]
    expect(statementTotals(rows)).toEqual({ opening: 0, debit: 3540, credit: 3090, closing: 450, count: 4 })
    expect(statementTotals([])).toEqual({ opening: 0, debit: 0, credit: 0, closing: 0, count: 0 })
  })
})
