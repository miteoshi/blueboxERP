'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { rpcFailure } from '@/lib/utils/rpc'

type Parties = { amount: number; parties: number }

// Shape returned by financial_position(); amounts are rupees, rounded to paise
export type FinancialPosition = {
  as_of: string
  cash: { set: boolean; amount: number | null; opening_as_of: string | null }
  bank: { set: boolean; amount: number | null; opening_as_of: string | null }
  receivables: Parties
  supplier_advances: Parties
  stock: { amount: number; items_without_cost: number; items_on_price_list: number; items_on_bom: number }
  payables: Parties
  customer_advances: Parties
  // GST ledger balance: positive is payable (owed), negative is credit in hand
  // (owned); null until a GST opening position is set on or before the day
  gst: { set: boolean; balance: number | null; opening_as_of: string | null }
  tds: { set: boolean; balance: number | null; opening_as_of: string | null }
  // Loans still owed (counted as owed) and owners' capital (shown, not counted)
  loans: { amount: number; accounts: number }
  capital: { amount: number; accounts: number }
  fixed_assets: { amount: number; assets: number }
  total_owned: number
  total_owed: number
  net_worth: number
}

export function useFinancialPosition(asOf: string, enabled = true) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['financial-position', orgId, asOf],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('financial_position', { p_as_of: asOf })
      if (error) throw rpcFailure(error, 'Could not work out the financial position')
      return data as unknown as FinancialPosition
    },
    enabled: !!orgId && enabled && !!asOf,
    staleTime: 60 * 1000,
  })
}
