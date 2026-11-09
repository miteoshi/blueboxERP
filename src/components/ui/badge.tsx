import { cn } from '@/lib/utils/cn'
import type {
  Enums
} from '@/lib/types/database'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'teal'
  className?: string
}

type DocumentStatus = Enums<'document_status'>
type OrderStatus = Enums<'order_status'>
type ProductionStatus = Enums<'production_status'>

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variants = {
    default: 'bg-slate-100 text-slate-600',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    danger:  'bg-red-100  text-red-700',
    info:    'bg-blue-100 text-blue-700',
    purple:  'bg-purple-100 text-purple-700',
    teal:    'bg-teal-100 text-teal-700',
  }

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
      variants[variant],
      className
    )}>
      {children}
    </span>
  )
}

// ── Status badge helpers ──────────────────────────────────────
// Unknown or missing statuses (e.g. a nullable view column, or a value
// added to the enum later) render as a neutral badge instead of crashing.
function StatusBadge({
  entry,
  status,
}: {
  entry: { label: string; variant: BadgeProps['variant'] } | undefined
  status: string | null | undefined
}) {
  if (entry) return <Badge variant={entry.variant}>{entry.label}</Badge>
  return <Badge>{status ? status.replace(/_/g, ' ') : '—'}</Badge>
}
export function DocumentStatusBadge({ status }: { status: DocumentStatus | string | null | undefined }) {
  const map: Record<DocumentStatus, { label: string; variant: BadgeProps['variant'] }> = {
    draft:            { label: 'Draft',            variant: 'default' },
    pending_approval: { label: 'Pending Approval', variant: 'warning' },
    approved:         { label: 'Approved',         variant: 'success' },
    rejected:         { label: 'Rejected',         variant: 'danger' },
    cancelled:        { label: 'Cancelled',        variant: 'danger' },
    converted: { label: 'Converted',  variant: 'teal' },
  }
  return <StatusBadge entry={status ? map[status as keyof typeof map] : undefined} status={status} />
}

export function OrderStatusBadge({ status }: { status: OrderStatus | string | null | undefined }) {
  const map: Record<OrderStatus, { label: string; variant: BadgeProps['variant'] }> = {
    draft:        { label: 'Draft',        variant: 'default' },
    confirmed:    { label: 'Confirmed',    variant: 'info' },
    in_production:{ label: 'In Production',variant: 'purple' },
    ready:        { label: 'Ready',        variant: 'teal' },
    dispatched:   { label: 'Dispatched',   variant: 'warning' },
    delivered:    { label: 'Delivered',    variant: 'success' },
    cancelled:    { label: 'Cancelled',    variant: 'danger' },
  }
  return <StatusBadge entry={status ? map[status as keyof typeof map] : undefined} status={status} />
}

export function ProductionStatusBadge({ status }: { status: ProductionStatus | string | null | undefined }) {
  const map: Record<ProductionStatus, { label: string; variant: BadgeProps['variant'] }> = {
    pending:    { label: 'Pending',     variant: 'default' },
    in_progress:{ label: 'In Progress', variant: 'info' },
    completed:  { label: 'Completed',   variant: 'success' },
    on_hold:    { label: 'On Hold',     variant: 'warning' },
    cancelled:  { label: 'Cancelled',   variant: 'danger' },
  }
  return <StatusBadge entry={status ? map[status as keyof typeof map] : undefined} status={status} />
}