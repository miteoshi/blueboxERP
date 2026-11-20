// ─────────────────────────────────────────────────────────────
// Statement of account — wording and sums shared by the screen
// (/statements) and the printed copy (/api/pdf). No React and no
// Supabase client in here, so the server route can import it.
//
// Rows come from client_statement() / supplier_statement():
//   customer balance  > 0  the customer owes us        (shown "Dr")
//   supplier balance  > 0  we owe the supplier         (shown "Cr")
// ─────────────────────────────────────────────────────────────

export type StatementParty = 'client' | 'supplier'

export type StatementRow = {
  seq: number
  entry_date: string
  kind: string
  doc_id: string | null
  doc_no: string | null
  detail: string | null
  debit: number
  credit: number
  balance: number
}

const KIND_LABEL: Record<string, string> = {
  opening: 'Opening balance',
  invoice: 'Tax invoice',
  receipt: 'Receipt',
  credit_note: 'Credit note',
  bill: 'Supplier bill',
  payment: 'Payment',
  debit_note: 'Debit note',
  tds: 'TDS deducted',
}

const MODE_LABEL: Record<string, string> = {
  bank_transfer: 'Bank transfer',
  upi: 'UPI',
  cheque: 'Cheque',
  cash: 'Cash',
  card: 'Card',
  other: 'Other',
}

const CREDIT_REASON: Record<string, string> = {
  sales_return: 'Sales return',
  rate_difference: 'Rate difference',
  discount: 'Discount',
  deficiency: 'Deficiency in supply',
  other: 'Other',
}

const DEBIT_REASON: Record<string, string> = {
  purchase_return: 'Goods returned',
  rate_difference: 'Rate difference',
  discount: 'Discount agreed later',
  deficiency: 'Short or damaged',
  other: 'Other',
}

export const statementKindLabel = (kind: string) => KIND_LABEL[kind] ?? kind

// The second line under the document: how it was paid, why it was credited
export function statementDetail(row: Pick<StatementRow, 'kind' | 'detail'>): string {
  const detail = row.detail?.trim()
  if (!detail) return ''
  switch (row.kind) {
    case 'receipt':
    case 'payment': {
      // "mode · reference" — the reference is free text, so split once only
      const at = detail.indexOf(' · ')
      const mode = at === -1 ? detail : detail.slice(0, at)
      const reference = at === -1 ? '' : detail.slice(at + 3)
      return [MODE_LABEL[mode] ?? mode, reference].filter(Boolean).join(' · ')
    }
    case 'credit_note':
      return CREDIT_REASON[detail] ?? detail
    case 'debit_note':
      return DEBIT_REASON[detail] ?? detail
    case 'bill':
      return `Supplier invoice ${detail}`
    case 'tds':
      // "Code 1024 at 2% of 50000.00": the base as rupees
      return detail.replace(/ of (\d+(?:\.\d+)?)$/, (_, n: string) =>
        ` of ₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      )
    default:
      return detail
  }
}

// Where the document can be opened. Receipts and payments have no page of their own.
export function statementDocHref(row: Pick<StatementRow, 'kind' | 'doc_id'>): string | null {
  if (!row.doc_id) return null
  switch (row.kind) {
    case 'invoice':
      return `/invoices/${row.doc_id}`
    case 'credit_note':
      return `/credit-notes/${row.doc_id}`
    case 'bill':
      return `/supplier-bills/${row.doc_id}`
    case 'debit_note':
      return `/debit-notes/${row.doc_id}`
    default:
      return null
  }
}

// Ledger suffix an accountant expects next to a balance
export function balanceSide(party: StatementParty, balance: number): 'Dr' | 'Cr' | '' {
  if (Math.abs(balance) < 0.005) return ''
  const owedToUs = party === 'client' ? balance > 0 : balance < 0
  return owedToUs ? 'Dr' : 'Cr'
}

// The same balance in plain words
export function balanceMeaning(party: StatementParty, balance: number): string {
  if (Math.abs(balance) < 0.005) return 'Nothing owed either way'
  if (party === 'client') return balance > 0 ? 'They owe you' : 'Advance you hold for them'
  return balance > 0 ? 'You owe them' : 'Advance lying with them'
}

export function statementTotals(rows: StatementRow[]) {
  const opening = rows.find((r) => r.kind === 'opening')?.balance ?? 0
  const entries = rows.filter((r) => r.kind !== 'opening')
  const debit = entries.reduce((s, r) => s + Number(r.debit), 0)
  const credit = entries.reduce((s, r) => s + Number(r.credit), 0)
  const closing = rows.length ? Number(rows[rows.length - 1].balance) : 0
  return { opening: Number(opening), debit, credit, closing, count: entries.length }
}
