// GSTR-2B reconciliation: the JSON file downloaded from the GST portal
// (Returns → GSTR-2B → Download → Generate JSON) matched against supplier
// bills. Input tax credit can be claimed only on invoices that appear in
// GSTR-2B (section 16(2)(aa)), so the useful answers are: which bills are
// missing from 2B (credit at risk — chase the supplier), which 2B invoices
// are missing from the books, and where the amounts differ.
//
// The portal has used two layouts: from October 2024 an invoice carries
// txval/igst/cgst/sgst/cess itself; before that they sat in items[]. Both are
// read. Everything happens in the browser; nothing is stored.

export type TwoBKind = 'invoice' | 'credit_note' | 'debit_note'

export type TwoBDoc = {
  section: 'b2b' | 'b2ba' | 'cdnr' | 'cdnra'
  kind: TwoBKind
  ctin: string
  name: string
  no: string
  originalNo: string | null   // amended sections: the number as first filed
  date: string                // ISO
  value: number
  taxable: number
  igst: number
  cgst: number
  sgst: number
  cess: number
  itcAvailable: boolean
  reason: string | null
  reverseCharge: boolean
  period: string              // the 2B return period, YYYY-MM
}

export type TwoBFile = {
  gstin: string
  period: string              // YYYY-MM
  docs: TwoBDoc[]
  skipped: { section: string; count: number }[]
}

export type BookBill = {
  id: string
  bill_no: string
  supplier_invoice_no: string
  bill_date: string
  supplier_gstin: string | null
  supplier_name: string
  taxable: number
  igst: number
  cgst: number
  sgst: number
  total: number
}

export type MatchStatus = 'matched' | 'different' | 'only_2b' | 'only_books'

export type MatchRow = {
  status: MatchStatus
  doc: TwoBDoc | null
  bill: BookBill | null
  // books − 2B, per head, when both sides exist
  diff: { taxable: number; igst: number; cgst: number; sgst: number } | null
  // only_2b: an unmatched bill of the same supplier with the same total
  suggestion: BookBill | null
}

export const TOLERANCE = 1 // ₹ per head, for rounding on either side

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v)).trim()

export const docTax = (d: { igst: number; cgst: number; sgst: number; cess?: number }) =>
  r2(d.igst + d.cgst + d.sgst + (d.cess ?? 0))
export const billTax = (b: { igst: number; cgst: number; sgst: number }) => r2(b.igst + b.cgst + b.sgst)

// dd-mm-yyyy → yyyy-mm-dd
export function portalDate(s: unknown): string {
  const m = str(s).match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (!m) return ''
  const [, d, mo, y] = m
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  const t = new Date(iso + 'T00:00:00Z')
  return Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== iso ? '' : iso
}

// MMYYYY → YYYY-MM
export function portalPeriod(s: unknown): string {
  const m = str(s).match(/^(\d{2})(\d{4})$/)
  return m && Number(m[1]) >= 1 && Number(m[1]) <= 12 ? `${m[2]}-${m[1]}` : ''
}

// Invoice numbers are typed differently on each side ("INV/0045" in the
// books, "INV-45" on the portal), so compare letters and digits only, upper
// case, with leading zeros dropped from each run of digits.
export function docKey(no: string): string {
  // Zeros first, while the separators still mark where each number starts
  return no.toUpperCase().replace(/(^|[^0-9])0+(?=[0-9])/g, '$1').replace(/[^A-Z0-9]/g, '')
}

