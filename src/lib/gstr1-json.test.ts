import { describe, expect, it } from 'vitest'
import { buildGstr1Json, filingPeriod, portalDate, uqcFor, type Gstr1Input } from './gstr1-json'

const line = (rate: number, taxable: number, inter: boolean) => ({
  gst_rate: rate,
  taxable_value: taxable,
  igst_amount: inter ? (taxable * rate) / 100 : 0,
  cgst_amount: inter ? 0 : (taxable * rate) / 200,
  sgst_amount: inter ? 0 : (taxable * rate) / 200,
})

const base: Gstr1Input = {
  gstin: '24AAACZ9999Z1Z9', fp: '102026', supplierState: '24',
  b2b: [], b2cl: [], b2cs: [], cdnr: [], cdnur: [], hsn: [], documents: [],
}

describe('formats', () => {
  it('writes dates as dd-mm-yyyy', () => {
    expect(portalDate('2026-10-05')).toBe('05-10-2026')
  })

  it('takes a calendar month or a whole quarter as the period', () => {
    expect(filingPeriod('2026-10-01', '2026-10-31')).toBe('102026')
    expect(filingPeriod('2028-02-01', '2028-02-29')).toBe('022028')
    expect(filingPeriod('2026-10-01', '2026-12-31')).toBe('122026')
    expect(filingPeriod('2027-01-01', '2027-03-31')).toBe('032027')
    expect(filingPeriod('2026-11-01', '2027-01-31')).toBeNull() // not a quarter
    expect(filingPeriod('2026-10-02', '2026-10-31')).toBeNull()
    expect(filingPeriod('2026-10-01', '2026-10-30')).toBeNull()
  })

  it('maps unit names to the portal’s units of quantity', () => {
    expect(uqcFor('Meter', '8544')).toBe('MTR')
    expect(uqcFor('kg', '7408')).toBe('KGS')
    expect(uqcFor(' Pieces ', '8536')).toBe('PCS')
    expect(uqcFor('Each', '8536')).toBe('NOS')
    expect(uqcFor('Square Meter', '6810')).toBe('SQM')
    expect(uqcFor('Coil', '8544')).toBe('OTH')
    expect(uqcFor(null, '8544')).toBe('OTH')
    expect(uqcFor('Hour', '998719')).toBe('NA') // services
  })
})

