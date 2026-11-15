'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { allRows } from '@/lib/utils/all-rows'

export type CostBasis = 'purchases' | 'bom' | 'price list' | 'none'

export const COST_BASIS_LABEL: Record<CostBasis, string> = {
  purchases: 'Goods received',
  bom: 'Bill of material',
  'price list': 'Price list',
  none: 'No cost yet',
}

export const COST_BASIS_HINT: Record<CostBasis, string> = {
  purchases: 'Weighted average of every priced goods receipt for this item',
  bom: 'Components rolled up, using what each was bought for',
  'price list': 'The current purchase rate on the item, as nothing has been received yet',
  none: 'Receive goods against this item, or set a purchase rate on it',
}

export function useStockValuation() {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['stock-valuation', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data, error } = await allRows(supabase
        .from('v_stock_valuation')
        .select('*')
        .order('stock_value', { ascending: false })
        .order('item_id'))
      if (error) throw error
      return data
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,
  })
}
