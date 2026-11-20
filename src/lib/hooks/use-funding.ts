'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { useRequestId } from '@/lib/hooks/use-request-id'
import { allRows } from '@/lib/utils/all-rows'
import { isAlreadySaved, rpcFailure } from '@/lib/utils/rpc'
import type { PaymentMode } from '@/lib/hooks/use-finance'
import type { FundingDirection, FundingKind } from '@/lib/funding'

// One account from funding_balances(); the figures are null when the day is
// before the account's opening date
export type FundingAccount = {
  id: string
  kind: FundingKind
  name: string
  is_active: boolean
  opening_as_of: string
  opening_balance: number
  started: boolean
  received: number | null
  paid_out: number | null
  interest: number | null
  balance: number | null
}

export type FundingBalances = {
  as_of: string
  accounts: FundingAccount[]
  capital: { amount: number; accounts: number }
  loans: { amount: number; accounts: number }
  not_started: number
}

// Everything an account or entry changes
const FUNDING_KEYS = [
  ['funding-balances'],
  ['funding-entries'],
  ['cash-book-funding'],
  ['money-balances'],
  ['profit-and-loss'],
  ['bank-book'],
  ['bank-reconciliation'],
  ['financial-position'],
] as const

function useInvalidateFunding() {
  const qc = useQueryClient()
  return () => Promise.all(FUNDING_KEYS.map((queryKey) => qc.invalidateQueries({ queryKey: [...queryKey] })))
}

export function useFundingBalances(asOf: string, enabled = true) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['funding-balances', orgId, asOf],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('funding_balances', { p_as_of: asOf })
      if (error) throw rpcFailure(error, 'Could not work out capital and loan balances')
      return data as unknown as FundingBalances
    },
    enabled: !!orgId && enabled && !!asOf,
    staleTime: 60 * 1000,
  })
}

// Entries dated in the period, cancelled ones included (shown struck through)
export function useFundingEntries(from: string, to: string, enabled = true) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['funding-entries', orgId, from, to],
    queryFn: async () => {
      const { data, error } = await allRows(supabase
        .from('funding_entries')
        .select(`
          id, entry_no, entry_date, direction, amount, interest, total, mode, reference, notes,
          status, cancel_reason, created_at, account_id,
          account:funding_accounts ( name, kind ),
          creator:profiles!funding_entries_created_by_fkey ( full_name )
        `)
        .gte('entry_date', from)
        .lte('entry_date', to)
        .order('entry_date')
        .order('created_at')
        .order('id'))
      if (error) throw error
      return (data ?? []).map((e) => ({
        ...e,
        direction: e.direction as FundingDirection,
        account: e.account ? { name: e.account.name, kind: e.account.kind as FundingKind } : null,
      }))
    },
    enabled: !!orgId && enabled && !!from && !!to && from <= to,
    staleTime: 30 * 1000,
  })
}

export type FundingEntryRow = NonNullable<ReturnType<typeof useFundingEntries>['data']>[number]

export function useSaveFundingAccount() {
  const supabase = createClient()
  const invalidate = useInvalidateFunding()
  return useMutation({
    mutationFn: async (input: {
      id?: string
      // Required on edits too: the database checks it has not changed
      kind: FundingKind
      name: string
      openingAsOf: string
      openingBalance: number
      notes?: string
      isActive?: boolean
    }) => {
      const { data, error } = await supabase.rpc('save_funding_account', {
        p_kind: input.kind,
        p_name: input.name,
        p_opening_as_of: input.openingAsOf,
        p_opening_balance: input.openingBalance,
        p_notes: input.notes || undefined,
        p_id: input.id,
        p_is_active: input.isActive ?? true,
      })
      if (error) throw rpcFailure(error, 'Could not save the account')
      return data as { id: string; name: string; kind: FundingKind }
    },
    onSuccess: (d, input) => {
      invalidate()
      toast.success(input.id ? `${d.name} saved` : `${d.name} added`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useRecordFundingEntry() {
  const supabase = createClient()
  const invalidate = useInvalidateFunding()
  const requestId = useRequestId()
  return useMutation({
    mutationFn: async (input: {
      accountId: string
      direction: FundingDirection
      amount: number
      interest: number
      entryDate: string
      mode: PaymentMode
      reference?: string
      notes?: string
    }) => {
      const { data, error } = await supabase.rpc('record_funding_entry', {
        p_account_id: input.accountId,
        p_direction: input.direction,
        p_amount: input.amount,
        p_interest: input.interest,
        p_entry_date: input.entryDate,
        p_mode: input.mode,
        p_reference: input.reference || undefined,
        p_notes: input.notes || undefined,
        p_request_id: requestId.get(),
      })
      if (error) throw rpcFailure(error, 'Could not record the entry')
      return data as { id: string; entry_no: string; total: number }
    },
    onSuccess: (data) => {
      requestId.clear()
      invalidate()
      toast.success(`${data.entry_no} recorded`)
    },
    onError: (err: Error) => {
      toast.error(err.message)
      if (isAlreadySaved(err)) invalidate()
    },
  })
}

export function useCancelFundingEntry() {
  const supabase = createClient()
  const invalidate = useInvalidateFunding()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc('cancel_funding_entry', { p_entry_id: id, p_reason: reason })
      if (error) throw rpcFailure(error, 'Could not cancel the entry')
      return data as { entry_no: string }
    },
    onSuccess: (data) => {
      invalidate()
      toast.success(`${data.entry_no} cancelled`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
