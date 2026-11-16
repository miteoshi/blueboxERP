'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { WifiOff } from 'lucide-react'

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** Whether the browser currently has a connection. True on the server. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}

/**
 * Turns on offline use for the signed-in app and says so when the
 * connection is gone: what is on screen may be old, and nothing can be saved.
 */
export function OfflineSupport() {
  const online = useOnline()
  const pathname = usePathname()

  useEffect(() => {
    // Only the built app: in development the worker would serve stale code
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Offline support could not be turned on:', error)
    })
  }, [])

  // Tell the worker which page is on screen so it keeps a copy to reopen
  // with no connection. Moving between pages inside the app does not load
  // the page itself, so the worker would otherwise never see it.
  useEffect(() => {
    if (!online || !('serviceWorker' in navigator)) return
    let cancelled = false
    navigator.serviceWorker.ready
      .then((registration) => {
        if (!cancelled) registration.active?.postMessage({ type: 'save-page', pathname })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [pathname, online])

  if (online) return null

  return (
    <div
      role="status"
      className="sticky top-14 lg:top-0 z-20 flex items-start gap-2 bg-amber-100 border-b border-amber-200 px-4 py-2 text-sm text-amber-900"
    >
      <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
      <span>
        You&apos;re offline. This is what was last loaded on this device, so it may be out of date, and nothing can
        be saved until the connection is back.
      </span>
    </div>
  )
}