// Taxes on a document: on the document itself (current layout) or summed
// from items[] (older layout). igst/iamt naming both accepted.
function amounts(o: Record<string, unknown>) {
  const pick = (x: Record<string, unknown>, a: string, b: string) => num(x[a] ?? x[b])
  const own = ['txval', 'igst', 'cgst', 'sgst', 'iamt', 'camt', 'samt'].some((k) => k in o)
  if (own) {
    return { taxable: num(o.txval), igst: pick(o, 'igst', 'iamt'), cgst: pick(o, 'cgst', 'camt'), sgst: pick(o, 'sgst', 'samt'), cess: pick(o, 'cess', 'csamt') }
  }
  const items = Array.isArray(o.items) ? (o.items as Record<string, unknown>[]) : Array.isArray(o.itms) ? (o.itms as Record<string, unknown>[]) : []
  const t = { taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 }
  for (const raw of items) {
    const it = (raw.itm_det as Record<string, unknown>) ?? raw
    t.taxable += num(it.txval)
    t.igst += pick(it, 'igst', 'iamt')
    t.cgst += pick(it, 'cgst', 'camt')
    t.sgst += pick(it, 'sgst', 'samt')
    t.cess += pick(it, 'cess', 'csamt')
  }
  return { taxable: r2(t.taxable), igst: r2(t.igst), cgst: r2(t.cgst), sgst: r2(t.sgst), cess: r2(t.cess) }
}

// The portal file wraps docdata in data{}; API responses nest it deeper.
function findRoot(o: unknown, depth = 0): Record<string, unknown> | null {
  if (!o || typeof o !== 'object' || depth > 5) return null
  const rec = o as Record<string, unknown>
  if (rec.docdata && typeof rec.docdata === 'object') return rec
  for (const k of ['data', 'Data']) {
    const found = findRoot(rec[k], depth + 1)
    if (found) return found
  }
  return null
}

const KNOWN = new Set(['b2b', 'b2ba', 'cdnr', 'cdnra'])

export function parse2b(text: string): TwoBFile {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('This file is not JSON. Download GSTR-2B from the GST portal with "Generate JSON file".')
  }
  const root = findRoot(json)
  if (!root) throw new Error('This JSON has no GSTR-2B document details (docdata). Is it a GSTR-2B download?')
  const period = portalPeriod(root.rtnprd)
  const docdata = root.docdata as Record<string, unknown>
  const docs: TwoBDoc[] = []
  const skipped: TwoBFile['skipped'] = []

  for (const [section, list] of Object.entries(docdata)) {
    if (!Array.isArray(list)) continue
    const key = section.toLowerCase()
    if (!KNOWN.has(key)) {
      if (list.length) skipped.push({ section: key, count: list.length })
      continue
    }
    const notes = key === 'cdnr' || key === 'cdnra'
    for (const sup of list as Record<string, unknown>[]) {
      const ctin = str(sup.ctin).toUpperCase()
      const name = str(sup.trdnm)
      const rows = (notes ? sup.nt : sup.inv) as Record<string, unknown>[] | undefined
      for (const d of rows ?? []) {
        const a = amounts(d)
        const typ = str(d.typ).toUpperCase()
        docs.push({
          section: key as TwoBDoc['section'],
          kind: notes ? (typ === 'D' ? 'debit_note' : 'credit_note') : 'invoice',
          ctin,
          name,
          no: str(notes ? d.ntnum : d.inum),
          originalNo: str(notes ? d.ontnum : d.oinum) || null,
          date: portalDate(d.dt),
          value: num(d.val),
          ...a,
          itcAvailable: str(d.itcavl).toUpperCase() !== 'N',
          reason: str(d.rsn) || null,
          reverseCharge: str(d.rev).toUpperCase() === 'Y',
          period,
        })
      }
    }
  }
  return { gstin: str(root.gstin).toUpperCase(), period, docs, skipped }
}

// Several months can be loaded together. An invoice amended in a later 2B
// (b2ba) replaces the earlier version of the same supplier + number.
export function combineInvoices(files: TwoBFile[]): TwoBDoc[] {
  const byKey = new Map<string, TwoBDoc>()
  const ordered = files.flatMap((f) => f.docs).filter((d) => d.kind === 'invoice')
    .sort((a, b) => a.period.localeCompare(b.period) || (a.section === 'b2ba' ? 1 : 0) - (b.section === 'b2ba' ? 1 : 0))
  for (const d of ordered) {
    if (d.originalNo) byKey.delete(`${d.ctin}|${docKey(d.originalNo)}`)
    byKey.set(`${d.ctin}|${docKey(d.no)}`, d)
  }
  return [...byKey.values()]
}

