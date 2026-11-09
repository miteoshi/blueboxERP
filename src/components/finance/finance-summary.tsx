'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useMemo } from 'react'
import { StatCard } from '@/components/ui/card'
import { useClientReceivables, useInvoices, useUninvoicedChallans } from '@/lib/hooks/use-finance'
import { formatCurrencyShort, todayISO } from '@/lib/utils/format'
import { AlertTriangle, IndianRupee, Receipt, Truck } from 'lucide-react'

// Finance strip for the dashboard (shown to roles that can read invoices)
export function FinanceSummary() {
  const month = todayISO().slice(0, 7)
  const { data: receivables } = useClientReceivables()
  const { data: invoices } = useInvoices({ status: 'issued', from: `${month}-01` })
  const { data: unbilled } = useUninvoicedChallans()

  const figures = useMemo(() => {
    const list = receivables ?? []
    return {
      outstanding: list.reduce((s, r) => s + (r.outstanding ?? 0), 0),
      overdue: list.reduce((s, r) => s + (r.overdue ?? 0), 0),
      billed: (invoices ?? []).reduce((s, i) => s + i.total_amount, 0),
      unbilledCount: unbilled?.length ?? 0,
      unbilledValue: (unbilled ?? []).reduce((s, c) => s + (c.total_amount ?? 0), 0),
    }
  }, [receivables, invoices, unbilled])

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <Link href={'/receivables' as Route}>
        <StatCard
          label="Receivables"
          value={formatCurrencyShort(figures.outstanding)}
          sub="unpaid on issued invoices"
          icon={<IndianRupee className="w-5 h-5" />}
        />
      </Link>
      <Link href={'/receivables' as Route}>
        <StatCard
          label="Overdue"
          value={formatCurrencyShort(figures.overdue)}
          sub="past the due date"
          icon={<AlertTriangle className="w-5 h-5" />}
          className={figures.overdue > 0 ? 'border-red-200' : ''}
        />
      </Link>
      <Link href={'/invoices' as Route}>
        <StatCard
          label="Billed this month"
          value={formatCurrencyShort(figures.billed)}
          sub={`${invoices?.length ?? 0} tax invoices`}
          icon={<Receipt className="w-5 h-5" />}
        />
      </Link>
      <Link href={'/invoices/new' as Route}>
        <StatCard
          label="Delivered, not billed"
          value={figures.unbilledCount}
          sub={figures.unbilledCount ? `${formatCurrencyShort(figures.unbilledValue)} to invoice` : 'all challans billed'}
          icon={<Truck className="w-5 h-5" />}
          className={figures.unbilledCount > 0 ? 'border-amber-200' : ''}
        />
      </Link>
    </div>
  )
}
