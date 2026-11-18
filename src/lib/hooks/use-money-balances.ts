'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { rpcFailure } from '@/lib/utils/rpc'

export type MoneyAccount = 'cash' | 'bank'

// One account's position from money_balances(): `start` is the balance at the
// end of the day before the period, `end` at the end of its last day; either
// is null when that day is before the opening date
export type MoneyPosition =
  | { set: false }
  | { set: true; as_of: string; opening_amount: number; start: number | null; end: number | null }

export type MoneyBalances = Record<MoneyAccount, MoneyPosition>

export function useMoneyBalances(from: string, to: string, enabled = true) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['money-balances', orgId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('money_balances', { p_from: from, p_to: to })
      if (error) throw new Error(error.message)
      return data as unknown as MoneyBalances
    },
    enabled: !!orgId && enabled && !!from && !!to && from <= to,
    staleTime: 30 * 1000,
  })
}

export function useSetMoneyOpening() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { account: MoneyAccount; asOf: string; amount: number }) => {
      const { data, error } = await supabase.rpc('set_money_opening', {
        p_account: input.account,
        p_as_of: input.asOf,
        p_amount: input.amount,
      })
      if (error) throw rpcFailure(error, 'Could not save the opening balance')
      return data as { account: MoneyAccount; as_of: string; amount: number }
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['money-balances'] })
      toast.success(`Opening ${d.account} balance saved`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
