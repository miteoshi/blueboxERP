import Link from 'next/link'
import type { Route } from 'next'
import { cn } from '@/lib/utils/cn'

/**
 * One record of a list, laid out for a phone: what it is and its state on
 * the first line, who it is for on the second, the small details under that
 * and the amount on the right. Lists show these below md and their table
 * from md upward.
 */
export function ListCard({
  href,
  title,
  badge,
  subtitle,
  meta,
  right,
  tone,
  mono = true,
  children,
}: {
  href?: string
  title: React.ReactNode
  badge?: React.ReactNode
  subtitle?: React.ReactNode
  /** Short facts shown small, in order; empty ones are skipped */
  meta?: (React.ReactNode | null | undefined | false)[]
  right?: React.ReactNode
  tone?: 'warning' | 'danger' | 'muted'
  /** Document numbers and codes are set in the fixed-width face; names are not */
  mono?: boolean
  children?: React.ReactNode
}) {
  const facts = (meta ?? []).filter(Boolean)
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn('text-sm font-semibold text-slate-900', mono ? 'font-mono break-all' : 'break-words')}>{title}</span>
          {badge}
        </div>
        {subtitle && <div className="text-sm text-slate-700 mt-0.5 break-words">{subtitle}</div>}
        {facts.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-1">
            {facts.map((f, i) => (
              <span key={i}>{f}</span>
            ))}
          </div>
        )}
        {children}
      </div>
      {right && <div className="text-right text-sm shrink-0">{right}</div>}
    </div>
  )
  const className = cn(
    'block px-4 py-3',
    tone === 'warning' && 'bg-amber-50/40',
    tone === 'danger' && 'bg-red-50/40',
    tone === 'muted' && 'opacity-60',
    href && 'active:bg-slate-50'
  )
  return href ? (
    <Link href={href as Route} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

/** The phone-only list that holds ListCards; `empty` shows when it has none. */
export function ListCards({ children, empty, count }: { children: React.ReactNode; empty: string; count: number }) {
  return (
    <div className="md:hidden divide-y divide-slate-100">
      {count === 0 ? <p className="text-center py-12 text-slate-400 text-sm">{empty}</p> : children}
    </div>
  )
}
