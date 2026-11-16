'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { allRows } from '@/lib/utils/all-rows'
import type { StatementParty, StatementRow } from '@/lib/statement'

// Every customer or supplier, including ones no longer active — an
// account that has been closed can still carry a balance.
export function useStatementParties(party: StatementParty, enabled = true) {
  const supabase = createClient()
  const orgId = useOrgId()

  return useQuery({
    queryKey: ['statement-parties', party, orgId],
    queryFn: async () => {
      const { data, error } = await allRows(
        supabase
          .from(party === 'client' ? 'clients' : 'suppliers')
          .select('id, name, is_active')
          .order('name')
          .order('id')
      )
      if (error) throw error
      return data ?? []
    },
    enabled: !!orgId && enabled,
    staleTime: 2 * 60 * 1000,
  })
}

export function useStatement(party: StatementParty, partyId: string | null, from: string, to: string) {
  const supabase = createClient()
  const orgId = useOrgId()
  const validPeriod = !!from && !!to && from <= to

  return useQuery({
    queryKey: ['statement', party, partyId, from, to, orgId],
    queryFn: async (): Promise<StatementRow[]> => {
      if (!partyId) return []
      // A long account can run past the API's 1,000-row page, so read it page by page
      const { data, error } = await allRows<StatementRow>(
        party === 'client'
          ? supabase.rpc('client_statement', { p_client_id: partyId, p_from: from, p_to: to }).order('seq')
          : supabase.rpc('supplier_statement', { p_supplier_id: partyId, p_from: from, p_to: to }).order('seq')
      )
      if (error) throw new Error(error.message)
      return (data ?? []).map((r) => ({
        ...r,
        debit: Number(r.debit),
        credit: Number(r.credit),
        balance: Number(r.balance),
      }))
    },
    enabled: !!orgId && !!partyId && validPeriod,
    staleTime: 30 * 1000,
  })
}
