'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { rpcFailure } from '@/lib/utils/rpc'

export type BankEntryKind = 'receipt' | 'supplier_payment' | 'expense' | 'income' | 'gst_payment' | 'transfer'

export type BankEntry = {
  kind: BankEntryKind
  doc_id: string
  doc_no: string
  doc_date: string
  party: string
  detail: string | null
  mode: string
  reference: string | null
  deposit: number
  withdrawal: number
  bank_date: string | null
}

export type BankReconciliation =
  | { set: false }
  | {
      set: true
      as_of: string
      opening_as_of: string
      book_balance: number
      deposits_not_credited: { amount: number; entries: number }
      payments_not_cleared: { amount: number; entries: number }
      entries_in_bank: number
      bank_balance: number
    }

export const BANK_ENTRY_LABEL: Record<BankEntryKind, string> = {
  receipt: 'Receipt from customer',
  supplier_payment: 'Payment to supplier',
  expense: 'Expense',
  income: 'Other income',
  gst_payment: 'GST payment',
  transfer: 'Cash / bank transfer',
}

// Where each entry can be opened, when it has a page of its own
export function bankEntryHref(e: Pick<BankEntry, 'kind'>): string | null {
  switch (e.kind) {
    case 'receipt':
      return '/payments'
    case 'supplier_payment':
      return '/payables'
    case 'expense':
      return '/expenses'
    case 'income':
      return '/income'
    case 'gst_payment':
      return '/gst-payments'
    case 'transfer':
      return '/reports/cash-book'
    default:
      return null
  }
}

// Not in the bank on a day: no bank date yet, or one after that day
export const notInBank = (e: Pick<BankEntry, 'bank_date'>, asOf: string) => !e.bank_date || e.bank_date > asOf

export function useBankReconciliation(asOf: string) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['bank-reconciliation', orgId, asOf],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('bank_reconciliation', { p_as_of: asOf })
      if (error) throw rpcFailure(error, 'Could not load the bank reconciliation')
      return data as unknown as BankReconciliation
    },
    enabled: !!orgId && !!asOf,
    staleTime: 30 * 1000,
  })
}

export function useBankBook(from: string, to: string) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['bank-book', orgId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('bank_book', { p_from: from, p_to: to })
      if (error) throw rpcFailure(error, 'Could not load the bank entries')
      return (data ?? []).map((e) => ({
        ...e,
        kind: e.kind as BankEntryKind,
        deposit: Number(e.deposit),
        withdrawal: Number(e.withdrawal),
      })) as BankEntry[]
    },
    enabled: !!orgId && !!from && !!to && from <= to,
    staleTime: 30 * 1000,
  })
}

export function useSetBankDates() {
  const supabase = createClient()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (entries: { doc_type: BankEntryKind; doc_id: string; bank_date: string | null }[]) => {
      const { data, error } = await supabase.rpc('set_bank_dates', { p_entries: entries })
      if (error) throw rpcFailure(error, 'Could not save the bank dates')
      return data as { set: number; cleared: number }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['bank-book'] })
      qc.invalidateQueries({ queryKey: ['bank-reconciliation'] })
      const parts = [
        data.set ? `${data.set} marked in bank` : '',
        data.cleared ? `${data.cleared} bank date${data.cleared === 1 ? '' : 's'} cleared` : '',
      ].filter(Boolean)
      toast.success(parts.join(', ') || 'Saved')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
