'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { useRequestId } from '@/lib/hooks/use-request-id'
import { allRows } from '@/lib/utils/all-rows'
import { isAlreadySaved, rpcFailure } from '@/lib/utils/rpc'
import type { MoneyEntry, MoneyHead, RecordMoneyEntry, RecordedMoneyEntry } from '@/lib/money-entries'

// Everything that shows expenses, so a change refreshes all of it
const EXPENSE_KEYS = [['expense-heads'], ['expenses'], ['cash-book-expenses'], ['money-balances'], ['profit-and-loss'], ['bank-book'], ['bank-reconciliation'], ['financial-position'], ['tds-ledger'], ['tds-deductions']] as const

function useInvalidateExpenses() {
  const qc = useQueryClient()
  return () => Promise.all(EXPENSE_KEYS.map((queryKey) => qc.invalidateQueries({ queryKey: [...queryKey] })))
}

export function useExpenseHeads() {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['expense-heads', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_heads')
        .select('id, name, is_active')
        .order('name')
      if (error) throw error
      return data as MoneyHead[]
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  })
}

// Expenses dated in the period, cancelled ones included (the page shows them struck through)
export function useExpenses(from: string, to: string) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['expenses', orgId, from, to],
    queryFn: async () => {
      const { data, error } = await allRows(supabase
        .from('expenses')
        .select(`
          id, expense_no, expense_date, head_id, payee, amount, tds_amount, tds_code, cost, mode, reference, notes,
          status, cancel_reason, created_at,
          head:expense_heads ( name ),
          creator:profiles!expenses_created_by_fkey ( full_name )
        `)
        .gte('expense_date', from)
        .lte('expense_date', to)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id'))
      if (error) throw error
      return (data ?? []).map(
        (e): MoneyEntry => ({
          id: e.id,
          no: e.expense_no,
          date: e.expense_date,
          head_id: e.head_id,
          head_name: e.head?.name ?? null,
          party: e.payee,
          amount: Number(e.cost ?? e.amount),
          paid: Number(e.amount),
          tds: Number(e.tds_amount ?? 0),
          tds_code: e.tds_code,
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

export function useRecordExpense() {
  const supabase = createClient()
  const invalidate = useInvalidateExpenses()
  const requestId = useRequestId()

  return useMutation({
    mutationFn: async (input: RecordMoneyEntry): Promise<RecordedMoneyEntry> => {
      const { data, error } = await supabase.rpc('record_expense', {
        p_head_id: input.headId,
        p_amount: input.amount,
        p_mode: input.mode,
        p_expense_date: input.date || undefined,
        p_payee: input.party || undefined,
        p_reference: input.reference || undefined,
        p_notes: input.notes || undefined,
        p_request_id: requestId.get(),
        p_payee_pan: input.partyPan || undefined,
        p_tds_code: input.tds?.code,
        p_tds_rate: input.tds?.rate,
        p_tds_base: input.tds?.base,
        p_tds_amount: input.tds?.amount,
      })
      if (error) throw rpcFailure(error, 'Could not record the expense')
      const saved = data as { id: string; expense_no: string; amount: number }
      return { id: saved.id, no: saved.expense_no, amount: saved.amount }
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

export function useCancelExpense() {
  const supabase = createClient()
  const invalidate = useInvalidateExpenses()

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc('cancel_expense', { p_expense_id: id, p_reason: reason })
      if (error) throw rpcFailure(error, 'Could not cancel the expense')
      return { no: (data as { expense_no: string }).expense_no }
    },
    onSuccess: (data) => {
      invalidate()
      toast.success(`${data.no} cancelled`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useSaveExpenseHead() {
  const supabase = createClient()
  const invalidate = useInvalidateExpenses()

  return useMutation({
    mutationFn: async (input: { name: string; id?: string; isActive?: boolean }) => {
      const { data, error } = await supabase.rpc('save_expense_head', {
        p_name: input.name,
        p_id: input.id,
        p_is_active: input.isActive ?? true,
      })
      if (error) throw rpcFailure(error, 'Could not save the expense head')
      return data as { id: string; name: string; is_active: boolean }
    },
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast.error(err.message),
  })
}
