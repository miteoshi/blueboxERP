// ─────────────────────────────────────────────────────────────
// Build a PostgREST `.or()` filter that matches `term` in any of the
// given columns (case-insensitive substring).
//
// The term is double-quoted so commas, dots and parentheses in a search
// (e.g. "Cable 2.5mm, 4 core" or `3/4" conduit`) can't break the filter
// syntax. Inside quotes PostgREST treats backslash as the escape
// character, so backslashes and double quotes are escaped. LIKE
// wildcards typed by the user are matched literally.
// ─────────────────────────────────────────────────────────────
export function ilikeAny(columns: string[], term: string): string {
  const literal = term
    .trim()
    .replace(/\\/g, '\\\\\\\\') // backslash: escaped for LIKE, then for PostgREST
    .replace(/[%_]/g, (c) => `\\\\${c}`) // literal % and _ in LIKE
    .replace(/"/g, '\\"') // double quote inside the quoted value
  return columns.map((col) => `${col}.ilike."%${literal}%"`).join(',')
}
