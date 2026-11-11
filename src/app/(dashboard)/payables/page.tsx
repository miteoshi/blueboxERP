'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TableLoader } from '@/components/ui/spinner'
import { SupplierPaymentForm } from '@/components/payables/payment-form'
import { paymentModeLabel } from '@/lib/hooks/use-finance'
import {
  useApplySupplierAdvance,
  useBillAgeing,
  useCancelSupplierPayment,
  useSupplierPayables,
  useSupplierPayments,
} from '@/lib/hooks/use-payables'
import { useActiveSuppliers } from '@/lib/hooks/use-purchasing'
import { useCan } from '@/lib/hooks/use-profile'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils/format'
import { downloadCsv } from '@/lib/utils/csv'
import { toast } from 'sonner'
import { AlertTriangle, ChevronDown, ChevronRight, Download, IndianRupee, Wallet } from 'lucide-react'

const BUCKETS = [
  { key: 'not_due', label: 'Not due' },
  { key: 'overdue_1_30', label: '1–30 days' },
  { key: 'overdue_31_60', label: '31–60' },
  { key: 'overdue_61_90', label: '61–90' },
  { key: 'overdue_90_plus', label: '90+' },
] as const

const money = (n: number | null | undefined) => (n ? formatCurrency(n) : '—')