describe('buildGstr1Json', () => {
  it('writes the header and leaves out empty sections', () => {
    const { json, warnings } = buildGstr1Json(base)
    expect(json).toEqual({ gstin: '24AAACZ9999Z1Z9', fp: '102026', version: 'GST2.2', hash: 'hash', gt: 0, cur_gt: 0 })
    expect(warnings).toEqual([])
  })

  it('groups B2B invoices by recipient with one item per rate', () => {
    const { json } = buildGstr1Json({
      ...base,
      b2b: [
        { invoice_no: 'INV/1', invoice_date: '2026-10-05', buyer_gstin: '24aaaca1111a1z1', place_of_supply: '24', reverse_charge: false, total_amount: 23010,
          lines: [line(18, 10000, false), line(18, 5000, false), line(12, 3000, false)] },
        { invoice_no: 'INV/2', invoice_date: '2026-10-06', buyer_gstin: '27AAACB2222B1Z2', place_of_supply: '27', reverse_charge: true, total_amount: 1180,
          lines: [line(18, 1000, true)] },
        { invoice_no: 'INV/3', invoice_date: '2026-10-07', buyer_gstin: '24AAACA1111A1Z1', place_of_supply: '24', reverse_charge: false, total_amount: 118,
          lines: [line(18, 100, false)] },
      ],
    })
    const b2b = json.b2b as { ctin: string; inv: { inum: string; idt: string; rchrg: string; itms: unknown[] }[] }[]
    expect(b2b.map((g) => [g.ctin, g.inv.map((i) => i.inum)])).toEqual([['24AAACA1111A1Z1', ['INV/1', 'INV/3']], ['27AAACB2222B1Z2', ['INV/2']]])
    expect(b2b[0].inv[0]).toMatchObject({ idt: '05-10-2026', val: 23010, pos: '24', rchrg: 'N', inv_typ: 'R' })
    expect(b2b[0].inv[0].itms).toEqual([
      { num: 1, itm_det: { rt: 12, txval: 3000, iamt: 0, camt: 180, samt: 180, csamt: 0 } },
      { num: 2, itm_det: { rt: 18, txval: 15000, iamt: 0, camt: 1350, samt: 1350, csamt: 0 } },
    ])
    expect(b2b[1].inv[0]).toMatchObject({ rchrg: 'Y', itms: [{ num: 1, itm_det: { rt: 18, txval: 1000, iamt: 180 } }] })
  })

  it('writes B2CL by place of supply with IGST only', () => {
    const { json } = buildGstr1Json({
      ...base,
      b2cl: [{ invoice_no: 'INV/9', invoice_date: '2026-10-09', buyer_gstin: null, place_of_supply: '27', reverse_charge: false, total_amount: 236000, lines: [line(18, 200000, true)] }],
    })
    expect(json.b2cl).toEqual([{ pos: '27', inv: [{ inum: 'INV/9', idt: '09-10-2026', val: 236000, itms: [{ num: 1, itm_det: { rt: 18, txval: 200000, iamt: 36000, csamt: 0 } }] }] }])
  })

  it('marks B2CS rows intra- or inter-state and drops rows netted to nil', () => {
    const { json, warnings } = buildGstr1Json({
      ...base,
      b2cs: [
        { pos: '24', rate: 18, taxable: 5000, igst: 0, cgst: 450, sgst: 450 },
        { pos: '27', rate: 18, taxable: 2000, igst: 360, cgst: 0, sgst: 0 },
        { pos: '24', rate: 12, taxable: 0, igst: 0, cgst: 0, sgst: 0 },
      ],
    })
    expect(json.b2cs).toEqual([
      { sply_ty: 'INTRA', pos: '24', typ: 'OE', rt: 18, txval: 5000, iamt: 0, camt: 450, samt: 450, csamt: 0 },
      { sply_ty: 'INTER', pos: '27', typ: 'OE', rt: 18, txval: 2000, iamt: 360, camt: 0, samt: 0, csamt: 0 },
    ])
    expect(warnings).toEqual([])
  })

  it('warns when credit notes leave a B2CS row negative', () => {
    const { warnings } = buildGstr1Json({ ...base, b2cs: [{ pos: '24', rate: 18, taxable: -500, igst: 0, cgst: -45, sgst: -45 }] })
    expect(warnings[0]).toMatch(/1 B2CS row came out negative/)
  })

  it('writes credit notes to registered and B2CL buyers', () => {
    const note = { credit_note_no: 'CN/1', note_date: '2026-10-20', place_of_supply: '24', reverse_charge: false, total_amount: 590, lines: [line(18, 500, false)] }
    const { json } = buildGstr1Json({
      ...base,
      cdnr: [{ ...note, buyer_gstin: '24AAACA1111A1Z1' }],
      cdnur: [{ ...note, credit_note_no: 'CN/2', buyer_gstin: null, place_of_supply: '27', total_amount: 118000, lines: [line(18, 100000, true)] }],
    })
    expect(json.cdnr).toEqual([{ ctin: '24AAACA1111A1Z1', nt: [{
      ntty: 'C', nt_num: 'CN/1', nt_dt: '20-10-2026', val: 590, pos: '24', rchrg: 'N', inv_typ: 'R',
      itms: [{ num: 1, itm_det: { rt: 18, txval: 500, iamt: 0, camt: 45, samt: 45, csamt: 0 } }],
    }] }])
    expect(json.cdnur).toEqual([{
      typ: 'B2CL', ntty: 'C', nt_num: 'CN/2', nt_dt: '20-10-2026', val: 118000, pos: '27',
      itms: [{ num: 1, itm_det: { rt: 18, txval: 100000, iamt: 18000, csamt: 0 } }],
    }])
  })

  it('splits the HSN summary into B2B and B2C and flags gaps', () => {
    const h = { description: 'PVC cable', unit_name: 'Meter', gst_rate: 18, total_qty: 1200.456, taxable_value: 10000, igst_amount: 0, cgst_amount: 900, sgst_amount: 900 }
    const { json, warnings } = buildGstr1Json({
      ...base,
      hsn: [
        { ...h, hsn_code: '8544', b2b: true },
        { ...h, hsn_code: '8536', unit_name: 'Coil', b2b: true },
        { ...h, hsn_code: '8544', b2b: false },
        { ...h, hsn_code: '998719', unit_name: 'Hour', b2b: false },
        { ...h, hsn_code: '—', b2b: false },
      ],
    })
    const hsn = json.hsn as { hsn_b2b: Record<string, unknown>[]; hsn_b2c: Record<string, unknown>[] }
    expect(hsn.hsn_b2b).toHaveLength(2)
    expect(hsn.hsn_b2b[0]).toEqual({ num: 1, hsn_sc: '8544', desc: 'PVC cable', user_desc: 'PVC cable', uqc: 'MTR', qty: 1200.46, rt: 18, txval: 10000, iamt: 0, camt: 900, samt: 900, csamt: 0 })
    expect(hsn.hsn_b2c.map((r) => [r.num, r.hsn_sc, r.uqc, r.qty])).toEqual([[1, '8544', 'MTR', 1200.46], [2, '998719', 'NA', 0], [3, '—', 'MTR', 1200.46]])
    expect(warnings).toEqual(['1 HSN summary row has no HSN code. Add the code to the item and reissue, or enter it on the portal.', 'Units reported as OTH (others): Coil.'])
  })

  it('numbers Table 13 by kind of document', () => {
    const { json } = buildGstr1Json({
      ...base,
      documents: [
        { nature: 'Credit Note', from: 'CN/1', to: 'CN/4', total: 4, cancelled: 1 },
        { nature: 'Invoices for outward supply', from: 'INV/1', to: 'INV/40', total: 40, cancelled: 2 },
        { nature: 'Invoices for outward supply', from: 'EXP/1', to: 'EXP/3', total: 3, cancelled: 0 },
      ],
    })
    expect(json.doc_issue).toEqual({ doc_det: [
      { doc_num: 1, docs: [
        { num: 1, from: 'INV/1', to: 'INV/40', totnum: 40, cancel: 2, net_issue: 38 },
        { num: 2, from: 'EXP/1', to: 'EXP/3', totnum: 3, cancel: 0, net_issue: 3 },
      ] },
      { doc_num: 5, docs: [{ num: 1, from: 'CN/1', to: 'CN/4', totnum: 4, cancel: 1, net_issue: 3 }] },
    ] })
  })
})
