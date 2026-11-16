'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, CloudUpload, WifiOff } from 'lucide-react'
import { useOutbox } from '@/lib/hooks/use-outbox'
import { OUTBOX_KIND_LABEL } from '@/lib/offline/outbox'
import { formatDateTime } from '@/lib/utils/format'

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

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * Turns on offline use for the signed-in app, says so when the connection
 * is gone, and shows the saves that are waiting on this device to be sent.
 */
export function OfflineSupport() {
  const online = useOnline()
  const pathname = usePathname()
  const { entries, sending, send, discard } = useOutbox()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)

  const waiting = entries.filter((e) => e.status === 'waiting')
  const refused = entries.filter((e) => e.status === 'refused')
  const hasWaiting = waiting.length > 0

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

  // Send what is waiting as soon as there is a connection, and keep trying
  // once a minute in case the browser says "online" before the server is
  // actually reachable.
  useEffect(() => {
    if (!online || !hasWaiting) return
    let stopped = false
    const attempt = async () => {
      const result = await send().catch(() => null)
      if (stopped || !result) return
      if (result.sent > 0) toast.success(`${plural(result.sent, 'saved change', 'saved changes')} sent`)
      if (result.refused > 0) {
        toast.error(`${plural(result.refused, 'saved change was', 'saved changes were')} refused — open the list to see why`)
        setOpen(true)
      }
    }
    void attempt()
    const timer = window.setInterval(attempt, 60 * 1000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [online, hasWaiting, send])

  if (online && entries.length === 0) return null

  return (
    <div className="sticky top-14 lg:top-0 z-20">
      {!online && (
        <div role="status" className="flex items-start gap-2 bg-amber-100 border-b border-amber-200 px-4 py-2 text-sm text-amber-900">
          <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            You&apos;re offline. This is what was last loaded on this device, so it may be out of date. Stock
            adjustments, goods receipts and delivery challans can still be saved here and are sent when the
            connection is back; nothing else can be saved.
          </span>
        </div>
      )}

      {entries.length > 0 && (
        <div
          className={`border-b px-4 py-2 text-sm ${
            refused.length > 0 ? 'bg-red-50 border-red-200 text-red-900' : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {refused.length > 0 ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CloudUpload className="w-4 h-4 shrink-0" />}
            <span className="flex-1 min-w-[200px]">
              {hasWaiting &&
                `${plural(waiting.length, 'saved change is', 'saved changes are')} waiting on this device${
                  sending ? ' — sending…' : online ? '.' : ' for a connection.'
                } `}
              {refused.length > 0 &&
                `${plural(refused.length, 'saved change was', 'saved changes were')} refused by the server and ${
                  refused.length === 1 ? 'needs' : 'need'
                } your attention.`}
            </span>
            <button type="button" className="font-medium underline" onClick={() => setOpen((v) => !v)}>
              {open ? 'Hide' : 'Show'}
            </button>
          </div>

          {open && (
            <ul className="mt-2 space-y-2">
              {entries.map((entry) => (
                <li key={entry.id} className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-slate-800">
                  <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-medium">
                        {OUTBOX_KIND_LABEL[entry.kind]} · {entry.summary}
                      </div>
                      <div className="text-xs text-slate-500">Saved here {formatDateTime(entry.createdAt)}</div>
                      {entry.status === 'refused' && (
                        <div className="text-xs text-red-700 mt-1">Refused: {entry.error}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs font-medium">
                      {entry.status === 'refused' && (
                        <button type="button" className="text-blue-700 underline" disabled={sending || !online} onClick={() => void send(entry.id)}>
                          Try again
                        </button>
                      )}
                      {confirming === entry.id ? (
                        <>
                          <button
                            type="button"
                            className="text-red-700 underline"
                            onClick={() => {
                              setConfirming(null)
                              void discard(entry.id)
                            }}
                          >
                            Yes, discard it
                          </button>
                          <button type="button" className="text-slate-600 underline" onClick={() => setConfirming(null)}>
                            Keep
                          </button>
                        </>
                      ) : (
                        <button type="button" className="text-slate-600 underline" onClick={() => setConfirming(entry.id)}>
                          Discard
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
