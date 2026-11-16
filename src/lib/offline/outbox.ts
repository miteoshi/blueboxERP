// Saves made with no connection, kept on the device until they can be sent.
//
// Only three kinds of save are held this way: a stock adjustment, a goods
// receipt and a delivery challan. Each already carries an id the database
// uses to refuse a second copy, so sending one again after an uncertain
// first attempt can never create a duplicate. Everything else, tax invoices
// above all, still needs a connection.
//
// An entry leaves the outbox in exactly two ways: the server accepted it,
// or the user discarded it. A save the server refuses stays, with the
// reason, until someone deals with it.

import { adjustInventory, createDeliveryChallan, createInboundReceipt } from '@/lib/utils/inventory'
import { isAlreadySaved } from '@/lib/utils/rpc'
import { isConnectionError } from '@/lib/offline/connection'

const SENDERS = {
  stock_adjustment: (params: Parameters<typeof adjustInventory>[0]) => adjustInventory(params),
  goods_receipt: (params: Parameters<typeof createInboundReceipt>[0]) => createInboundReceipt(params),
  delivery_challan: (params: Parameters<typeof createDeliveryChallan>[0]) => createDeliveryChallan(params),
}

export type OutboxKind = keyof typeof SENDERS
type ParamsOf<K extends OutboxKind> = Parameters<(typeof SENDERS)[K]>[0]
type ResultOf<K extends OutboxKind> = Awaited<ReturnType<(typeof SENDERS)[K]>>

export const OUTBOX_KIND_LABEL: Record<OutboxKind, string> = {
  stock_adjustment: 'Stock adjustment',
  goods_receipt: 'Goods receipt',
  delivery_challan: 'Delivery challan',
}

export type OutboxEntry = {
  /** Also the id the database uses to refuse a duplicate */
  id: string
  kind: OutboxKind
  params: unknown
  /** One line saying what this is, written when it was saved */
  summary: string
  /** Whose save this is; it is only ever sent while they are signed in */
  userId: string
  createdAt: string
  status: 'waiting' | 'refused'
  /** Why the server refused it, in the server's words */
  error?: string
}

export const QUEUED_MESSAGE = 'Saved on this device. It will be sent when the connection is back.'

// ── storage: its own database, so signing out never deletes unsent work ──
const DB_NAME = 'bluebox-outbox'
const STORE = 'entries'
const CHANGED = 'bluebox-outbox-changed'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = work(tx.objectStore(STORE))
      // Resolve only once the write is durable, not merely requested
      tx.oncomplete = () => resolve(req.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

function changed() {
  window.dispatchEvent(new Event(CHANGED))
  try {
    new BroadcastChannel(CHANGED).postMessage(1) // other tabs
  } catch {
    // no BroadcastChannel: other tabs catch up on their next look
  }
}

/** Calls back whenever the outbox changes, in this tab or another. */
export function onOutboxChange(callback: () => void): () => void {
  window.addEventListener(CHANGED, callback)
  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(CHANGED)
    channel.onmessage = callback
  } catch {
    channel = null
  }
  return () => {
    window.removeEventListener(CHANGED, callback)
    channel?.close()
  }
}

export async function listOutbox(userId: string): Promise<OutboxEntry[]> {
  if (typeof indexedDB === 'undefined') return []
  const all = await run<OutboxEntry[]>('readonly', (s) => s.getAll())
  return all.filter((e) => e.userId === userId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function discardFromOutbox(id: string): Promise<void> {
  await run('readwrite', (s) => s.delete(id))
  changed()
}

/**
 * Makes the save. If it cannot reach the server it is kept on the device
 * instead and `queued` is true; any other failure is thrown as usual.
 */
export async function saveOrQueue<K extends OutboxKind>(entry: {
  kind: K
  /** Must be the same id the params carry (requestId / operationId) */
  id: string
  params: ParamsOf<K>
  summary: string
  userId: string | null | undefined
}): Promise<{ queued: false; data: ResultOf<K> } | { queued: true }> {
  try {
    const data = (await (SENDERS[entry.kind] as (p: ParamsOf<K>) => Promise<ResultOf<K>>)(entry.params))
    return { queued: false, data }
  } catch (error) {
    // Without knowing whose save it is, it could never be sent: fail instead
    if (!isConnectionError(error) || !entry.userId || typeof indexedDB === 'undefined') throw error
    const stored: OutboxEntry = {
      id: entry.id,
      kind: entry.kind,
      params: entry.params,
      summary: entry.summary,
      userId: entry.userId,
      createdAt: new Date().toISOString(),
      status: 'waiting',
    }
    await run('readwrite', (s) => s.put(stored))
    changed()
    return { queued: true }
  }
}

export type SendResult = { sent: number; refused: number; waiting: number }

async function sendAll(userId: string, retryRefusedId?: string): Promise<SendResult> {
  const result: SendResult = { sent: 0, refused: 0, waiting: 0 }
  const entries = await listOutbox(userId)
  let reachable = true
  for (const entry of entries) {
    const due = entry.status === 'waiting' || entry.id === retryRefusedId
    if (!due) {
      result.refused++
      continue
    }
    if (!reachable) {
      result.waiting++
      continue
    }
    try {
      await (SENDERS[entry.kind] as (p: unknown) => Promise<unknown>)(entry.params)
      await run('readwrite', (s) => s.delete(entry.id))
      result.sent++
    } catch (error) {
      if (isAlreadySaved(error)) {
        // An earlier attempt got through; the server kept it and refused this copy
        await run('readwrite', (s) => s.delete(entry.id))
        result.sent++
      } else if (isConnectionError(error)) {
        // Still no connection: leave this and everything after it as it is
        reachable = false
        result.waiting++
      } else {
        const refused: OutboxEntry = {
          ...entry,
          status: 'refused',
          error: error instanceof Error ? error.message : 'The server refused this save',
        }
        await run('readwrite', (s) => s.put(refused))
        result.refused++
      }
    }
  }
  if (result.sent > 0 || result.refused > 0) changed()
  return result
}

/**
 * Sends what is waiting, oldest first. Only one tab sends at a time; a
 * second caller gets null and should simply look again later.
 */
export async function sendOutbox(userId: string, retryRefusedId?: string): Promise<SendResult | null> {
  if (typeof indexedDB === 'undefined') return null
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('bluebox-outbox-send', { ifAvailable: true }, (lock) =>
      lock ? sendAll(userId, retryRefusedId) : null
    )
  }
  return sendAll(userId, retryRefusedId)
}
