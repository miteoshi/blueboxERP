'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'

export type SetupGapRecord = { id: string; name: string; state?: string | null; code?: string | null }

/**
 * What is still missing before tax invoices can be raised. The same checks
 * create_sales_invoice enforces, read up front instead of on save.
 */
export function useSetupReadiness() {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['setup-readiness', orgId],
    queryFn: async () => {
      if (!orgId) return null
      const { data, error } = await supabase.from('v_setup_readiness').select('*').maybeSingle()
      if (error) throw error
      if (!data) return null
      const asRecords = (v: unknown): SetupGapRecord[] => (Array.isArray(v) ? (v as SetupGapRecord[]) : [])
      return {
        ...data,
        clients: asRecords(data.clients_missing_state_sample),
        items: asRecords(data.items_missing_hsn_sample),
      }
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  })
}