export function reconcile(invoices: TwoBDoc[], bills: BookBill[], booksFrom: string, booksTo: string): MatchRow[] {
  const pool = new Map<string, BookBill[]>()
  const bySupplier = new Map<string, BookBill[]>()
  for (const b of bills) {
    const gstin = (b.supplier_gstin ?? '').toUpperCase()
    if (!gstin) continue // unregistered supplier: no credit to reconcile
    const k = `${gstin}|${docKey(b.supplier_invoice_no)}`
    pool.set(k, [...(pool.get(k) ?? []), b])
    bySupplier.set(gstin, [...(bySupplier.get(gstin) ?? []), b])
  }
  const used = new Set<string>()
  const rows: MatchRow[] = []

  for (const d of invoices) {
    const bill = (pool.get(`${d.ctin}|${docKey(d.no)}`) ?? []).find((b) => !used.has(b.id)) ?? null
    if (bill) {
      used.add(bill.id)
      const diff = {
        taxable: r2(bill.taxable - d.taxable),
        igst: r2(bill.igst - d.igst),
        cgst: r2(bill.cgst - d.cgst),
        sgst: r2(bill.sgst - d.sgst),
      }
      const same = Object.values(diff).every((v) => Math.abs(v) <= TOLERANCE)
      rows.push({ status: same ? 'matched' : 'different', doc: d, bill, diff, suggestion: null })
    } else {
      rows.push({ status: 'only_2b', doc: d, bill: null, diff: null, suggestion: null })
    }
  }

  // Suggest a likely bill for each 2B invoice left over: same supplier, same
  // total, not matched to anything else (the number was typed differently).
  for (const row of rows) {
    if (row.status !== 'only_2b' || !row.doc) continue
    const d = row.doc
    const hit = (bySupplier.get(d.ctin) ?? []).find((b) => !used.has(b.id) && Math.abs(b.total - d.value) <= TOLERANCE)
    if (hit) row.suggestion = hit
  }

  for (const b of bills) {
    if (!b.supplier_gstin || used.has(b.id)) continue
    if (b.bill_date < booksFrom || b.bill_date > booksTo) continue
    rows.push({ status: 'only_books', doc: null, bill: b, diff: null, suggestion: null })
  }
  return rows
}

export type TwoBSummary = {
  credit2b: number          // credit available per 2B: invoices − credit notes + debit notes
  creditNotAvailable: number
  matched: number
  different: number
  only2b: number
  onlyBooks: number
  creditAtRisk: number      // tax on bills not in 2B
  creditDifference: number  // books − 2B tax on differing invoices
}

export function summarise(rows: MatchRow[], notes: TwoBDoc[]): TwoBSummary {
  const invoices = rows.filter((r) => r.doc).map((r) => r.doc!)
  const avail = (d: TwoBDoc) => (d.itcAvailable ? docTax(d) : 0)
  const noteSign = (d: TwoBDoc) => (d.kind === 'credit_note' ? -1 : 1)
  const count = (s: MatchStatus) => rows.filter((r) => r.status === s).length
  return {
    credit2b: r2(invoices.reduce((s, d) => s + avail(d), 0) + notes.reduce((s, d) => s + noteSign(d) * avail(d), 0)),
    creditNotAvailable: r2(invoices.reduce((s, d) => s + (d.itcAvailable ? 0 : docTax(d)), 0)),
    matched: count('matched'),
    different: count('different'),
    only2b: count('only_2b'),
    onlyBooks: count('only_books'),
    creditAtRisk: r2(rows.filter((r) => r.status === 'only_books').reduce((s, r) => s + billTax(r.bill!), 0)),
    creditDifference: r2(rows.filter((r) => r.status === 'different').reduce((s, r) => s + billTax(r.bill!) - (r.doc!.igst + r.doc!.cgst + r.doc!.sgst), 0)),
  }
}

// Calendar months covered by the loaded files, for the books side
export function periodRange(periods: string[]): { from: string; to: string } | null {
  const ok = periods.filter((p) => /^\d{4}-\d{2}$/.test(p)).sort()
  if (!ok.length) return null
  const [y, m] = ok[ok.length - 1].split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  return { from: `${ok[0]}-01`, to: last }
}
