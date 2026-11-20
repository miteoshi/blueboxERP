import type { PaymentMode } from '@/lib/hooks/use-finance'

// Expenses and other income are kept the same way: numbered entries under a
// head, never deleted, cancelled with a reason. These are the shapes the shared
// page works with, whichever of the two it is showing.

export type MoneyHead = { id: string; name: string; is_active: boolean }

export type MoneyEntry = {
  id: string
  no: string
  date: string
  head_id: string
  head_name: string | null
  party: string | null
  // What it cost: for an expense with TDS, the money paid plus the TDS
  amount: number
  // Money paid and TDS deducted, when the entry can carry TDS
  paid?: number
  tds?: number
  tds_code?: string | null
  mode: string
  reference: string | null
  notes: string | null
  status: string
  cancel_reason: string | null
  creator_name: string | null
}

export type RecordMoneyEntry = {
  headId: string
  amount: number
  mode: PaymentMode
  date?: string
  party?: string
  partyPan?: string
  reference?: string
  notes?: string
  // TDS deducted from the payee; amount is then the money paid
  tds?: { code: string; rate: number; base: number; amount: number }
}

export type RecordedMoneyEntry = { id: string; no: string; amount: number }

// A head to suggest for a bank-statement line, from words in its narration
export function suggestHead(heads: MoneyHead[], text: string, rules: [RegExp, RegExp][]): string {
  const active = heads.filter((h) => h.is_active)
  for (const [lineTest, headTest] of rules) {
    if (!lineTest.test(text)) continue
    const head = active.find((h) => headTest.test(h.name))
    if (head) return head.id
  }
  return active.find((h) => /^other$/i.test(h.name))?.id ?? ''
}

// Expense heads to suggest for money going out, and income heads for money coming in
export const EXPENSE_RULES: [RegExp, RegExp][] = [
  [/chrg|charge|fee|sms|amc|penal|commission|gst/i, /bank charges/i],
  [/interest|\bint\b/i, /interest|bank charges/i],
]
export const INCOME_RULES: [RegExp, RegExp][] = [
  [/interest|\bint\b|int\.?\s*(cr|pd|credit)/i, /interest/i],
  [/cashback|discount|rebate/i, /discount/i],
  [/scrap/i, /scrap/i],
  [/commission/i, /commission/i],
  [/\brent\b/i, /rent/i],
]
