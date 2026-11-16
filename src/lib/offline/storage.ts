// Where the last-loaded data is kept on the device so the app can still
// show it with no connection. IndexedDB rather than localStorage: a few
// long lists are already past localStorage's ~5 MB.

const DB_NAME = 'bluebox-offline'
const STORE = 'kv'
export const QUERY_CACHE_KEY = 'query-cache'
/** Cached page shells, written by public/sw.js. Keep the name in step with it. */
export const PAGE_CACHE = 'bb-pages-v1'
const OWNER_KEY = 'bb-offline-owner'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = work(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

/** The storage shape TanStack Query's async persister expects. */
export const offlineStorage = {
  getItem: async (key: string) => ((await run<string | undefined>('readonly', (s) => s.get(key))) ?? null),
  setItem: async (key: string, value: string) => {
    await run('readwrite', (s) => s.put(value, key))
  },
  removeItem: async (key: string) => {
    await run('readwrite', (s) => s.delete(key))
  },
}

/**
 * Wipes everything kept for offline use: the saved data and the saved page
 * shells. Called on sign-out and when a different person signs in, so one
 * user's records are never left behind for the next on a shared device.
 */
export async function clearOfflineData(): Promise<void> {
  await Promise.allSettled([
    offlineStorage.removeItem(QUERY_CACHE_KEY),
    typeof caches !== 'undefined' ? caches.delete(PAGE_CACHE) : Promise.resolve(false),
  ])
  try {
    localStorage.removeItem(OWNER_KEY)
  } catch {
    // storage unavailable (private mode): nothing was kept there anyway
  }
}

/**
 * Records whose data is on this device. Returns true when it belonged to
 * someone else, in which case the caller must drop it.
 */
export function claimOfflineData(userId: string): boolean {
  try {
    const owner = localStorage.getItem(OWNER_KEY)
    localStorage.setItem(OWNER_KEY, userId)
    return owner !== null && owner !== userId
  } catch {
    return false
  }
}
