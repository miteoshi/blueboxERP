// GSTR-1 as the JSON the GST portal accepts for upload (Returns → GSTR-1 →
// Prepare offline → Upload), built from the same figures as the CSV exports
// on the GST report. Layout as the portal's offline tool writes it:
//   b2b    by recipient GSTIN, invoice-wise, rate-wise items
//   b2cl   by place of supply, invoice-wise (inter-state B2C above the limit)
//   b2cs   by place of supply and rate, net of B2C credit notes
//   cdnr   credit notes to registered buyers, note-wise
//   cdnur  credit notes on B2CL invoices
//   hsn    Table 12, split into hsn_b2b and hsn_b2c
//   doc_issue  Table 13, by the form's numbering of document kinds
// Dates are dd-mm-yyyy, the period MMYYYY, amounts in rupees to 2 decimals.

export type RateLine = { gst_rate: number; taxable_value: number; igst_amount: number; cgst_amount: number; sgst_amount: number }

export type Gstr1Invoice = {
  invoice_no: string
  invoice_date: string
  buyer_gstin: string | null
  place_of_supply: string
  reverse_charge: boolean
  total_amount: number
  lines: RateLine[]
}

export type Gstr1Note = {
  credit_note_no: string
  note_date: string
  buyer_gstin: string | null
  place_of_supply: string
  reverse_charge: boolean
  total_amount: number
  lines: RateLine[]
}

export type Gstr1B2cs = { pos: string; rate: number; taxable: number; igst: number; cgst: number; sgst: number }

export type Gstr1Hsn = {
  hsn_code: string
  description: string | null
  unit_name: string | null
  gst_rate: number
  total_qty: number
  taxable_value: number
  igst_amount: number
  cgst_amount: number
  sgst_amount: number
  b2b: boolean
}

export type Gstr1Doc = { nature: string; from: string; to: string; total: number; cancelled: number }

export type Gstr1Input = {
  gstin: string
  fp: string
  supplierState: string
  b2b: Gstr1Invoice[]
  b2cl: Gstr1Invoice[]
  b2cs: Gstr1B2cs[]
  cdnr: Gstr1Note[]
  cdnur: Gstr1Note[]
  hsn: Gstr1Hsn[]
  documents: Gstr1Doc[]
}

const r2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

