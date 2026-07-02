'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Tables, Enums } from '@/lib/types/database'

type Item = Tables<'items'>
type ItemCategory = Enums<'item_category'>

// ── All items ─────────────────────────────────────────────────
export function useItems(filters?: {
  category?: ItemCategory
  search?: string
  isActive?: boolean
}) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['items', filters],
    queryFn: async () => {
      let query = supabase
        .from('items')
        .select('*')
        .order('category')
        .order('item_code')

      if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive)
      } else {
        query = query.eq('is_active', true) // default: only active
      }

      if (filters?.category) {
        query = query.eq('category', filters.category)
      }

      if (filters?.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,item_code.ilike.%${filters.search}%,sub_category.ilike.%${filters.search}%`
        )
      }

      const { data, error } = await query
      if (error) throw error
      return data as Item[]
    },
    staleTime: 5 * 60 * 1000, // items change infrequently
  })
}

// ── Single item ───────────────────────────────────────────────
export function useItem(id: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['items', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('items')
        .select(`
          *,
          item_prices (
            id, purchase_rate, selling_rate,
            rate_unit, gst_percent,
            effective_from, effective_to, notes
          ),
          bom!bom_finished_item_id_fkey (
            id, qty_per_unit, unit, notes, is_active,
            component:items!bom_component_id_fkey (
              id, item_code, name, unit
            )
          )
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

// ── Update item ───────────────────────────────────────────────
export function useUpdateItem() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: Partial<Item>
    }) => {
      const { data, error } = await supabase
        .from('items')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['items'] })
      toast.success(`${data.name} updated`)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}