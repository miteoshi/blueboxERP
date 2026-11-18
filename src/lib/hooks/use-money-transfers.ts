'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { useRequestId } from '@/lib/hooks/use-request-id'
import { allRows } from '@/lib/utils/all-rows'
import { isAlreadySaved, rpcFailure } from '@/lib/utils/rpc'

// cash_to_bank: cash deposited in the bank; bank_to_cash: cash drawn from it
export type TransferDirection = 'cash_to_bank' | 'bank_to_cash'

export const TRANSFER_LABEL: Record<TransferDirection, string> = {
  cash_to_bank: 'Cash deposited in bank',
  bank_to_cash: 'Cash drawn from bank',
}

// Everything a transfer changes, so recording or cancelling one refreshes all of it
const TRANSFER_KEYS = [['money-transfers'], ['money-balances'], ['bank-book'], ['bank-reconciliation'], ['financial-position']] as const

function useInvalidateTransfers() {
  const qc = useQueryClient()
  return () => Promise.all(TRANSFER_KEYS.map((queryKey) => qc.invalidateQueries({ queryKey: [...queryKey] })))
}

// Transfers dated in the period, cancelled ones included (shown struck through)
export function useMoneyTransfers(from: string, to: string) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['money-transfers', orgId, from, to],
    queryFn: async () => {
      const { data, error } = await allRows(supabase
        .from('money_transfers')
        .select(`
          id, transfer_no, transfer_date, direction, amount, reference, notes,
          status, cancel_reason, created_at,
          creator:profiles!money_transfers_created_by_fkey ( full_name )
        `)
        .gte('transfer_date', from)
        .lte('transfer_date', to)
        .order('transfer_date')
        .order('created_at')
        .order('id'))
      if (error) throw error
      return (data ?? []).map((t) => ({ ...t, direction: t.direction as TransferDirection }))
    },
    enabled: !!orgId && !!from && !!to && from <= to,
    staleTime: 30 * 1000,
  })
}

export function useRecordMoneyTransfer() {
  const supabase = createClient()
  const invalidate = useInvalidateTransfers()
  const requestId = useRequestId()

  return useMutation({
    mutationFn: async (input: {
      direction: TransferDirection
      amount: number
      transferDate?: string
      reference?: string
      notes?: string
    }) => {
      const { data, error } = await supabase.rpc('record_money_transfer', {
        p_direction: input.direction,
        p_amount: input.amount,
        p_transfer_date: input.transferDate || undefined,
        p_reference: input.reference || undefined,
        p_notes: input.notes || undefined,
        p_request_id: requestId.get(),
      })
      if (error) throw rpcFailure(error, 'Could not record the transfer')
      return data as { id: string; transfer_no: string; direction: TransferDirection; amount: number }
    },
    onSuccess: (data) => {
      requestId.clear()
      invalidate()
      toast.success(`${data.transfer_no} recorded`)
    },
    onError: (err: Error) => {
      toast.error(err.message)
      if (isAlreadySaved(err)) invalidate()
    },
  })
}

export function useCancelMoneyTransfer() {
  const supabase = createClient()
  const invalidate = useInvalidateTransfers()

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc('cancel_money_transfer', { p_transfer_id: id, p_reason: reason })
      if (error) throw rpcFailure(error, 'Could not cancel the transfer')
      return data as { transfer_no: string }
    },
    onSuccess: (data) => {
      invalidate()
      toast.success(`${data.transfer_no} cancelled`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
