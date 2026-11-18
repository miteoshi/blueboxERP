'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { useRequestId } from '@/lib/hooks/use-request-id'
import { allRows } from '@/lib/utils/all-rows'
import { isAlreadySaved, rpcFailure } from '@/lib/utils/rpc'
import type { MoneyEntry, MoneyHead, RecordMoneyEntry, RecordedMoneyEntry } from '@/lib/money-entries'

// Everything that shows other income, so a change refreshes all of it
const INCOME_KEYS = [['income-heads'], ['other-income'], ['cash-book-income'], ['money-balances'], ['profit-and-loss'], ['bank-book'], ['bank-reconciliation'], ['financial-position']] as const

function useInvalidateIncome() {
  const qc = useQueryClient()
  return () => Promise.all(INCOME_KEYS.map((queryKey) => qc.invalidateQueries({ queryKey: [...queryKey] })))
}

export function useIncomeHeads() {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['income-heads', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('income_heads')
        .select('id, name, is_active')
        .order('name')
      if (error) throw error
      return data as MoneyHead[]
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  })
}

// Other income dated in the period, cancelled entries included (the page shows them struck through)
export function useOtherIncome(from: string, to: string) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['other-income', orgId, from, to],
    queryFn: async () => {
      const { data, error } = await allRows(supabase
        .from('other_income')
        .select(`
          id, income_no, income_date, head_id, received_from, amount, mode, reference, notes,
          status, cancel_reason, created_at,
          head:income_heads ( name ),
          creator:profiles!other_income_created_by_fkey ( full_name )
        `)
        .gte('income_date', from)
        .lte('income_date', to)
        .order('income_date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id'))
      if (error) throw error
      return (data ?? []).map(
        (e): MoneyEntry => ({
          id: e.id,
          no: e.income_no,
          date: e.income_date,
          head_id: e.head_id,
          head_name: e.head?.name ?? null,
          party: e.received_from,
          amount: Number(e.amount),
          mode: e.mode,
          reference: e.reference,
          notes: e.notes,
          status: e.status,
          cancel_reason: e.cancel_reason,
          creator_name: e.creator?.full_name ?? null,
        })
      )
    },
    enabled: !!orgId && !!from && !!to && from <= to,
    staleTime: 30 * 1000,
  })
}

export function useRecordOtherIncome() {
  const supabase = createClient()
  const invalidate = useInvalidateIncome()
  const requestId = useRequestId()

  return useMutation({
    mutationFn: async (input: RecordMoneyEntry): Promise<RecordedMoneyEntry> => {
      const { data, error } = await supabase.rpc('record_other_income', {
        p_head_id: input.headId,
        p_amount: input.amount,
        p_mode: input.mode,
        p_income_date: input.date || undefined,
        p_received_from: input.party || undefined,
        p_reference: input.reference || undefined,
        p_notes: input.notes || undefined,
        p_request_id: requestId.get(),
      })
      if (error) throw rpcFailure(error, 'Could not record the income')
      const saved = data as { id: string; income_no: string; amount: number }
      return { id: saved.id, no: saved.income_no, amount: saved.amount }
    },
    onSuccess: (data) => {
      requestId.clear()
      invalidate()
      toast.success(`${data.no} recorded`)
    },
    onError: (err: Error) => {
      toast.error(err.message)
      if (isAlreadySaved(err)) invalidate()
    },
  })
}

export function useCancelOtherIncome() {
  const supabase = createClient()
  const invalidate = useInvalidateIncome()

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc('cancel_other_income', { p_income_id: id, p_reason: reason })
      if (error) throw rpcFailure(error, 'Could not cancel the income entry')
      return { no: (data as { income_no: string }).income_no }
    },
    onSuccess: (data) => {
      invalidate()
      toast.success(`${data.no} cancelled`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useSaveIncomeHead() {
  const supabase = createClient()
  const invalidate = useInvalidateIncome()

  return useMutation({
    mutationFn: async (input: { name: string; id?: string; isActive?: boolean }) => {
      const { data, error } = await supabase.rpc('save_income_head', {
        p_name: input.name,
        p_id: input.id,
        p_is_active: input.isActive ?? true,
      })
      if (error) throw rpcFailure(error, 'Could not save the income head')
      return data as { id: string; name: string; is_active: boolean }
    },
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast.error(err.message),
  })
}
