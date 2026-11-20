'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { useRequestId } from '@/lib/hooks/use-request-id'
import { allRows } from '@/lib/utils/all-rows'
import { isAlreadySaved, rpcFailure } from '@/lib/utils/rpc'
import type { PaymentMode } from '@/lib/hooks/use-finance'

export type TdsMonth = {
  period: string
  deducted: number
  deposited: number
  outstanding: number
  due_date: string
  overdue: boolean
}

// Shape returned by tds_ledger(): a positive balance is still to deposit
export type TdsLedger =
  | { set: false; as_of: string; opening_as_of: string }
  | {
      set: true
      as_of: string
      opening_as_of: string | null
      opening: number
      deducted: number
      deposited: number
      interest_and_late_fee: number
      balance: number
      months: TdsMonth[]
      codes: { code: string; deducted: number; base: number; payments: number }[]
    }

// Everything a deposit, the opening or a payment with TDS changes
const TDS_KEYS = [
  ['tds-ledger'],
  ['tds-opening'],
  ['tds-deposits'],
  ['tds-deductions'],
  ['cash-book-tds'],
  ['money-balances'],
  ['profit-and-loss'],
  ['bank-book'],
  ['bank-reconciliation'],
  ['financial-position'],
] as const

function useInvalidateTds() {
  const qc = useQueryClient()
  return () => Promise.all(TDS_KEYS.map((queryKey) => qc.invalidateQueries({ queryKey: [...queryKey] })))
}

export function useTdsLedger(asOf: string, enabled = true) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['tds-ledger', orgId, asOf],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('tds_ledger', { p_as_of: asOf })
      if (error) throw rpcFailure(error, 'Could not work out the TDS ledger')
      return data as unknown as TdsLedger
    },
    enabled: !!orgId && enabled && !!asOf,
    staleTime: 60 * 1000,
  })
}

export function useTdsOpening(enabled = true) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['tds-opening', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('tds_openings').select('as_of, amount, updated_at').maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!orgId && enabled,
    staleTime: 5 * 60 * 1000,
  })
}

// Challans dated in the period, cancelled ones included (shown struck through)
export function useTdsDeposits(from: string, to: string, enabled = true) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['tds-deposits', orgId, from, to],
    queryFn: async () => {
      const { data, error } = await allRows(supabase
        .from('tds_deposits')
        .select(`
          id, deposit_no, deposit_date, period, tds_code, tax, interest, late_fee, amount,
          mode, reference, notes, status, cancel_reason, created_at,
          creator:profiles!tds_deposits_created_by_fkey ( full_name )
        `)
        .gte('deposit_date', from)
        .lte('deposit_date', to)
        .order('deposit_date')
        .order('created_at')
        .order('id'))
      if (error) throw error
      return data ?? []
    },
    enabled: !!orgId && enabled && !!from && !!to && from <= to,
    staleTime: 30 * 1000,
  })
}

export type TdsDepositRow = NonNullable<ReturnType<typeof useTdsDeposits>['data']>[number]

// Payments that deducted TDS in the period: the register the quarterly return is made from
export function useTdsDeductions(from: string, to: string, enabled = true) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['tds-deductions', orgId, from, to],
    queryFn: async () => {
      const { data, error } = await allRows(supabase
        .from('supplier_payments')
        .select(`
          id, payment_no, payment_date, amount, tds_code, tds_rate, tds_base, tds_amount, gross_amount, mode, reference,
          supplier:suppliers ( id, name, pan, gst_number )
        `)
        .eq('status', 'active')
        .gt('tds_amount', 0)
        .gte('payment_date', from)
        .lte('payment_date', to)
        .order('payment_date')
        .order('payment_no')
        .order('id'))
      if (error) throw error
      return data ?? []
    },
    enabled: !!orgId && enabled && !!from && !!to && from <= to,
    staleTime: 30 * 1000,
  })
}

export type TdsDeductionRow = NonNullable<ReturnType<typeof useTdsDeductions>['data']>[number]

export function useSetTdsOpening() {
  const supabase = createClient()
  const invalidate = useInvalidateTds()
  return useMutation({
    mutationFn: async ({ asOf, amount }: { asOf: string; amount: number }) => {
      const { error } = await supabase.rpc('set_tds_opening', { p_as_of: asOf, p_amount: amount })
      if (error) throw rpcFailure(error, 'Could not save the TDS opening')
    },
    onSuccess: () => {
      invalidate()
      toast.success('TDS opening saved')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useRecordTdsDeposit() {
  const supabase = createClient()
  const invalidate = useInvalidateTds()
  const requestId = useRequestId()

  return useMutation({
    mutationFn: async (input: {
      depositDate: string
      period: string
      tax: number
      interest: number
      lateFee: number
      mode: PaymentMode
      code?: string
      reference?: string
      notes?: string
    }) => {
      const { data, error } = await supabase.rpc('record_tds_deposit', {
        p_deposit_date: input.depositDate,
        p_period: input.period,
        p_tax: input.tax,
        p_interest: input.interest,
        p_late_fee: input.lateFee,
        p_mode: input.mode,
        p_tds_code: input.code || undefined,
        p_reference: input.reference || undefined,
        p_notes: input.notes || undefined,
        p_request_id: requestId.get(),
      })
      if (error) throw rpcFailure(error, 'Could not record the TDS deposit')
      return data as { id: string; deposit_no: string; amount: number }
    },
    onSuccess: (data) => {
      requestId.clear()
      invalidate()
      toast.success(`${data.deposit_no} recorded`)
    },
    onError: (err: Error) => {
      toast.error(err.message)
      if (isAlreadySaved(err)) invalidate()
    },
  })
}

export function useCancelTdsDeposit() {
  const supabase = createClient()
  const invalidate = useInvalidateTds()

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc('cancel_tds_deposit', { p_deposit_id: id, p_reason: reason })
      if (error) throw rpcFailure(error, 'Could not cancel the TDS deposit')
      return data as { deposit_no: string }
    },
    onSuccess: (data) => {
      invalidate()
      toast.success(`${data.deposit_no} cancelled`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
