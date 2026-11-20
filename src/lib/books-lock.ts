// The closed period as the date fields see it. Dates are ISO yyyy-mm-dd
// strings, which compare correctly as text.

/** The day after an ISO date, e.g. '2026-10-31' → '2026-11-01'. */
export function dayAfter(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * The earliest date a field can take: the later of its own minimum (if any)
 * and the first day after the closed period (if the books are closed).
 */
export function earliestOpenDate(lockedUntil: string | null | undefined, ownMin?: string | null): string | undefined {
  const open = lockedUntil ? dayAfter(lockedUntil) : undefined
  if (!open) return ownMin || undefined
  return ownMin && ownMin > open ? ownMin : open
}

/** True when the date falls in the closed period. */
export function isInClosedPeriod(date: string | null | undefined, lockedUntil: string | null | undefined): boolean {
  return !!date && !!lockedUntil && date <= lockedUntil
}
