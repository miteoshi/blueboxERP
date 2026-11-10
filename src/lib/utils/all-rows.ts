import type { PostgrestError } from '@supabase/supabase-js'

type Page<T> = { data: T[] | null; error: PostgrestError | null }

// The Supabase API returns at most 1,000 rows per request and silently
// drops the rest. For lists that can grow past that (the item catalogue,
// prices, stock, clients), fetch page by page.
//
// The query must be ordered by a unique column (e.g. .order('id')) so pages
// neither repeat nor skip rows. Returns the same { data, error } shape as
// awaiting the query directly.
export async function allRows<T>(
  query: { range(from: number, to: number): PromiseLike<Page<T>> },
  pageSize = 1000
): Promise<Page<T>> {
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query.range(from, from + pageSize - 1)
    if (error) return { data: null, error }
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) return { data: rows, error: null }
  }
}
