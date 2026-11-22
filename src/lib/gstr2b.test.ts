import { describe, expect, it } from 'vitest'
import { combineInvoices, docKey, parse2b, periodRange, portalDate, portalPeriod, reconcile, summarise, type BookBill } from './gstr2b'

const A = '24AAACA1111A1Z1'
const B = '27AAACB2222B1Z2'

// Current layout (from Oct 2024): taxes on the invoice
const current = {
  data: {
    gstin: '24aaacz9999z1z9', rtnprd: '102026', version: '1.0',
    docdata: {
      b2b: [
        { ctin: A, trdnm: 'Alpha Cables', supfildt: '10-11-2026', supprd: '102026', inv: [
          { inum: 'AC/0045', typ: 'R', dt: '05-10-2026', val: 11800, pos: '24', rev: 'N', itcavl: 'Y', rsn: '', txval: 10000, igst: 0, cgst: 900, sgst: 900, cess: 0 },
          { inum: 'AC-46', typ: 'R', dt: '12-10-2026', val: 5900, pos: '24', rev: 'N', itcavl: 'Y', txval: 5000, igst: 0, cgst: 450, sgst: 450, cess: 0 },
          { inum: 'AC-47', typ: 'R', dt: '20-10-2026', val: 1180, pos: '24', rev: 'N', itcavl: 'N', rsn: 'P', txval: 1000, igst: 0, cgst: 90, sgst: 90, cess: 0 },
        ] },
        { ctin: B, trdnm: 'Beta Switchgear', inv: [
          { inum: 'B-900', typ: 'R', dt: '28-10-2026', val: 23600, pos: '24', rev: 'N', itcavl: 'Y', txval: 20000, igst: 3600, cgst: 0, sgst: 0, cess: 0 },
        ] },
      ],
      cdnr: [
        { ctin: A, trdnm: 'Alpha Cables', nt: [
          { ntnum: 'CN-3', typ: 'C', suptyp: 'R', dt: '25-10-2026', val: 590, pos: '24', rev: 'N', itcavl: 'Y', txval: 500, igst: 0, cgst: 45, sgst: 45, cess: 0 },
        ] },
      ],
      impg: [{ refdt: '01-10-2026', portcd: 'INNSA1', boenum: '123' }],
    },
  },
}

// Older layout: taxes inside items[]
const older = {
  data: {
    gstin: '24AAACZ9999Z1Z9', rtnprd: '092026',
    docdata: {
      b2b: [{ ctin: A, trdnm: 'Alpha Cables', inv: [
        { inum: 'AC-40', typ: 'R', dt: '15-09-2026', val: 2360, pos: '24', rev: 'Y', itcavl: 'Y', diffprcnt: 1,
          items: [{ num: 1, rt: 18, txval: 1500, igst: 0, cgst: 135, sgst: 135, cess: 0 }, { num: 2, rt: 18, txval: 500, igst: 0, cgst: 45, sgst: 45, cess: 0 }] },
      ] }],
    },
  },
}

const bill = (p: Partial<BookBill> & Pick<BookBill, 'id' | 'supplier_invoice_no'>): BookBill => ({
  bill_no: 'BILL/' + p.id, bill_date: '2026-10-05', supplier_gstin: A, supplier_name: 'Alpha Cables',
  taxable: 0, igst: 0, cgst: 0, sgst: 0, total: 0, ...p,
})

describe('portal formats', () => {
  it('reads dates and periods', () => {
    expect(portalDate('05-10-2026')).toBe('2026-10-05')
    expect(portalDate('31-02-2026')).toBe('')
    expect(portalDate('2026-10-05')).toBe('')
    expect(portalPeriod('102026')).toBe('2026-10')
    expect(portalPeriod('132026')).toBe('')
  })

  it('compares invoice numbers by letters and digits only', () => {
    expect(docKey('AC/0045')).toBe(docKey('ac-45'))
    expect(docKey('2026-27/007')).toBe(docKey('2026-27/7'))
    expect(docKey('INV-000')).toBe('INV0')
    expect(docKey('INV 10')).not.toBe(docKey('INV 100'))
  })
})

