'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'

// Shape returned by profit_and_loss(); amounts are rupees, rounded to paise
export type ProfitAndLoss = {
  period: { from: string; to: string }
  sales: { invoiced: number; invoices: number; credit_notes: number; notes: number; net: number }
  stock: {
    opening: number
    received: number
    returned_to_suppliers: number
    closing: number
    cost_of_goods_sold: number
    items_on_price_list: number
    items_on_bom: number
    items_without_cost: number
    items_without_cost_sample: string[]
  }
  gross_profit: number
  expenses: { head: string; amount: number; entries: number }[]
  expenses_total: number
  net_profit: number
}

export function useProfitAndLoss(from: string, to: string, enabled = true) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['profit-and-loss', orgId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('profit_and_loss', { p_from: from, p_to: to })
      if (error) throw new Error(error.message)
      return data as unknown as ProfitAndLoss
    },
    enabled: !!orgId && enabled && !!from && !!to && from <= to,
    staleTime: 60 * 1000,
  })
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/**
 * The period just before [from, to], of the same length. Whole months
 * (a month, a quarter, a financial year) step back by months, so November
 * compares with October rather than with the 30 days before it; any other
 * range steps back by its number of days.
 */
export function previousPeriod(from: string, to: string): { from: string; to: string } {
  const f = parse(from)
  const t = parse(to)
  const nextDay = new Date(t.getTime() + 86400000)
  const wholeMonths = f.getUTCDate() === 1 && nextDay.getUTCDate() === 1
  if (wholeMonths) {
    const months = (nextDay.getUTCFullYear() - f.getUTCFullYear()) * 12 + (nextDay.getUTCMonth() - f.getUTCMonth())
    return {
      from: iso(new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() - months, 1))),
      to: iso(new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), 0))),
    }
  }
  const days = Math.round((t.getTime() - f.getTime()) / 86400000) + 1
  return {
    from: iso(new Date(f.getTime() - days * 86400000)),
    to: iso(new Date(f.getTime() - 86400000)),
  }
}
