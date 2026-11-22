'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/format'
import type { CreditStatus } from '@/lib/hooks/use-finance'
import type { CreditCheck } from '@/lib/credit'

function Row({ label, value, className = 'text-slate-700' }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={`tabular-nums ${className}`}>{value}</span>
    </div>
  )
}

// The customer's credit position next to a quotation, with what confirming it
// would do. Exposure = outstanding invoices + open orders not yet invoiced −
// receipts not yet applied.
export function CreditCheckCard({ status, check, canOverride }: {
  status: CreditStatus
  check: CreditCheck
  canOverride: boolean
}) {
  const Icon = check.over ? ShieldAlert : ShieldCheck
  const tone = check.blocked ? 'text-red-600' : check.over || check.overdue > 0 ? 'text-amber-600' : 'text-teal-600'
  const overBy = check.headroom !== null && check.headroom < 0 ? -check.headroom : 0

  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Icon className={`w-4 h-4 ${tone}`} />
          Credit
        </h3>
      </CardHeader>
      <CardBody className="space-y-2 text-sm">
        <Row
          label="Credit limit"
          value={check.limit === null ? 'No limit set' : formatCurrency(check.limit)}
          className={check.limit === null ? 'text-slate-400' : 'text-slate-700'}
        />
        <Row label="Outstanding invoices" value={formatCurrency(status.outstanding)} />
        {check.overdue > 0 && <Row label="of which overdue" value={formatCurrency(check.overdue)} className="text-red-600" />}
        {status.open_orders > 0 && <Row label="Open orders" value={formatCurrency(status.open_orders)} />}
        {status.unallocated_credit > 0 && (
          <Row label="Unapplied receipts" value={`− ${formatCurrency(status.unallocated_credit)}`} className="text-teal-600" />
        )}
        <div className="border-t border-slate-100 pt-2 space-y-2">
          <Row label="Exposure now" value={formatCurrency(status.exposure)} />
          <Row label="After this order" value={formatCurrency(check.afterOrder)} className="font-semibold text-slate-900" />
          {check.headroom !== null && (
            <Row
              label={check.over ? 'Over the limit by' : 'Credit left after it'}
              value={formatCurrency(check.over ? overBy : check.headroom)}
              className={check.over ? 'font-semibold text-red-600' : 'text-teal-700'}
            />
          )}
        </div>

        {check.blocked && (
          <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
            This order would take the customer over their credit limit, so it can&apos;t be converted by you.
            Collect payment first, or ask a manager to convert it.
          </p>
        )}
        {check.over && canOverride && (
          <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            This order takes the customer over their credit limit. You can still convert it.
          </p>
        )}
        {!check.over && check.overdue > 0 && (
          <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            {formatCurrency(check.overdue)} is overdue.{' '}
            <Link href={'/receivables' as Route} className="font-medium underline">See receivables</Link>
          </p>
        )}
      </CardBody>
    </Card>
  )
}