describe('parse2b', () => {
  it('reads the current layout, notes and skipped sections', () => {
    const f = parse2b(JSON.stringify(current))
    expect(f.gstin).toBe('24AAACZ9999Z1Z9')
    expect(f.period).toBe('2026-10')
    expect(f.docs).toHaveLength(5)
    expect(f.docs[0]).toMatchObject({ kind: 'invoice', ctin: A, name: 'Alpha Cables', no: 'AC/0045', date: '2026-10-05', taxable: 10000, cgst: 900, sgst: 900, itcAvailable: true, reverseCharge: false, period: '2026-10' })
    expect(f.docs[2]).toMatchObject({ itcAvailable: false, reason: 'P' })
    expect(f.docs[4]).toMatchObject({ kind: 'credit_note', no: 'CN-3', cgst: 45 })
    expect(f.skipped).toEqual([{ section: 'impg', count: 1 }])
  })

  it('sums items in the older layout', () => {
    const f = parse2b(JSON.stringify(older))
    expect(f.docs[0]).toMatchObject({ taxable: 2000, cgst: 180, sgst: 180, igst: 0, reverseCharge: true, period: '2026-09' })
  })

  it('finds docdata however deeply an API response wraps it', () => {
    const f = parse2b(JSON.stringify({ code: 200, data: { status_cd: '1', data: { data: current.data } } }))
    expect(f.docs).toHaveLength(5)
  })

  it('explains files it cannot use', () => {
    expect(() => parse2b('not json')).toThrow(/not JSON/)
    expect(() => parse2b('{"data":{"b2b":[]}}')).toThrow(/docdata/)
  })
})

describe('reconcile', () => {
  const f = parse2b(JSON.stringify(current))
  const invoices = combineInvoices([f])
  const bills = [
    bill({ id: '1', supplier_invoice_no: 'AC-45', taxable: 10000, cgst: 900, sgst: 900.4, total: 11800 }),             // matched (paise rounding)
    bill({ id: '2', supplier_invoice_no: 'AC/046', taxable: 5000, cgst: 500, sgst: 500, total: 6000 }),               // different
    bill({ id: '3', supplier_invoice_no: 'AC-48', bill_date: '2026-10-29', taxable: 3000, cgst: 270, sgst: 270, total: 3540 }), // not in 2B
    bill({ id: '4', supplier_invoice_no: 'B900X', supplier_gstin: B, supplier_name: 'Beta', bill_date: '2026-10-28', taxable: 20000, igst: 3600, total: 23600 }), // typed differently
    bill({ id: '5', supplier_invoice_no: 'OLD-1', bill_date: '2026-09-30', taxable: 100, cgst: 9, sgst: 9, total: 118 }), // before the period
    bill({ id: '6', supplier_invoice_no: 'CASH-1', supplier_gstin: null, taxable: 100, total: 100 }),                 // unregistered
  ]
  const rows = reconcile(invoices, bills, '2026-10-01', '2026-10-31')
  const byNo = (no: string) => rows.find((r) => r.doc?.no === no)!

  it('matches within ₹1 per head', () => {
    expect(byNo('AC/0045')).toMatchObject({ status: 'matched', bill: { id: '1' } })
  })

  it('reports differences as books − 2B', () => {
    expect(byNo('AC-46')).toMatchObject({ status: 'different', diff: { taxable: 0, cgst: 50, sgst: 50, igst: 0 } })
  })

  it('suggests a bill of the same supplier and total for a 2B invoice not found', () => {
    expect(byNo('B-900')).toMatchObject({ status: 'only_2b', suggestion: { id: '4' } })
    expect(byNo('AC-47')).toMatchObject({ status: 'only_2b', suggestion: null })
  })

  it('lists bills in the period missing from 2B, ignoring earlier and unregistered ones', () => {
    const missing = rows.filter((r) => r.status === 'only_books').map((r) => r.bill!.id)
    expect(missing).toEqual(['3', '4'])
  })

  it('summarises the credit', () => {
    const s = summarise(rows, f.docs.filter((d) => d.kind !== 'invoice'))
    // invoices with credit available: 1800 + 900 + 3600; credit note −90
    expect(s.credit2b).toBe(6210)
    expect(s.creditNotAvailable).toBe(180)
    expect(s).toMatchObject({ matched: 1, different: 1, only2b: 2, onlyBooks: 2 })
    expect(s.creditAtRisk).toBe(540 + 3600)
    expect(s.creditDifference).toBe(100)
  })
})

describe('several months', () => {
  it('keeps the amended version of an invoice', () => {
    const sep = parse2b(JSON.stringify(older))
    const amend = parse2b(JSON.stringify({ data: { gstin: 'X', rtnprd: '102026', docdata: { b2ba: [{ ctin: A, trdnm: 'Alpha Cables', inv: [
      { oinum: 'AC-40', oidt: '15-09-2026', inum: 'AC-40A', dt: '15-09-2026', val: 2950, rev: 'N', itcavl: 'Y', txval: 2500, igst: 0, cgst: 225, sgst: 225 },
    ] }] } } }))
    const inv = combineInvoices([amend, sep])
    expect(inv.map((d) => d.no)).toEqual(['AC-40A'])
    expect(inv[0].section).toBe('b2ba')
  })

  it('covers whole calendar months', () => {
    expect(periodRange(['2026-10', '2026-09'])).toEqual({ from: '2026-09-01', to: '2026-10-31' })
    expect(periodRange(['2028-02'])).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(periodRange([''])).toBeNull()
  })
})
