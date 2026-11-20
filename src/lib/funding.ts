// ─────────────────────────────────────────────────────────────
// Owner's capital and loans taken — pure helpers, no data access.
// Balances are worked out by funding_balances() in the database.
// ─────────────────────────────────────────────────────────────

export type FundingKind = 'capital' | 'loan'
export type FundingDirection = 'in' | 'out'

export const FUNDING_KIND_LABEL: Record<FundingKind, string> = {
  capital: "Owner's capital",
  loan: 'Loan taken',
}

const ENTRY_LABEL: Record<FundingKind, Record<FundingDirection, string>> = {
  capital: { in: 'Capital introduced', out: 'Drawings' },
  loan: { in: 'Loan received', out: 'Loan repayment' },
}

/** What an entry is, in words: "Capital introduced", "Drawings", "Loan received", "Loan repayment" */
export function fundingEntryLabel(kind: FundingKind, direction: FundingDirection): string {
  return ENTRY_LABEL[kind][direction]
}

/** The choices when recording an entry on an account of this kind */
export function fundingDirections(kind: FundingKind): { value: FundingDirection; title: string; hint: string }[] {
  return kind === 'capital'
    ? [
        { value: 'in', title: 'Capital introduced', hint: 'Money the owner puts into the business' },
        { value: 'out', title: 'Drawings', hint: 'Money the owner takes out for personal use' },
      ]
    : [
        { value: 'in', title: 'Loan received', hint: 'The lender pays money to the business' },
        { value: 'out', title: 'Repayment', hint: 'Principal back to the lender, with any interest' },
      ]
}

/** The first day an entry can be dated: movements on the opening day are part of the opening balance */
export function firstEntryDate(openingAsOf: string): string {
  const [y, m, d] = openingAsOf.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}
