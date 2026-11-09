import { Badge } from '@/components/ui/badge'
import { isPastDate } from '@/lib/utils/format'

type InvoiceLike = {
  status: string
  balance_due: number | null
  amount_paid: number
  due_date: string
}

export type PaymentState = 'cancelled' | 'paid' | 'overdue' | 'partial' | 'unpaid'

export function paymentState(inv: InvoiceLike): PaymentState {
  if (inv.status === 'cancelled') return 'cancelled'
  const balance = inv.balance_due ?? 0
  if (balance <= 0) return 'paid'
  if (isPastDate(inv.due_date)) return 'overdue'
  return inv.amount_paid > 0 ? 'partial' : 'unpaid'
}

const STYLE: Record<PaymentState, { label: string; variant: 'success' | 'danger' | 'warning' | 'default' | 'info' }> = {
  paid: { label: 'Paid', variant: 'success' },
  overdue: { label: 'Overdue', variant: 'danger' },
  partial: { label: 'Part paid', variant: 'warning' },
  unpaid: { label: 'Unpaid', variant: 'info' },
  cancelled: { label: 'Cancelled', variant: 'default' },
}

export function InvoiceStatusBadge({ invoice }: { invoice: InvoiceLike }) {
  const { label, variant } = STYLE[paymentState(invoice)]
  return <Badge variant={variant}>{label}</Badge>
}
