'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import type { Tables } from '@/lib/types/database'
import { ilikeAny } from '@/lib/utils/search'
import { allRows } from '@/lib/utils/all-rows'

export type StockLevel = Tables<'v_stock_levels'>
// ── All stock levels ──────────────────────────────────────────
export function useStockLevels(search?: string) {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
      queryKey: ['stock-levels', orgId, search],
      queryFn: async () => {
        if (!orgId) return []

        let query = supabase
        .from('v_stock_levels')
        .select('*')
        .order('category_id')
        .order('name')

      if (search) {
        query = query.or(ilikeAny(['name', 'item_code'], search))
      }

      const { data, error } = await allRows(query.order('item_id'))
      if (error) throw error
      return data as StockLevel[]
    },
    enabled: !!orgId,
    staleTime: 30 * 1000, // 30 seconds — stock changes frequently
    refetchInterval: 60 * 1000, // auto-refetch every minute
  })
}

// ── Reorder alerts ────────────────────────────────────────────
export function useReorderAlerts() {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['reorder-alerts', orgId],
    queryFn: async () => {
      if (!orgId) return []

      const { data, error } = await allRows(supabase
        .from('v_reorder_alerts')
        .select('*')
        .order('qty_available', { ascending: true })
        .order('item_id'))
      if (error) throw error
      return data as StockLevel[]
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000, // check every 5 minutes
  })
}