// yyyy-mm-dd → dd-mm-yyyy
export const portalDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}-${m}-${y}`
}

// The return period: a calendar month, or a whole quarter for quarterly
// (QRMP) filers, whose return carries the quarter's last month.
export function filingPeriod(from: string, to: string): string | null {
  const m = /^(\d{4})-(\d{2})-01$/.exec(from)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const lastDay = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10)
  if (to === lastDay(y, mo)) return `${m[2]}${m[1]}`
  if ([1, 4, 7, 10].includes(mo) && to === lastDay(y, mo + 2)) return `${String(mo + 2).padStart(2, '0')}${m[1]}`
  return null
}

// Units of quantity the portal accepts (UQC). Units are named freely in the
// item master, so common names are mapped; anything else is OTH (others).
const UQC: Record<string, string> = {
  bag: 'BAG', bags: 'BAG', bale: 'BAL', bales: 'BAL', bundle: 'BDL', bundles: 'BDL', bdl: 'BDL',
  bottle: 'BTL', bottles: 'BTL', btl: 'BTL', box: 'BOX', boxes: 'BOX', bunch: 'BUN', bunches: 'BUN',
  can: 'CAN', cans: 'CAN', 'cubic meter': 'CBM', 'cubic metre': 'CBM', cbm: 'CBM',
  'cubic centimeter': 'CCM', 'cubic centimetre': 'CCM', ccm: 'CCM',
  centimeter: 'CMS', centimetre: 'CMS', cm: 'CMS', cms: 'CMS', carton: 'CTN', cartons: 'CTN', ctn: 'CTN',
  dozen: 'DOZ', dozens: 'DOZ', doz: 'DOZ', drum: 'DRM', drums: 'DRM',
  gram: 'GMS', grams: 'GMS', gm: 'GMS', gms: 'GMS', g: 'GMS', gross: 'GRS',
  kilogram: 'KGS', kilograms: 'KGS', kg: 'KGS', kgs: 'KGS', kilolitre: 'KLR', kiloliter: 'KLR',
  kilometer: 'KME', kilometre: 'KME', km: 'KME',
  liter: 'LTR', litre: 'LTR', liters: 'LTR', litres: 'LTR', l: 'LTR', ltr: 'LTR',
  milliliter: 'MLT', millilitre: 'MLT', ml: 'MLT',
  meter: 'MTR', metre: 'MTR', meters: 'MTR', metres: 'MTR', m: 'MTR', mtr: 'MTR', mtrs: 'MTR',
  'metric ton': 'MTS', 'metric tonne': 'MTS', mt: 'MTS',
  number: 'NOS', numbers: 'NOS', nos: 'NOS', no: 'NOS', each: 'NOS', ea: 'NOS',
  pack: 'PAC', packs: 'PAC', packet: 'PAC', packets: 'PAC', pkt: 'PAC',
  piece: 'PCS', pieces: 'PCS', pc: 'PCS', pcs: 'PCS', pair: 'PRS', pairs: 'PRS', prs: 'PRS',
  quintal: 'QTL', quintals: 'QTL', qtl: 'QTL', roll: 'ROL', rolls: 'ROL',
  set: 'SET', sets: 'SET', 'square foot': 'SQF', 'square feet': 'SQF', sqft: 'SQF', 'sq ft': 'SQF',
  'square meter': 'SQM', 'square metre': 'SQM', sqm: 'SQM', 'sq m': 'SQM', 'square yard': 'SQY', 'square yards': 'SQY',
  tablet: 'TBS', tablets: 'TBS', thousand: 'THD', thousands: 'THD', ton: 'TON', tonne: 'TON', tonnes: 'TON', tons: 'TON',
  tube: 'TUB', tubes: 'TUB', 'us gallon': 'UGS', gallon: 'UGS', gallons: 'UGS', unit: 'UNT', units: 'UNT',
  yard: 'YDS', yards: 'YDS', yd: 'YDS',
}

const isService = (hsn: string) => /^99/.test(hsn)

export function uqcFor(unitName: string | null | undefined, hsn: string): string {
  if (isService(hsn)) return 'NA'
  const key = (unitName ?? '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/\.$/, '')
  return UQC[key] ?? 'OTH'
}

// GSTR-1 Table 13 numbers the kinds of document
export const DOC_KIND: Record<string, number> = {
  'Invoices for outward supply': 1,
  'Invoices for inward supply from unregistered person': 2,
  'Revised Invoice': 3,
  'Debit Note': 4,
  'Credit Note': 5,
  'Receipt voucher': 6,
  'Payment Voucher': 7,
  'Refund voucher': 8,
  'Delivery Challan for job work': 9,
  'Delivery Challan for supply on approval': 10,
  'Delivery Challan in case of liquid gas': 11,
  'Delivery Challan in cases other than by way of supply': 12,
}

// Lines summed per rate, as the portal wants one item per rate
function byRate(lines: RateLine[], igstOnly: boolean) {
  const map = new Map<number, { txval: number; iamt: number; camt: number; samt: number }>()
  for (const l of lines) {
    const rt = Number(l.gst_rate)
    const row = map.get(rt) ?? { txval: 0, iamt: 0, camt: 0, samt: 0 }
    row.txval += Number(l.taxable_value)
    row.iamt += Number(l.igst_amount)
    row.camt += Number(l.cgst_amount)
    row.samt += Number(l.sgst_amount)
    map.set(rt, row)
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([rt, t], i) => ({
    num: i + 1,
    itm_det: igstOnly
      ? { rt, txval: r2(t.txval), iamt: r2(t.iamt), csamt: 0 }
      : { rt, txval: r2(t.txval), iamt: r2(t.iamt), camt: r2(t.camt), samt: r2(t.samt), csamt: 0 },
  }))
}

function groupBy<T>(rows: T[], key: (r: T) => string) {
  const map = new Map<string, T[]>()
  for (const r of rows) map.set(key(r), [...(map.get(key(r)) ?? []), r])
  return [...map.entries()]
}

export type Gstr1Result = { json: Record<string, unknown>; warnings: string[] }

export function buildGstr1Json(input: Gstr1Input): Gstr1Result {
  const warnings: string[] = []
  const json: Record<string, unknown> = { gstin: input.gstin, fp: input.fp, version: 'GST2.2', hash: 'hash', gt: 0, cur_gt: 0 }

  if (input.b2b.length) {
    json.b2b = groupBy(input.b2b, (i) => (i.buyer_gstin ?? '').toUpperCase()).map(([ctin, invs]) => ({
      ctin,
      inv: invs.map((i) => ({
        inum: i.invoice_no,
        idt: portalDate(i.invoice_date),
        val: r2(i.total_amount),
        pos: i.place_of_supply,
        rchrg: i.reverse_charge ? 'Y' : 'N',
        inv_typ: 'R',
        itms: byRate(i.lines, false),
      })),
    }))
  }

  if (input.b2cl.length) {
    json.b2cl = groupBy(input.b2cl, (i) => i.place_of_supply).map(([pos, invs]) => ({
      pos,
      inv: invs.map((i) => ({ inum: i.invoice_no, idt: portalDate(i.invoice_date), val: r2(i.total_amount), itms: byRate(i.lines, true) })),
    }))
  }

  const b2cs = input.b2cs.filter((r) => r2(r.taxable) !== 0 || r2(r.igst + r.cgst + r.sgst) !== 0)
  if (b2cs.length) {
    json.b2cs = b2cs.map((r) => ({
      sply_ty: r.pos === input.supplierState ? 'INTRA' : 'INTER',
      pos: r.pos,
      typ: 'OE',
      rt: Number(r.rate),
      txval: r2(r.taxable),
      iamt: r2(r.igst),
      camt: r2(r.cgst),
      samt: r2(r.sgst),
      csamt: 0,
    }))
    const negative = b2cs.filter((r) => r.taxable < 0)
    if (negative.length) {
      warnings.push(`${negative.length} B2CS row${negative.length === 1 ? '' : 's'} came out negative because credit notes exceed sales at that rate and state. The portal may reject them; adjust them there or carry the credit to the next return.`)
    }
  }

  if (input.cdnr.length) {
    json.cdnr = groupBy(input.cdnr, (n) => (n.buyer_gstin ?? '').toUpperCase()).map(([ctin, notes]) => ({
      ctin,
      nt: notes.map((n) => ({
        ntty: 'C',
        nt_num: n.credit_note_no,
        nt_dt: portalDate(n.note_date),
        val: r2(n.total_amount),
        pos: n.place_of_supply,
        rchrg: n.reverse_charge ? 'Y' : 'N',
        inv_typ: 'R',
        itms: byRate(n.lines, false),
      })),
    }))
  }

  if (input.cdnur.length) {
    json.cdnur = input.cdnur.map((n) => ({
      typ: 'B2CL',
      ntty: 'C',
      nt_num: n.credit_note_no,
      nt_dt: portalDate(n.note_date),
      val: r2(n.total_amount),
      pos: n.place_of_supply,
      itms: byRate(n.lines, true),
    }))
  }

  if (input.hsn.length) {
    const noHsn = input.hsn.filter((h) => !h.hsn_code || h.hsn_code === '—')
    if (noHsn.length) warnings.push(`${noHsn.length} HSN summary row${noHsn.length === 1 ? ' has' : 's have'} no HSN code. Add the code to the item and reissue, or enter it on the portal.`)
    const other = [...new Set(input.hsn.filter((h) => !isService(h.hsn_code) && uqcFor(h.unit_name, h.hsn_code) === 'OTH').map((h) => h.unit_name ?? '(none)'))]
    if (other.length) warnings.push(`Units reported as OTH (others): ${other.join(', ')}.`)
    const rows = (b2b: boolean) =>
      input.hsn.filter((h) => h.b2b === b2b).map((h, i) => ({
        num: i + 1,
        hsn_sc: h.hsn_code,
        desc: h.description ?? '',
        user_desc: h.description ?? '',
        uqc: uqcFor(h.unit_name, h.hsn_code),
        qty: isService(h.hsn_code) ? 0 : r2(h.total_qty),
        rt: Number(h.gst_rate),
        txval: r2(h.taxable_value),
        iamt: r2(h.igst_amount),
        camt: r2(h.cgst_amount),
        samt: r2(h.sgst_amount),
        csamt: 0,
      }))
    json.hsn = { hsn_b2b: rows(true), hsn_b2c: rows(false) }
  }

  if (input.documents.length) {
    json.doc_issue = {
      doc_det: groupBy(input.documents, (d) => String(DOC_KIND[d.nature] ?? 0))
        .filter(([k]) => k !== '0')
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([k, docs]) => ({
          doc_num: Number(k),
          docs: docs.map((d, i) => ({ num: i + 1, from: d.from, to: d.to, totnum: d.total, cancel: d.cancelled, net_issue: d.total - d.cancelled })),
        })),
    }
  }

  return { json, warnings }
}
