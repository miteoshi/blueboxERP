'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import type { Tables} from '@/lib/types/database'
import { ilikeAny } from '@/lib/utils/search'
import { allRows } from '@/lib/utils/all-rows'

type Item = Tables<'items'>


// ── Item categories ──────────────────────────────────────────
export function useItemCategories() {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['item-categories', orgId],
    queryFn: async () => {
      if (!orgId) return []

      const { data, error } = await supabase
        .from('item_categories')
        .select('id, code, name, description, is_active')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      return data
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  })
}




// ── All items ─────────────────────────────────────────────────
export function useItems(filters?: {
  categoryId?: string
  search?: string
  isActive?: boolean
}) {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['items', orgId, filters],
    queryFn: async () => {
      if (!orgId) return []

      let query = supabase
        .from('items')
        .select('*')
        .order('category_id')
        .order('item_code')

      if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive)
      } else {
        query = query.eq('is_active', true) // default: only active
      }

      if (filters?.categoryId) {
        query = query.eq('category_id', filters.categoryId)
      }

      if (filters?.search) {
        query = query.or(ilikeAny(['name', 'item_code', 'sub_category'], filters.search))
      }

      const { data, error } = await allRows(query.order('id'))
      if (error) throw error
      return data as Item[]
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // items change infrequently
  })
}
