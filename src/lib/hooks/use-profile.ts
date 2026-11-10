'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import type { Tables, Enums } from '@/lib/types/database'

export type Profile = Tables<'profiles'>
export type UserRole = Enums<'user_role'>

// Returns the current logged-in user's profile row.
// StaleTime is 0 so it always re-fetches on mount after a login/logout.
// The auth state listener below also invalidates it on any session change.
export function useProfile() {
  const supabase    = createClient()
  const queryClient = useQueryClient()
  const orgId = useOrgId()

  // ── Listen for auth state changes and immediately clear the cache ──
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        queryClient.removeQueries({ queryKey: ['profile'] })
        queryClient.removeQueries({ queryKey: ['tenant-context'] })
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        queryClient.invalidateQueries({ queryKey: ['profile'] })
        queryClient.invalidateQueries({ queryKey: ['tenant-context'] })
      }
    })
    return () => subscription.unsubscribe()
  }, [supabase, queryClient])

  return useQuery({
    queryKey: ['profile', orgId],
    queryFn: async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user || !orgId) return null

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (error) throw error
      return (data as Profile) ?? null
    },
    enabled: !!orgId,
    staleTime: 0,
  })
}

// Convenience hook — returns just the role
export function useRole(): UserRole | null {
  const { data } = useProfile()
  return data?.role ?? null
}

// Permission helpers
export function useCanApprove(): boolean {
  const role = useRole()
  return role === 'admin' || role === 'manager'
}

// Who may do what — mirrors the database (RLS write policies and the
// assert_my_role() checks in each workflow function). Keep in sync.
const PERMISSIONS = {
  manageItems: ['admin', 'manager', 'store'],          // items RLS
  manageMasterData: ['admin', 'manager'],              // categories, material types, units RLS
  manageClients: ['admin', 'manager', 'sales'],        // clients RLS
  manageSuppliers: ['admin', 'manager', 'store'],      // suppliers RLS
  manageWorkers: ['admin', 'manager'],                 // workers RLS, /api/admin/create-worker
  editBom: ['admin', 'manager', 'production'],         // bom RLS
  importBom: ['admin', 'manager'],                     // creates items (manageItems) and BOM lines (editBom)
  setPrices: ['admin', 'manager', 'store'],            // set_item_price()
  receiveGoods: ['admin', 'manager', 'store'],         // create_inbound_receipt()
  adjustStock: ['admin', 'manager', 'store'],          // adjust_inventory()
  createProduction: ['admin', 'manager'],              // create_production_order()
  sell: ['admin', 'manager', 'sales'],                 // create_quotation(), sales orders
  dispatch: ['admin', 'manager', 'store'],             // create_delivery_challan()
} as const satisfies Record<string, readonly UserRole[]>

export type Permission = keyof typeof PERMISSIONS

export function useCan(permission: Permission): boolean {
  const role = useRole()
  return role !== null && (PERMISSIONS[permission] as readonly UserRole[]).includes(role)
}

export function useCanSell(): boolean {
  return useCan('sell')
}

export function useCanDispatch(): boolean {
  return useCan('dispatch')
}

export function useIsAdmin(): boolean {
  return useRole() === 'admin'
}
// Matches create_sales_invoice() / record_customer_receipt()
export function useCanBill(): boolean {
  const role = useRole()
  return role === 'admin' || role === 'manager' || role === 'sales'
}

// Matches cancel_sales_invoice() / cancel_customer_receipt()
export function useCanManageFinance(): boolean {
  const role = useRole()
  return role === 'admin' || role === 'manager'
}

// Matches the RLS read policy on sales_invoices (production can't see finance)
export function useCanViewFinance(): boolean {
  const role = useRole()
  return role !== null && role !== 'production'
}
