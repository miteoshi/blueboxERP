'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Tables, TablesInsert, TablesUpdate, Enums } from '@/lib/types/database'

export type Profile = Tables<'profiles'>
export type UserRole = Enums<'user_role'>

// Returns the current logged-in user's profile row.
// staleTime is 0 so it always re-fetches on mount after a login/logout.
// The auth state listener below also invalidates it on any session change.
export function useProfile() {
  const supabase    = createClient()
  const queryClient = useQueryClient()

  // ── Listen for auth state changes and immediately clear the cache ──
  // This fires on: SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED
  // Without this, the previous user's profile sits in cache until staleTime expires.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // Invalidate forces an immediate re-fetch with the new session
        queryClient.invalidateQueries({ queryKey: ['profile'] })
      }
    })
    return () => subscription.unsubscribe()
  }, [supabase, queryClient])

  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error
      return data as Profile
    },
    // ── Drop staleTime to 0 ───────────────────────────────────────────
    // Previous value was 5 mins — that's what caused the stale profile
    // to persist after login. 0 means always re-fetch on mount, which is
    // fast (single row select) and safe since role rarely changes mid-session.
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

export function useCanWriteInventory(): boolean {
  const role = useRole()
  return role === 'admin' || role === 'store' || role === 'production'
}

export function useCanSell(): boolean {
  const role = useRole()
  return role === 'admin' || role === 'manager' || role === 'sales'
}

export function useIsAdmin(): boolean {
  return useRole() === 'admin'
}