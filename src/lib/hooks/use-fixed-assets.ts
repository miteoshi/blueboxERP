'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { allRows } from '@/lib/utils/all-rows'
import { rpcFailure } from '@/lib/utils/rpc'
import { formatCurrency } from '@/lib/utils/format'
import type { PaymentMode } from '@/lib/hooks/use-finance'
import type { DepreciationMethod } from '@/lib/fixed-assets'

// One asset from fixed_asset_register(): money figures are for the period
export type RegisterAsset = {
  id: string
  asset_no: string
  name: string
  category: string | null
  method: DepreciationMethod
  useful_life_years: number | null
  wdv_rate: number | null
  purchase_date: string
  cost: number
  salvage_value: number
  status: 'in_use' | 'disposed'
  disposed_on: string | null
  sale_amount: number | null
  opening: number
  addition: number
  depreciation: number
  disposal_value: number
  closing: number
  gain: number
}

export type FixedAssetRegister = {
  period: { from: string; to: string }
  assets: RegisterAsset[]
  totals: { opening: number; additions: number; depreciation: number; disposals: number; closing: number; gain: number; in_use: number }
}

// Everything an asset changes
const ASSET_KEYS = [
  ['fixed-asset-register'],
  ['fixed-assets'],
  ['cash-book-assets'],
  ['money-balances'],
  ['profit-and-loss'],
  ['bank-book'],
  ['bank-reconciliation'],
  ['financial-position'],
] as const

function useInvalidateAssets() {
  const qc = useQueryClient()
  return () => Promise.all(ASSET_KEYS.map((queryKey) => qc.invalidateQueries({ queryKey: [...queryKey] })))
}

export function useFixedAssetRegister(from: string, to: string, enabled = true) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['fixed-asset-register', orgId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fixed_asset_register', { p_from: from, p_to: to })
      if (error) throw rpcFailure(error, 'Could not work out the fixed asset register')
      return data as unknown as FixedAssetRegister
    },
    enabled: !!orgId && enabled && !!from && !!to && from <= to,
    staleTime: 60 * 1000,
  })
}

// Every asset with its full details (for editing, and those outside the period)
export function useFixedAssets(enabled = true) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['fixed-assets', orgId],
    queryFn: async () => {
      const { data, error } = await allRows(supabase
        .from('fixed_assets')
        .select(`
          id, asset_no, name, category, purchase_date, cost, salvage_value, method, useful_life_years, wdv_rate,
          pay_mode, pay_reference, status, disposed_on, sale_amount, sale_mode, sale_reference, notes, cancel_reason
        `)
        .order('purchase_date')
        .order('asset_no'))
      if (error) throw error
      return (data ?? []).map((a) => ({ ...a, method: a.method as DepreciationMethod }))
    },
    enabled: !!orgId && enabled,
    staleTime: 60 * 1000,
  })
}

export type FixedAsset = NonNullable<ReturnType<typeof useFixedAssets>['data']>[number]

export type SaveAssetInput = {
  id?: string
  name: string
  category: string
  purchaseDate: string
  cost: number
  salvage: number
  method: DepreciationMethod
  lifeYears: number | null
  wdvRate: number | null
  payMode: PaymentMode | 'none'
  payReference: string
  notes: string
}

export function useSaveFixedAsset() {
  const supabase = createClient()
  const invalidate = useInvalidateAssets()
  return useMutation({
    mutationFn: async (i: SaveAssetInput) => {
      const { data, error } = await supabase.rpc('save_fixed_asset', {
        p_name: i.name,
        p_purchase_date: i.purchaseDate,
        p_cost: i.cost,
        p_method: i.method,
        p_useful_life_years: i.method === 'slm' ? (i.lifeYears ?? undefined) : undefined,
        p_wdv_rate: i.method === 'wdv' ? (i.wdvRate ?? undefined) : undefined,
        p_salvage_value: i.salvage,
        p_pay_mode: i.payMode,
        p_pay_reference: i.payReference || undefined,
        p_category: i.category || undefined,
        p_notes: i.notes || undefined,
        p_id: i.id,
      })
      if (error) throw rpcFailure(error, 'Could not save the asset')
      return data as { id: string; asset_no: string }
    },
    onSuccess: (d, i) => {
      invalidate()
      toast.success(i.id ? `${d.asset_no} saved` : `${d.asset_no} added`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDisposeFixedAsset() {
  const supabase = createClient()
  const invalidate = useInvalidateAssets()
  return useMutation({
    mutationFn: async (i: { id: string; disposedOn: string; saleAmount: number; saleMode?: PaymentMode; saleReference?: string }) => {
      const { data, error } = await supabase.rpc('dispose_fixed_asset', {
        p_id: i.id,
        p_disposed_on: i.disposedOn,
        p_sale_amount: i.saleAmount,
        p_sale_mode: i.saleAmount > 0 ? i.saleMode : undefined,
        p_sale_reference: i.saleReference || undefined,
      })
      if (error) throw rpcFailure(error, 'Could not record the sale')
      return data as { asset_no: string; book_value: number; gain: number }
    },
    onSuccess: (d) => {
      invalidate()
      const gain = Number(d.gain)
      toast.success(
        `${d.asset_no} recorded — ${gain > 0 ? `profit of ${formatCurrency(gain)}` : gain < 0 ? `loss of ${formatCurrency(-gain)}` : 'no profit or loss'} on its book value`
      )
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUndoAssetDisposal() {
  const supabase = createClient()
  const invalidate = useInvalidateAssets()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc('undo_asset_disposal', { p_id: id, p_reason: reason })
      if (error) throw rpcFailure(error, 'Could not undo the sale')
      return data as { asset_no: string }
    },
    onSuccess: (d) => {
      invalidate()
      toast.success(`${d.asset_no} is back in use`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useCancelFixedAsset() {
  const supabase = createClient()
  const invalidate = useInvalidateAssets()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc('cancel_fixed_asset', { p_id: id, p_reason: reason })
      if (error) throw rpcFailure(error, 'Could not cancel the asset')
      return data as { asset_no: string }
    },
    onSuccess: (d) => {
      invalidate()
      toast.success(`${d.asset_no} cancelled`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
