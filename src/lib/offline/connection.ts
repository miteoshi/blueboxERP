// What "offline" means in this app, in one place.

/** The name carried by a request that never reached the server. */
export const OFFLINE_ERROR_NAME = "You're offline"

// Supabase reports a failed request as "<name>: <message>", so the two read
// as one sentence: "You're offline: nothing was sent. Try again when ..."
export const OFFLINE_MESSAGE = 'nothing was sent. Try again when the connection is back.'

/**
 * fetch for the Supabase client. A request that cannot leave the device
 * fails with one plain sentence instead of "TypeError: Failed to fetch",
 * which is what the user would otherwise read in a toast.
 */
export async function offlineAwareFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init)
  } catch (error) {
    // A cancelled request is not a connection problem
    if ((error as { name?: string } | null)?.name === 'AbortError') throw error
    // fetch rejects with a TypeError only when the request could not be made
    if (error instanceof TypeError) {
      const offline = new Error(OFFLINE_MESSAGE)
      offline.name = OFFLINE_ERROR_NAME
      throw offline
    }
    throw error
  }
}

/** True for an error that means "could not reach the server", not "the server said no". */
export function isConnectionError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const e = error as { name?: string; message?: string; status?: number } | null
  if (!e) return false
  return (
    e.name === OFFLINE_ERROR_NAME ||
    e.name === 'AuthRetryableFetchError' ||
    (e.message ?? '').includes(OFFLINE_MESSAGE) ||
    (e.message ?? '').startsWith(`${OFFLINE_ERROR_NAME}:`)
  )
}
