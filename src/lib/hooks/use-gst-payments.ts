'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { useRequestId } from '@/lib/hooks/use-request-id'
import { allRows } from '@/lib/utils/all-rows'
import { isAlreadySaved, rpcFailure } from '@/lib/utils/rpc'
import type { PaymentMode } from '@/lib/hooks/use-finance'
import type { TaxHeads } from '@/lib/gst'
import type { GstHead } from '@/lib/gst-payments'

export type GstLedgerHead = { opening: number; output: number; input: number; paid: number; balance: number }

// Shape returned by gst_ledger(): a positive balance is still payable,
// a negative one is credit in hand
export type GstLedger =
  | { set: false; opening_as_of?: string; before_opening?: boolean }
  | {
      set: true
      as_of: string
      opening_as_of: string
      opening: { payable: TaxHeads; credit: TaxHeads }
      heads: Record<GstHead, GstLedgerHead>
      balance: number
      interest_and_late_fee: number
    }

export type GstOpening = {
  as_of: string
  payable_igst: number
  payable_cgst: number
  payable_sgst: number
  credit_igst: number
  credit_cgst: number
  credit_sgst: number
  updated_at: string
}

// Everything a challan or the opening position changes
const GST_PAYMENT_KEYS = [
  ['gst-ledger'],
  ['gst-opening'],
  ['gst-payments'],
  ['cash-book-gst'],
  ['money-balances'],
  ['profit-and-loss'],
  ['bank-book'],
  ['bank-reconciliation'],
  ['financial-position'],
] as const

function useInvalidateGstPayments() {
  const qc = useQueryClient()
  return () => Promise.all(GST_PAYMENT_KEYS.map((queryKey) => qc.invalidateQueries({ queryKey: [...queryKey] })))
}

export function useGstLedger(asOf: string, enabled = true) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['gst-ledger', orgId, asOf],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('gst_ledger', { p_as_of: asOf })
      if (error) throw rpcFailure(error, 'Could not work out the GST ledger')
      return data as unknown as GstLedger
    },
    enabled: !!orgId && enabled && !!asOf,
    staleTime: 60 * 1000,
  })
}

export function useGstOpening(enabled = true) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['gst-opening', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gst_openings')
        .select('as_of, payable_igst, payable_cgst, payable_sgst, credit_igst, credit_cgst, credit_sgst, updated_at')
        .maybeSingle()
      if (error) throw error
      return data as GstOpening | null
    },
    enabled: !!orgId && enabled,
    staleTime: 5 * 60 * 1000,
  })
}

// Challans dated in the period, cancelled ones included (shown struck through)
export function useGstPayments(from: string, to: string, enabled = true) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['gst-payments', orgId, from, to],
    queryFn: async () => {
      const { data, error } = await allRows(supabase
        .from('gst_payments')
        .select(`
          id, payment_no, payment_date, period, igst, cgst, sgst, interest, late_fee, amount,
          mode, reference, notes, status, cancel_reason, created_at,
          creator:profiles!gst_payments_created_by_fkey ( full_name )
        `)
        .gte('payment_date', from)
        .lte('payment_date', to)
        .order('payment_date')
        .order('created_at')
        .order('id'))
      if (error) throw error
      return data ?? []
    },
    enabled: !!orgId && enabled && !!from && !!to && from <= to,
    staleTime: 30 * 1000,
  })
}

export type GstPaymentRow = NonNullable<ReturnType<typeof useGstPayments>['data']>[number]

export function useSetGstOpening() {
  const supabase = createClient()
  const invalidate = useInvalidateGstPayments()
  return useMutation({
    mutationFn: async (input: { asOf: string; payable: TaxHeads; credit: TaxHeads }) => {
      const { data, error } = await supabase.rpc('set_gst_opening', {
        p_as_of: input.asOf,
        p_payable_igst: input.payable.igst,
        p_payable_cgst: input.payable.cgst,
        p_payable_sgst: input.payable.sgst,
        p_credit_igst: input.credit.igst,
        p_credit_cgst: input.credit.cgst,
        p_credit_sgst: input.credit.sgst,
      })
      if (error) throw rpcFailure(error, 'Could not save the GST opening position')
      return data as { as_of: string }
    },
    onSuccess: () => {
      invalidate()
      toast.success('GST opening position saved')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useRecordGstPayment() {
  const supabase = createClient()
  const invalidate = useInvalidateGstPayments()
  const requestId = useRequestId()

  return useMutation({
    mutationFn: async (input: TaxHeads & {
      paymentDate: string
      interest: number
      lateFee: number
      mode: PaymentMode
      period?: string
      reference?: string
      notes?: string
    }) => {
      const { data, error } = await supabase.rpc('record_gst_payment', {
        p_payment_date: input.paymentDate,
        p_igst: input.igst,
        p_cgst: input.cgst,
        p_sgst: input.sgst,
        p_interest: input.interest,
        p_late_fee: input.lateFee,
        p_mode: input.mode,
        p_period: input.period || undefined,
        p_reference: input.reference || undefined,
        p_notes: input.notes || undefined,
        p_request_id: requestId.get(),
      })
      if (error) throw rpcFailure(error, 'Could not record the GST payment')
      return data as { id: string; payment_no: string; amount: number }
    },
    onSuccess: (data) => {
      requestId.clear()
      invalidate()
      toast.success(`${data.payment_no} recorded`)
    },
    onError: (err: Error) => {
      toast.error(err.message)
      if (isAlreadySaved(err)) invalidate()
    },
  })
}

export function useCancelGstPayment() {
  const supabase = createClient()
  const invalidate = useInvalidateGstPayments()

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc('cancel_gst_payment', { p_payment_id: id, p_reason: reason })
      if (error) throw rpcFailure(error, 'Could not cancel the GST payment')
      return data as { payment_no: string }
    },
    onSuccess: (data) => {
      invalidate()
      toast.success(`${data.payment_no} cancelled`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
