// ─────────────────────────────────────────────────────────────
// Errors raised by the workflow RPCs already carry a message written for
// the user, so it is passed through as-is. The Postgres code comes with it
// so callers can tell a refused duplicate from a real failure.
// ─────────────────────────────────────────────────────────────

// "This submission was already saved" — see _claim_document_request()
export const ALREADY_SAVED = 'P0012'

type PgError = { message?: string; code?: string } | null

export function rpcFailure(error: PgError, fallback: string): Error {
  const err = new Error(error?.message || fallback) as Error & { code?: string }
  if (error?.code) err.code = error.code
  return err
}

export function isAlreadySaved(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === ALREADY_SAVED
}
