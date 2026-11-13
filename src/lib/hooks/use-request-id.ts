'use client'

import { useRef } from 'react'

// A document RPC that times out on its way back has still saved. Sending the
// same submission id with a retry lets the database refuse the duplicate
// instead of creating a second document (error P0012).
//
// The id is held until the save succeeds, so every retry of the same
// submission carries it. A save that genuinely failed rolled its claim back
// too, so reusing the id afterwards is safe.
export function useRequestId() {
  const current = useRef<string | null>(null)

  return {
    // The id for this submission, created on first use
    get: () => (current.current ??= crypto.randomUUID()),
    // Call once the document is saved, so the next one gets a fresh id
    clear: () => {
      current.current = null
    },
  }
}

export type RequestId = ReturnType<typeof useRequestId>