export default function PayablesPage() {
  const canManage = useCan('managePayables')
  const { data: rows, isLoading } = useSupplierPayables()
  const { data: payments } = useSupplierPayments()
  const { data: suppliers } = useActiveSuppliers()
  const applyAdvance = useApplySupplierAdvance()
  const cancelPayment = useCancelSupplierPayment()
  const [open, setOpen] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const withBalance = useMemo(
    () => (rows ?? []).filter((r) => (r.outstanding ?? 0) > 0 || (r.advance ?? 0) > 0),
    [rows],
  )

  const totals = useMemo(() => {
    const sum = (k: 'outstanding' | 'overdue' | 'advance' | (typeof BUCKETS)[number]['key']) =>
      withBalance.reduce((s, r) => s + (Number(r[k]) || 0), 0)
    return {
      outstanding: sum('outstanding'),
      overdue: sum('overdue'),
      notDue: sum('not_due'),
      advance: sum('advance'),
      buckets: Object.fromEntries(BUCKETS.map((b) => [b.key, sum(b.key)])) as Record<(typeof BUCKETS)[number]['key'], number>,
    }
  }, [withBalance])

  const outstandingBySupplier = useMemo(() => new Map((rows ?? []).map((r) => [r.supplier_id, r.outstanding ?? 0])), [rows])

  function exportCsv() {
    downloadCsv(`payables-ageing-${todayISO()}`, withBalance, [
      { header: 'Supplier', value: (r) => r.supplier_name },
      { header: 'Outstanding', value: (r) => r.outstanding },
      ...BUCKETS.map((b) => ({ header: b.label, value: (r: (typeof withBalance)[number]) => r[b.key] })),
      { header: 'Advance paid', value: (r) => r.advance },
      { header: 'Next due', value: (r) => r.next_due },
      { header: 'Credit days', value: (r) => r.credit_days },
    ])
  }

  function confirmCancel(id: string) {
    if (!reason.trim()) {
      toast.error('Give a reason')
      return
    }
    cancelPayment.mutate(
      { id, reason: reason.trim() },
      {
        onSuccess: () => {
          setCancelling(null)
          setReason('')
        },
      },
    )
  }

  return (
    <div>
      <PageHeader title="Payables" description="What you owe suppliers, and when it falls due">
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={withBalance.length === 0}>
          <Download className="w-4 h-4" />
          Export ageing
        </Button>
        {canManage && (
          <Button size="sm" onClick={() => setPaying((p) => !p)}>
            <Wallet className="w-4 h-4" />
            Record payment
          </Button>
        )}
      </PageHeader>

      {paying && (
        <SupplierPaymentForm
          suppliers={(suppliers ?? []).map((s) => ({ id: s.id, name: s.name, outstanding: outstandingBySupplier.get(s.id) ?? 0 }))}
          onDone={() => setPaying(false)}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total payable" value={formatCurrency(totals.outstanding)} icon={<IndianRupee className="w-5 h-5" />} />
        <StatCard
          label="Overdue"
          value={formatCurrency(totals.overdue)}
          sub={totals.outstanding ? `${Math.round((totals.overdue / totals.outstanding) * 100)}% of payable` : undefined}
          icon={<AlertTriangle className="w-5 h-5" />}
          className={totals.overdue > 0 ? 'border-red-200' : ''}
        />
        <StatCard label="Not yet due" value={formatCurrency(totals.notDue)} />
        <StatCard label="Advances with suppliers" value={formatCurrency(totals.advance)} sub="Paid but not set against a bill" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        {isLoading ? (
          <TableLoader />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="text-left px-4 py-3">Supplier</th>
                  <th className="text-right px-4 py-3">Outstanding</th>
                  {BUCKETS.map((b) => (
                    <th key={b.key} className="text-right px-4 py-3">
                      {b.label}
                    </th>
                  ))}
                  <th className="text-right px-4 py-3">Next due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {withBalance.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400 text-sm">
                      Nothing payable
                    </td>
                  </tr>
                )}
                {withBalance.map((r) => {
                  const expanded = open === r.supplier_id
                  return (
                    <Fragment key={r.supplier_id}>
                      <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => setOpen(expanded ? null : r.supplier_id)}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 font-medium text-slate-900">
                            {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            {r.supplier_name}
                          </div>
                          {(r.advance ?? 0) > 0 && (
                            <div className="text-xs text-teal-600 ml-6">{formatCurrency(r.advance)} advance paid</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">{money(r.outstanding)}</td>
                        {BUCKETS.map((b) => (
                          <td
                            key={b.key}
                            className={`px-4 py-3 text-right tabular-nums ${
                              b.key === 'overdue_90_plus' && (r[b.key] ?? 0) > 0
                                ? 'text-red-600 font-medium'
                                : b.key !== 'not_due' && (r[b.key] ?? 0) > 0
                                  ? 'text-amber-600'
                                  : 'text-slate-600'
                            }`}
                          >
                            {money(r[b.key])}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right text-xs text-slate-600">{r.next_due ? formatDate(r.next_due) : '—'}</td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={8} className="bg-slate-50 px-10 py-3">
                            <SupplierOpenBills supplierId={r.supplier_id ?? ''} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
              {withBalance.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(totals.outstanding)}</td>
                    {BUCKETS.map((b) => (
                      <td key={b.key} className="px-4 py-3 text-right tabular-nums">
                        {money(totals.buckets[b.key])}
                      </td>
                    ))}
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Payments made</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <th className="text-left px-4 py-3">Payment</th>
                <th className="text-left px-4 py-3">Supplier</th>
                <th className="text-left px-4 py-3">Mode</th>
                <th className="text-left px-4 py-3">Applied to</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(payments ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 text-sm">
                    No payments recorded yet
                  </td>
                </tr>
              )}
              {(payments ?? []).map((p) => {
                const active = p.status === 'active'
                const advance = active ? p.amount - p.amount_allocated : 0
                return (
                  <Fragment key={p.id}>
                    <tr className={active ? '' : 'opacity-60'}>
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-slate-900">{p.payment_no}</span>
                        <div className="text-xs text-slate-400">{formatDate(p.payment_date)}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-900">{p.supplier?.name}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {paymentModeLabel(p.mode)}
                        {p.reference && <div className="text-slate-400">{p.reference}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {!active ? (
                          <span className="text-slate-500">Cancelled{p.cancel_reason ? ` — ${p.cancel_reason}` : ''}</span>
                        ) : (
                          <>
                            {p.supplier_payment_allocations.map((a) => (
                              <div key={a.bill?.id}>
                                <Link href={`/supplier-bills/${a.bill?.id}` as Route} className="font-mono text-blue-600 hover:underline">
                                  {a.bill?.bill_no}
                                </Link>{' '}
                                <span className="text-slate-500">{formatCurrency(a.amount)}</span>
                              </div>
                            ))}
                            {advance > 0.005 && <Badge variant="info">{formatCurrency(advance)} advance</Badge>}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatCurrency(p.amount)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {active && canManage && (
                          <>
                            {advance > 0.005 && (
                              <button
                                type="button"
                                className="text-xs text-teal-700 hover:underline mr-3"
                                disabled={applyAdvance.isPending}
                                onClick={() => applyAdvance.mutate(p.id)}
                              >
                                Apply to bills
                              </button>
                            )}
                            <button
                              type="button"
                              className="text-xs text-red-600 hover:underline"
                              onClick={() => {
                                setCancelling(cancelling === p.id ? null : p.id)
                                setReason('')
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                    {cancelling === p.id && (
                      <tr>
                        <td colSpan={6} className="bg-red-50 px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              autoFocus
                              placeholder={`Why cancel ${p.payment_no}? e.g. cheque bounced`}
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              className="flex-1 min-w-[220px] px-3 py-1.5 text-sm rounded-lg border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-300"
                            />
                            <Button variant="outline" size="sm" onClick={() => setCancelling(null)}>
                              Keep
                            </Button>
                            <Button variant="danger" size="sm" loading={cancelPayment.isPending} onClick={() => confirmCancel(p.id)}>
                              Cancel payment
                            </Button>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">The bills it paid become due again.</p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SupplierOpenBills({ supplierId }: { supplierId: string }) {
  const { data, isLoading } = useBillAgeing(supplierId)
  if (isLoading) return <p className="text-xs text-slate-400">Loading…</p>
  if (!data?.length) return <p className="text-xs text-slate-500">No open bills — only an advance.</p>
  return (
    <table className="w-full text-xs">
      <tbody>
        {data.map((b) => (
          <tr key={b.id}>
            <td className="py-1">
              <Link href={`/supplier-bills/${b.id}` as Route} className="font-mono text-blue-600 hover:underline">
                {b.bill_no}
              </Link>
            </td>
            <td className="py-1 text-slate-500">Inv {b.supplier_invoice_no}</td>
            <td className="py-1 text-slate-500">due {formatDate(b.due_date)}</td>
            <td className={`py-1 ${(b.days_overdue ?? 0) > 0 ? 'text-red-600' : 'text-slate-500'}`}>
              {(b.days_overdue ?? 0) > 0 ? `${b.days_overdue} days overdue` : 'not due'}
            </td>
            <td className="py-1 text-right tabular-nums">{formatCurrency(b.total_amount)}</td>
            <td className="py-1 text-right tabular-nums font-medium">{formatCurrency(b.balance_due)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
