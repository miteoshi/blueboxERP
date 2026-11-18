import * as XLSX from 'xlsx'

// ── Reading a bank statement ──────────────────────────────────
// Indian banks export statements with a few lines of account details above
// the real header, dates written day first, and either separate withdrawal /
// deposit columns or one amount column with a Dr/Cr marker. Everything here
// copes with those layouts without guessing a US-style date.

export type Cell = string | number | Date | null

export type ColumnMap = {
  date: number | null
  description: number | null
  reference: number | null
  withdrawal: number | null
  deposit: number | null
  amount: number | null
  drcr: number | null
  balance: number | null
}

export type StatementLine = {
  row: number // 1-based row in the file
  date: string // ISO
  description: string
  reference: string
  deposit: number
  withdrawal: number
  balance: number | null
}

export const EMPTY_MAP: ColumnMap = {
  date: null,
  description: null,
  reference: null,
  withdrawal: null,
  deposit: null,
  amount: null,
  drcr: null,
  balance: null,
}

// The whole first sheet as rows of cells. CSV is read as text so dates stay
// as the bank wrote them; Excel dates come through as dates.
export async function readStatementGrid(file: File): Promise<Cell[][]> {
  const isText = /\.(csv|txt)$/i.test(file.name) || file.type === 'text/csv'
  const workbook = isText
    ? XLSX.read(await file.text(), { type: 'string', raw: true })
    : XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? '']
  if (!sheet) return []
  const rows = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, raw: true, defval: null, blankrows: true })
  return rows.map((r) => r.map((c) => (typeof c === 'string' ? c.trim() : c)))
}

const text = (c: Cell) => (c === null || c === undefined ? '' : c instanceof Date ? '' : String(c).trim())

// Header cell tests, most specific first; each column is used once
const HEADER_TESTS: [keyof ColumnMap, RegExp][] = [
  ['drcr', /^(dr\s*\/\s*cr|cr\s*\/\s*dr|debit\s*\/\s*credit|credit\s*\/\s*debit|type|txn\s*type|transaction\s*type|cr\/dr\s*indicator)$/i],
  ['balance', /bal(ance)?\b/i],
  ['withdrawal', /withdraw|debit|^dr\.?$|^dr\b|paid\s*out/i],
  ['deposit', /deposit|credit|^cr\.?$|^cr\b|paid\s*in/i],
  ['amount', /^(txn\s*|transaction\s*)?amount|^amt\b/i],
  ['reference', /chq|cheque|ref|utr/i],
  ['description', /narration|description|particulars|remarks|details/i],
]
const DATE_HEADER = /date|\bdt\b/i
// "Dr / Cr" style markers are never a withdrawal or deposit amount column
const MARKER_HEADER = /(dr|debit)\s*\/\s*(cr|credit)|(cr|credit)\s*\/\s*(dr|debit)/i
const VALUE_DATE_HEADER = /value/i

// Finds the header row and which column holds what
export function detectColumns(grid: Cell[][]): { headerRow: number; map: ColumnMap } | null {
  for (let i = 0; i < Math.min(grid.length, 40); i++) {
    const cells = grid[i].map(text)
    const map: ColumnMap = { ...EMPTY_MAP }
    const used = new Set<number>()

    // The transaction date, not the value date, unless that is all there is
    const dates = cells.map((c, j) => [c, j] as const).filter(([c]) => DATE_HEADER.test(c))
    const txnDate = dates.find(([c]) => !VALUE_DATE_HEADER.test(c)) ?? dates[0]
    if (!txnDate) continue
    map.date = txnDate[1]
    used.add(txnDate[1])
    for (const [, j] of dates) used.add(j)

    for (const [field, test] of HEADER_TESTS) {
      const j = cells.findIndex(
        (c, k) =>
          !used.has(k) && c !== '' && test.test(c) && !((field === 'withdrawal' || field === 'deposit') && MARKER_HEADER.test(c))
      )
      if (j >= 0) {
        map[field] = j
        used.add(j)
      }
    }
    const hasAmounts = (map.withdrawal !== null && map.deposit !== null) || map.amount !== null
    if (hasAmounts) return { headerRow: i, map }
  }
  return null
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const pad = (n: number) => String(n).padStart(2, '0')

function isoFrom(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCMonth() !== m - 1) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

// Day-first dates as Indian banks write them; Excel dates as given
export function parseStatementDate(c: Cell): string | null {
  if (c instanceof Date) {
    if (Number.isNaN(c.getTime())) return null
    // Spreadsheet dates can land a few seconds before midnight; take the nearest day
    const midnight = new Date(c.getFullYear(), c.getMonth(), c.getDate())
    const day = c.getTime() - midnight.getTime() > 12 * 3600 * 1000 ? new Date(midnight.getTime() + 36 * 3600 * 1000) : midnight
    return isoFrom(day.getFullYear(), day.getMonth() + 1, day.getDate())
  }
  const s = text(c)
  if (!s) return null
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return isoFrom(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})\b/)
  if (m) return isoFrom(+m[3], +m[2], +m[1])
  m = s.match(/^(\d{1,2})[\s\-/]?([a-z]{3})[a-z]*[\s\-/,]*(\d{2}|\d{4})\b/i)
  if (m) {
    const month = MONTHS.indexOf(m[2].toLowerCase()) + 1
    return month ? isoFrom(+m[3], month, +m[1]) : null
  }
  return null
}

