'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { rpcFailure } from '@/lib/utils/rpc'
import type { ReminderChannel } from '@/lib/reminder'

export type LastReminder = {
  client_id: string
  sent_at: string
  channel: ReminderChannel
  overdue_amount: number
  invoices: number
  sent_by_name: string | null
  last_30_days: number
}

// The latest payment reminder per customer, keyed by customer. A plain
// object, not a Map: the query cache is persisted as JSON.
export function useLastPaymentReminders() {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['payment-reminders', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_last_payment_reminders')
        .select('client_id, sent_at, channel, overdue_amount, invoices, sent_by_name, last_30_days')
      if (error) throw error
      const byClient: Record<string, LastReminder> = {}
      for (const r of data ?? []) if (r.client_id && r.sent_at) byClient[r.client_id] = r as LastReminder
      return byClient
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,
  })
}

// Records that a reminder went out. The reminder itself has already left
// (WhatsApp, mail or clipboard), so a failure here only warns.
export function useLogPaymentReminder() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { clientId: string; channel: ReminderChannel; overdueAmount: number; invoices: number }) => {
      const { error } = await supabase.rpc('log_payment_reminder', {
        p_client_id: v.clientId,
        p_channel: v.channel,
        p_overdue_amount: v.overdueAmount,
        p_invoices: v.invoices,
      })
      if (error) throw rpcFailure(error, 'Could not record the reminder')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-reminders'] }),
    onError: (err: Error) => toast.error(`${err.message}. The reminder itself was not affected.`),
  })
}
