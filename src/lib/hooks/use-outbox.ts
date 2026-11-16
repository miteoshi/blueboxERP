'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTenant } from '@/lib/hooks/use-tenant'
import { discardFromOutbox, listOutbox, onOutboxChange, sendOutbox, type OutboxEntry } from '@/lib/offline/outbox'

/** The signed-in user's unsent saves on this device, and the means to send or drop them. */
export function useOutbox() {
  const { user } = useTenant()
  const userId = user?.id ?? null
  const queryClient = useQueryClient()
  const [entries, setEntries] = useState<OutboxEntry[]>([])
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const load = () => {
      listOutbox(userId)
        .then((list) => {
          if (!cancelled) setEntries(list)
        })
        .catch(() => {})
    }
    load()
    const stop = onOutboxChange(load)
    return () => {
      cancelled = true
      stop()
    }
  }, [userId])

  const send = useCallback(
    async (retryRefusedId?: string) => {
      if (!userId) return null
      setSending(true)
      try {
        const result = await sendOutbox(userId, retryRefusedId)
        // What was sent changed stock and documents on the server
        if (result && result.sent > 0) await queryClient.invalidateQueries()
        return result
      } finally {
        setSending(false)
      }
    },
    [userId, queryClient]
  )

  return {
    userId,
    // Nothing is shown for a user who is not signed in
    entries: userId ? entries : [],
    sending,
    send,
    discard: discardFromOutbox,
  }
}
