'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { rpcFailure } from '@/lib/utils/rpc'
import { formatDate } from '@/lib/utils/format'

// The last day of the closed period; nothing dated on or before it can be
// added, changed or cancelled (enforced in the database)
export function useBooksLock() {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['books-lock', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('books_lock')
        .select('locked_until, reason, updated_at, updater:profiles!books_lock_updated_by_fkey ( full_name )')
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useSetBooksLock() {
  const supabase = createClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ lockedUntil, reason }: { lockedUntil: string | null; reason?: string }) => {
      const { data, error } = await supabase.rpc('set_books_lock', {
        p_locked_until: lockedUntil as string,
        p_reason: reason || undefined,
      })
      if (error) throw rpcFailure(error, 'Could not change the closed period')
      return data as { locked_until: string | null; previous: string | null }
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['books-lock'] })
      toast.success(d.locked_until ? `Books closed up to ${formatDate(d.locked_until)}` : 'Books reopened')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
