import type { QueryClient } from '@tanstack/react-query'

// Reports that value stock: refresh them whenever stock moves
export const STOCK_REPORT_KEYS = [['stock-valuation'], ['profit-and-loss'], ['financial-position']] as const

export function invalidateStockReports(qc: QueryClient) {
  return Promise.all(STOCK_REPORT_KEYS.map((queryKey) => qc.invalidateQueries({ queryKey: [...queryKey] })))
}