// "1,23,456.50", "1234.5 Cr", "(500.00)", "₹ 1,000" — sign kept for brackets and minus
export function parseStatementAmount(c: Cell): number | null {
  if (typeof c === 'number') return Number.isFinite(c) ? c : null
  const s = text(c)
  if (!s) return null
  const negative = /^\(.*\)$/.test(s) || /^-/.test(s)
  const cleaned = s.replace(/[₹,\s()]/g, '').replace(/(dr|cr)\.?$/i, '').replace(/^-/, '').replace(/^(inr|rs\.?)/i, '')
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null
  const n = Number(cleaned)
  return negative ? -n : n
}

const toPaise = (n: number) => Math.round(n * 100)

// Statement rows with a date and money moving; opening-balance and total rows drop out
export function readStatementLines(grid: Cell[][], headerRow: number, map: ColumnMap): StatementLine[] {
  const lines: StatementLine[] = []
  if (map.date === null) return lines
  for (let i = headerRow + 1; i < grid.length; i++) {
    const r = grid[i]
    const date = parseStatementDate(r[map.date] ?? null)
    if (!date) continue
    let deposit = 0
    let withdrawal = 0
    if (map.withdrawal !== null && map.deposit !== null) {
      withdrawal = Math.abs(map.withdrawal !== null ? parseStatementAmount(r[map.withdrawal] ?? null) ?? 0 : 0)
      deposit = Math.abs(map.deposit !== null ? parseStatementAmount(r[map.deposit] ?? null) ?? 0 : 0)
    } else if (map.amount !== null) {
      const raw = r[map.amount] ?? null
      const amount = parseStatementAmount(raw)
      if (amount === null) continue
      const marker = (map.drcr !== null ? text(r[map.drcr] ?? null) : '') || (text(raw).match(/(dr|cr)\.?$/i)?.[1] ?? '')
      const isDebit = /^(d|dr|debit|w|withdrawal)/i.test(marker) || (!marker && amount < 0)
      if (isDebit) withdrawal = Math.abs(amount)
      else deposit = Math.abs(amount)
    }
    if (toPaise(deposit) === 0 && toPaise(withdrawal) === 0) continue
    lines.push({
      row: i + 1,
      date,
      description: map.description !== null ? text(r[map.description] ?? null) : '',
      reference: map.reference !== null ? text(r[map.reference] ?? null) : '',
      deposit: toPaise(deposit) / 100,
      withdrawal: toPaise(withdrawal) / 100,
      balance: map.balance !== null ? parseStatementAmount(r[map.balance] ?? null) : null,
    })
  }
  return lines
}

// The balance at the end of the statement, whichever way round the bank lists it
export function closingBalance(lines: StatementLine[]): { date: string; balance: number } | null {
  const withBalance = lines.filter((l) => l.balance !== null)
  if (withBalance.length === 0) return null
  const descending = withBalance.length > 1 && withBalance[0].date > withBalance[withBalance.length - 1].date
  const last = descending ? withBalance[0] : withBalance[withBalance.length - 1]
  return { date: last.date, balance: last.balance as number }
}

// ── Matching statement lines to entries in the app ────────────

export type MatchEntry = {
  kind: string
  doc_id: string
  doc_no: string
  doc_date: string
  reference: string | null
  deposit: number
  withdrawal: number
  bank_date: string | null
}

export type Confidence = 'reference' | 'amount' | 'check'

export type StatementMatch<E extends MatchEntry> = { line: StatementLine; entry: E; confidence: Confidence; days: number }

export type MatchResult<E extends MatchEntry> = {
  matches: StatementMatch<E>[]
  alreadyTicked: { line: StatementLine; entry: E }[]
  bankOnly: StatementLine[]
}

