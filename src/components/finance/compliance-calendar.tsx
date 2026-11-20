'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useTdsLedger } from '@/lib/hooks/use-tds'
import { useGstLedger } from '@/lib/hooks/use-gst-payments'
import { ledgerSetOff } from '@/components/finance/gst-payments'
import { GST_HEADS, returnPeriodLabel } from '@/lib/gst-payments'
import { daysUntil, upcomingCompliance, type ComplianceItem } from '@/lib/compliance'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils/format'
import { CalendarClock } from 'lucide-react'

const r2 = (n: number) => Math.round(n * 100) / 100
const KIND_DOT: Record<ComplianceItem['kind'], string> = { tds: 'bg-violet-500', gst: 'bg-blue-500', income_tax: 'bg-amber-500' }

function when(days: number): string {
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

// What is due in the next few weeks, with the amounts the app knows: TDS still
// to deposit for the month and GST payable in cash. Overdue TDS comes first.
export function ComplianceCalendar({ days = 45 }: { days?: number }) {
  const today = todayISO()
  const { data: tds } = useTdsLedger(today)
  const { data: gst } = useGstLedger(today)

  const months = tds?.set ? tds.months : []
  const owedFor = (period?: string) => months.find((m) => m.period === period)
  const overdue = months.filter((m) => m.overdue)
  const gstCash =
    gst?.set ? r2(GST_HEADS.reduce((s, h) => s + ledgerSetOff(gst).cash[h], 0)) : null

  const items = upcomingCompliance(today, days)

  // The amount beside an item, when the app can say
  function amount(item: ComplianceItem): { text: string; tone: string } | null {
    if (item.key.startsWith('tds-')) {
      const m = owedFor(item.period)
      if (!m || m.deducted === 0) return { text: 'Nothing deducted', tone: 'text-slate-400' }
      if (m.outstanding < 0.005) return { text: 'Deposited', tone: 'text-green-600' }
      return { text: `${formatCurrency(m.outstanding)} to deposit`, tone: 'text-amber-700 font-semibold' }
    }
    if (item.key.startsWith('gstr3b-') && gstCash !== null) {
      return gstCash > 0
        ? { text: `${formatCurrency(gstCash)} payable now`, tone: 'text-amber-700 font-semibold' }
        : { text: 'Nothing to pay in cash now', tone: 'text-slate-400' }
    }
    return null
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-slate-400" />
          Tax due dates
        </h3>
        <span className="text-xs text-slate-400">Next {days} days</span>
      </div>
      <ul className="divide-y divide-slate-50">
        {overdue.map((m) => (
          <li key={`over-${m.period}`}>
            <Link href={'/tds' as Route} className="flex items-start gap-3 px-5 py-3 bg-red-50 hover:bg-red-100 transition-colors">
              <div className="w-14 shrink-0 text-center">
                <div className="text-xs font-semibold text-red-700 uppercase">Overdue</div>
                <div className="text-[11px] text-red-600">{formatDate(m.due_date)}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-red-900">Deposit TDS</div>
                <div className="text-xs text-red-700">TDS deducted in {returnPeriodLabel(m.period)} — interest is running</div>
              </div>
              <div className="text-sm font-semibold text-red-700 tabular-nums whitespace-nowrap">{formatCurrency(m.outstanding)}</div>
            </Link>
          </li>
        ))}
        {items.map((item) => {
          const d = daysUntil(item.date, today)
          const a = amount(item)
          return (
            <li key={item.key}>
              <Link href={item.href as Route} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className="w-14 shrink-0 text-center">
                  <div className={`text-sm font-semibold ${d <= 3 ? 'text-amber-700' : 'text-slate-900'}`}>{formatDate(item.date).slice(0, 6)}</div>
                  <div className="text-[11px] text-slate-400">{when(d)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${KIND_DOT[item.kind]}`} />
                    {item.title}
                  </div>
                  <div className="text-xs text-slate-500">{item.detail}</div>
                </div>
                {a && <div className={`text-xs tabular-nums text-right whitespace-nowrap ${a.tone}`}>{a.text}</div>}
              </Link>
            </li>
          )
        })}
      </ul>
      <p className="px-5 py-3 text-xs text-slate-400 border-t border-slate-100">
        Standard due dates; the government sometimes extends them. Check with your tax adviser before relying on a date.
      </p>
    </div>
  )
}
