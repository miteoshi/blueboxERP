import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import {
  closingBalance,
  detectColumns,
  matchStatement,
  parseStatementAmount,
  parseStatementDate,
  readStatementGrid,
  readStatementLines,
  referenceTokens,
  type MatchEntry,
  type StatementLine,
} from './bank-statement'

const csvFile = (name: string, rows: string[][]) =>
  new File([rows.map((r) => r.map((c) => (/[,"]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n')], name, {
    type: 'text/csv',
  })

async function load(file: File) {
  const grid = await readStatementGrid(file)
  const found = detectColumns(grid)
  return { found, lines: found ? readStatementLines(grid, found.headerRow, found.map) : [] }
}

describe('parseStatementDate', () => {
  it.each([
    ['05/11/26', '2026-11-05'],
    ['05-11-2026', '2026-11-05'],
    ['05.11.2026', '2026-11-05'],
    ['5 Nov 2026', '2026-11-05'],
    ['05-Nov-26', '2026-11-05'],
    ['05 November 2026', '2026-11-05'],
    ['2026-11-05', '2026-11-05'],
  ])('reads %s day first', (input, want) => {
    expect(parseStatementDate(input)).toBe(want)
  })

  it.each(['31/02/2026', 'Opening Balance', '', '13/13/2026'])('rejects %j', (input) => {
    expect(parseStatementDate(input)).toBeNull()
  })

  it('takes an Excel date cell as the calendar day, even a few seconds before midnight', () => {
    expect(parseStatementDate(new Date(2026, 10, 5))).toBe('2026-11-05')
    expect(parseStatementDate(new Date(2026, 10, 4, 23, 59, 50))).toBe('2026-11-05')
  })
})

describe('parseStatementAmount', () => {
  it.each([
    ['1,23,456.50', 123456.5],
    ['1234.50 Cr', 1234.5],
    ['200.00 Dr', 200],
    ['(500.00)', -500],
    ['-75', -75],
    ['₹ 1,000', 1000],
    ['Rs. 99.9', 99.9],
  ])('reads %s', (input, want) => {
    expect(parseStatementAmount(input)).toBe(want)
  })

  it.each(['-', '', 'N/A'])('gives nothing for %j', (input) => {
    expect(parseStatementAmount(input)).toBeNull()
  })
})

describe('reading bank layouts', () => {
  it('HDFC CSV: finds the header under the preamble; row numbers match the file', async () => {
    const { found, lines } = await load(
      csvFile('hdfc.csv', [
        ['HDFC BANK Ltd.'],
        ['Account No :', '50100012345678'],
        ['Statement From : 01/11/26 To : 18/11/26'],
        [],
        ['Date', 'Narration', 'Chq./Ref.No.', 'Value Dt', 'Withdrawal Amt.', 'Deposit Amt.', 'Closing Balance'],
        ['01/11/26', 'OPENING BALANCE', '', '', '', '', '50,000.00'],
        ['05/11/26', 'NEFT CR-412345678901-ALPHA TRADERS', '0000412345678901', '05/11/26', '', '3,000.00', '53,000.00'],
        ['06/11/26', 'CHQ PAID-MICR CTS-SUP ONE', '000451', '06/11/26', '6,000.00', '', '47,000.00'],
        ['', 'Total', '', '', '6,000.00', '3,000.00', ''],
      ])
    )
    expect(found?.headerRow).toBe(4)
    expect(lines.map((l) => [l.row, l.date, l.deposit, l.withdrawal, l.reference])).toEqual([
      [7, '2026-11-05', 3000, 0, '0000412345678901'],
      [8, '2026-11-06', 0, 6000, '000451'],
    ])
    expect(closingBalance(lines)).toEqual({ date: '2026-11-06', balance: 47000 })
  })

  it('ICICI Excel: date cells, and the transaction date rather than the value date', async () => {
    const sheet = XLSX.utils.aoa_to_sheet(
      [
        ['DETAILED STATEMENT'],
        [],
        ['S No.', 'Value Date', 'Transaction Date', 'Cheque Number', 'Transaction Remarks', 'Withdrawal Amount (INR )', 'Deposit Amount (INR )', 'Balance (INR )'],
        [1, new Date(2026, 10, 3), new Date(2026, 10, 2), '', 'UPI/9981/ALPHA', 0, 1000, 51000],
        [2, new Date(2026, 10, 9), new Date(2026, 10, 9), '112233', 'CLG CHQ 112233', 0, 5000, 56000],
      ],
      { cellDates: true }
    )
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'Sheet1')
    const { lines } = await load(new File([XLSX.write(book, { type: 'array', bookType: 'xlsx' })], 'icici.xlsx'))
    expect(lines.map((l) => [l.date, l.deposit, l.reference])).toEqual([
      ['2026-11-02', 1000, ''],
      ['2026-11-09', 5000, '112233'],
    ])
  })

  it('Kotak: one Amount column with Dr / Cr, and a second Dr / Cr for the balance', async () => {
    const { lines } = await load(
      csvFile('kotak.csv', [
        ['Sl. No.', 'Date', 'Description', 'Chq / Ref No.', 'Amount', 'Dr / Cr', 'Balance', 'Dr / Cr'],
        ['1', '05-11-2026', 'IMPS-ALPHA', 'IMPS123456', '1,500.00', 'CR', '51,500.00', 'CR'],
        ['2', '07-11-2026', 'RENT NOV', '', '2,500.00', 'DR', '49,000.00', 'CR'],
      ])
    )
    expect(lines.map((l) => [l.deposit, l.withdrawal])).toEqual([
      [1500, 0],
      [0, 2500],
    ])
  })

  it('SBI: Txn Date, Debit and Credit, "5 Nov 2026" dates', async () => {
    const { lines } = await load(
      csvFile('sbi.csv', [
        ['Txn Date', 'Value Date', 'Description', 'Ref No./Cheque No.', 'Debit', 'Credit', 'Balance'],
        ['5 Nov 2026', '5 Nov 2026', 'BY TRANSFER-NEFT', 'TRF123', ' ', '2,000.00', '52,000.00'],
        ['8 Nov 2026', '8 Nov 2026', 'SBI CHARGES', '', '118.00', ' ', '51,882.00'],
      ])
    )
    expect(lines.map((l) => [l.date, l.deposit, l.withdrawal])).toEqual([
      ['2026-11-05', 2000, 0],
      ['2026-11-08', 0, 118],
    ])
  })

  it('Axis: short headers, newest first; closing balance is the latest line', async () => {
    const { lines } = await load(
      csvFile('axis.csv', [
        ['Tran Date', 'CHQNO', 'PARTICULARS', 'DR', 'CR', 'BAL', 'SOL'],
        ['10-11-2026', '', 'INT CREDIT', '', '45.00', '50045.00', '123'],
        ['04-11-2026', '000777', 'CHQ 777', '1000.00', '', '50000.00', '123'],
      ])
    )
    expect(lines.map((l) => [l.date, l.deposit, l.withdrawal, l.reference])).toEqual([
      ['2026-11-10', 45, 0, ''],
      ['2026-11-04', 0, 1000, '000777'],
    ])
    expect(closingBalance(lines)).toEqual({ date: '2026-11-10', balance: 50045 })
  })

  it('one amount column with Cr / Dr written on the amount', async () => {
    const { lines } = await load(
      csvFile('s.csv', [
        ['Date', 'Particulars', 'Amount', 'Balance'],
        ['05/11/2026', 'x', '500.00 Cr', '1'],
        ['06/11/2026', 'y', '200.00 Dr', '1'],
      ])
    )
    expect(lines.map((l) => [l.deposit, l.withdrawal])).toEqual([
      [500, 0],
      [0, 200],
    ])
  })

  it('a sheet with no amount columns is not a statement', () => {
    expect(detectColumns([['Name', 'Date', 'City']])).toBeNull()
  })
})

describe('referenceTokens', () => {
  it('keeps cheque numbers and UTR-like codes, drops short numbers and words', () => {
    expect(referenceTokens('Chq 000451')).toEqual(['000451'])
    expect(referenceTokens('UTR HDFCN52026111012345')).toEqual(['HDFCN52026111012345'])
    expect(referenceTokens('Ref 12 cash')).toEqual([])
    expect(referenceTokens(null)).toEqual([])
  })
})

describe('matchStatement', () => {
  const entry = (
    doc_no: string,
    doc_date: string,
    deposit: number,
    withdrawal: number,
    reference: string | null = null,
    bank_date: string | null = null
  ): MatchEntry => ({ kind: deposit ? 'receipt' : 'supplier_payment', doc_id: doc_no, doc_no, doc_date, reference, deposit, withdrawal, bank_date })
  const line = (row: number, date: string, deposit: number, withdrawal: number, description = '', reference = ''): StatementLine => ({
    row,
    date,
    description,
    reference,
    deposit,
    withdrawal,
    balance: null,
  })

  it('sorts a mixed statement into matches, already ticked and bank-only lines', () => {
    const entries = [
      entry('R4', '2026-11-14', 5000, 0, 'Chq 112233'),
      entry('P1', '2026-11-08', 0, 6000, '000451'),
      entry('R6', '2026-11-02', 1000, 0),
      entry('R7', '2026-11-03', 1000, 0),
      entry('E1', '2026-11-04', 0, 2500, 'UTR77', '2026-11-06'),
      entry('R5', '2026-11-10', 750, 0, 'UTR 412345678901'),
      entry('R9', '2026-11-20', 300, 0),
      entry('R8', '2026-11-12', 4000, 0),
    ]
    const lines = [
      line(2, '2026-11-03', 1000, 0, 'UPI-CUST'),
      line(3, '2026-11-04', 1000, 0, 'UPI-CUST2'),
      line(4, '2026-11-07', 0, 2500, 'RENT'),
      line(5, '2026-11-10', 750, 0, 'NEFT CR-412345678901-ALPHA'),
      line(6, '2026-11-11', 0, 6000, 'CHQ PAID', '0000451'),
      line(7, '2026-11-12', 0, 118, 'CHARGES'),
      line(10, '2026-11-13', 4000, 0, 'CASH DEPOSIT'),
      line(8, '2026-11-15', 300, 0, 'CASH DEP'),
      line(9, '2026-11-16', 5000, 0, 'CLG CHQ 112233'),
    ]
    const result = matchStatement(lines, entries)
    expect(result.matches.map((m) => [m.line.row, m.entry.doc_no, m.confidence])).toEqual([
      [2, 'R6', 'check'],
      [3, 'R7', 'check'],
      [5, 'R5', 'reference'],
      [6, 'P1', 'reference'],
      [10, 'R8', 'amount'],
      [9, 'R4', 'reference'],
    ])
    expect(result.alreadyTicked.map((t) => [t.line.row, t.entry.doc_no])).toEqual([[4, 'E1']])
    // the charges, and a deposit dated before the entry it would match
    expect(result.bankOnly.map((l) => l.row)).toEqual([7, 8])
  })

  it('a cheque number beats a closer date', () => {
    const result = matchStatement(
      [line(1, '2026-11-10', 100, 0, 'CHQ 555555'), line(2, '2026-11-11', 100, 0, 'CHQ 666666')],
      [entry('A', '2026-11-01', 100, 0, '666666'), entry('B', '2026-11-09', 100, 0, '555555')]
    )
    expect(result.matches.map((m) => [m.line.row, m.entry.doc_no, m.confidence])).toEqual([
      [1, 'B', 'reference'],
      [2, 'A', 'reference'],
    ])
  })

  it('equal amounts pair in order and are flagged to check', () => {
    const result = matchStatement(
      [line(1, '2026-11-10', 100, 0), line(2, '2026-11-11', 100, 0)],
      [entry('A', '2026-11-01', 100, 0), entry('B', '2026-11-09', 100, 0)]
    )
    expect(result.matches.map((m) => [m.line.row, m.entry.doc_no, m.confidence])).toEqual([
      [1, 'A', 'check'],
      [2, 'B', 'check'],
    ])
  })

  it('a lone amount is a likely match; paise must agree exactly', () => {
    const result = matchStatement([line(1, '2026-11-10', 250, 0)], [entry('A', '2026-11-01', 250, 0), entry('B', '2026-11-01', 250.5, 0)])
    expect(result.matches.map((m) => [m.entry.doc_no, m.confidence])).toEqual([['A', 'amount']])
    expect(matchStatement([line(1, '2026-11-10', 100.1, 0)], [entry('A', '2026-11-10', 100.10000001, 0)]).matches).toHaveLength(1)
  })

  it('ignores lines more than 90 days after the entry, and the other side of the account', () => {
    expect(matchStatement([line(1, '2026-11-10', 100, 0)], [entry('A', '2026-08-01', 100, 0)]).matches).toHaveLength(0)
    expect(matchStatement([line(1, '2026-11-10', 0, 100)], [entry('A', '2026-11-01', 100, 0)]).matches).toHaveLength(0)
  })

  it('short numbers in a narration are not treated as references', () => {
    const result = matchStatement(
      [line(1, '2026-11-10', 100, 0, 'REF 12')],
      [entry('A', '2026-11-01', 100, 0, '12'), entry('B', '2026-11-09', 100, 0)]
    )
    expect(result.matches.map((m) => [m.entry.doc_no, m.confidence])).toEqual([['A', 'check']])
  })
})