const MAX_DAYS = 90
const dayNo = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000

// Cheque numbers, UTRs and similar codes in an entry's reference
export function referenceTokens(reference: string | null): string[] {
  if (!reference) return []
  return (reference.toUpperCase().match(/[A-Z0-9]+/g) ?? []).filter((t) => (/^\d+$/.test(t) ? t.replace(/^0+/, '').length >= 3 : t.length >= 6 && /\d/.test(t)))
}

function referenceMatches(tokens: string[], line: StatementLine): boolean {
  if (tokens.length === 0) return false
  const hay = `${line.reference} ${line.description}`.toUpperCase()
  const hayTokens = hay.match(/[A-Z0-9]+/g) ?? []
  return tokens.some((t) => {
    if (/^\d+$/.test(t)) {
      const n = t.replace(/^0+/, '')
      // Cheque numbers are often zero-padded differently; UTR digits may sit inside a longer code
      return hayTokens.some((h) => h.replace(/^0+/, '') === n || (n.length >= 8 && h.includes(n)))
    }
    return hay.includes(t)
  })
}

const sameSide = (line: StatementLine, e: MatchEntry) =>
  line.deposit > 0
    ? toPaise(line.deposit) === toPaise(Number(e.deposit)) && Number(e.deposit) > 0
    : toPaise(line.withdrawal) === toPaise(Number(e.withdrawal)) && Number(e.withdrawal) > 0

export function matchStatement<E extends MatchEntry>(lines: StatementLine[], entries: E[]): MatchResult<E> {
  const alreadyTicked: { line: StatementLine; entry: E }[] = []
  const usedLines = new Set<StatementLine>()
  const usedEntries = new Set<E>()

  // Lines for entries already given a bank date (that day first, then within a few days) are done
  for (const slack of [0, 3]) {
    for (const line of lines) {
      if (usedLines.has(line)) continue
      const e = entries.find(
        (x) => !usedEntries.has(x) && x.bank_date && Math.abs(dayNo(x.bank_date) - dayNo(line.date)) <= slack && sameSide(line, x)
      )
      if (e) {
        alreadyTicked.push({ line, entry: e })
        usedLines.add(line)
        usedEntries.add(e)
      }
    }
  }

  const open = entries.filter((e) => !e.bank_date && !usedEntries.has(e))
  const tokens = new Map(open.map((e) => [e, referenceTokens(e.reference)]))
  type Pair = { line: StatementLine; entry: E; ref: boolean; days: number }
  const pairs: Pair[] = []
  for (const line of lines) {
    if (usedLines.has(line)) continue
    for (const entry of open) {
      if (!sameSide(line, entry)) continue
      const days = dayNo(line.date) - dayNo(entry.doc_date)
      if (days < 0 || days > MAX_DAYS) continue
      pairs.push({ line, entry, ref: referenceMatches(tokens.get(entry) ?? [], line), days })
    }
  }

  const linePairs = new Map<StatementLine, number>()
  const entryPairs = new Map<E, number>()
  for (const p of pairs) {
    linePairs.set(p.line, (linePairs.get(p.line) ?? 0) + 1)
    entryPairs.set(p.entry, (entryPairs.get(p.entry) ?? 0) + 1)
  }

  const matches: StatementMatch<E>[] = []
  const take = (p: Pair) => {
    usedLines.add(p.line)
    usedEntries.add(p.entry)
    const unique = linePairs.get(p.line) === 1 && entryPairs.get(p.entry) === 1
    matches.push({ line: p.line, entry: p.entry, days: p.days, confidence: p.ref ? 'reference' : unique ? 'amount' : 'check' })
  }

  // A cheque number or UTR on both sides settles it, closest dates first
  for (const p of pairs.filter((x) => x.ref).sort((a, b) => a.days - b.days || a.line.row - b.line.row)) {
    if (!usedLines.has(p.line) && !usedEntries.has(p.entry)) take(p)
  }
  // Otherwise by amount, in order: the earliest bank line takes the earliest entry
  const byLine = [...pairs].sort(
    (a, b) => a.line.date.localeCompare(b.line.date) || a.line.row - b.line.row || a.entry.doc_date.localeCompare(b.entry.doc_date)
  )
  for (const p of byLine) {
    if (!usedLines.has(p.line) && !usedEntries.has(p.entry)) take(p)
  }

  matches.sort((a, b) => a.line.date.localeCompare(b.line.date) || a.line.row - b.line.row)
  return { matches, alreadyTicked, bankOnly: lines.filter((l) => !usedLines.has(l)) }
}
