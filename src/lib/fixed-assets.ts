// ─────────────────────────────────────────────────────────────
// Fixed assets — pure helpers, no data access. Book values and
// depreciation are worked out by fixed_asset_value() and
// fixed_asset_register() in the database.
// ─────────────────────────────────────────────────────────────

export type DepreciationMethod = 'slm' | 'wdv'

export const METHOD_LABEL: Record<DepreciationMethod, string> = {
  slm: 'Straight line',
  wdv: 'Written-down value',
}

/** "Straight line over 5 years" / "WDV at 15% a year" */
export function describeMethod(a: { method: string; useful_life_years: number | null; wdv_rate: number | null }): string {
  if (a.method === 'slm') {
    const years = Number(a.useful_life_years)
    return `Straight line over ${years} ${years === 1 ? 'year' : 'years'}`
  }
  return `WDV at ${Number(a.wdv_rate)}% a year`
}

/**
 * Common categories with suggested figures to start from: the useful life in
 * Schedule II of the Companies Act, 2013 for straight line, and the usual
 * income-tax block rate for written-down value. Only suggestions — the
 * business's own policy decides.
 */
export const ASSET_CATEGORIES: { name: string; lifeYears: number; wdvRate: number }[] = [
  { name: 'Computers and printers', lifeYears: 3, wdvRate: 40 },
  { name: 'Furniture and fittings', lifeYears: 10, wdvRate: 10 },
  { name: 'Plant and machinery', lifeYears: 15, wdvRate: 15 },
  { name: 'Motor vehicles', lifeYears: 8, wdvRate: 15 },
  { name: 'Office equipment', lifeYears: 5, wdvRate: 15 },
  { name: 'Electrical installations', lifeYears: 10, wdvRate: 10 },
  { name: 'Factory buildings', lifeYears: 30, wdvRate: 10 },
]

export function categorySuggestion(name: string) {
  const key = name.trim().toLowerCase()
  return ASSET_CATEGORIES.find((c) => c.name.toLowerCase() === key) ?? null
}
