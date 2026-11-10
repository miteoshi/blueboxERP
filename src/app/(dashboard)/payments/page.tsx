'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, StatCard } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { TableLoader } from '@/components/ui/spinner'
import {
  PAYMENT_MODES,
  paymentModeLabel,
  useAllocateReceipt,
  useCancelReceipt,
  useInvoiceAgeing,
  useReceipts,
  useRecordReceipt,
  type PaymentMode,
} from '@/lib/hooks/use-finance'
import { useCanBill, useCanManageFinance } from '@/lib/hooks/use-profile'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils/format'
import { downloadCsv } from '@/lib/utils/csv'
import { toast } from 'sonner'
import { Download, Plus, Wallet, X } from 'lucide-react'
import { allRows } from "@/lib/utils/all-rows"

function useActiveClients() {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['clients-min', orgId],
    queryFn: async () => {
      const { data, error } = await allRows(supabase
        .from('clients')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
        .order('id'))
      if (error) throw error
      return data
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  })
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export default function PaymentsPage() {
  const canBill = useCanBill()
  const canManage = useCanManageFinance()
  const { data: receipts, isLoading } = useReceipts()
  const allocate = useAllocateReceipt()
  const cancel = useCancelReceipt()
  const [showForm, setShowForm] = useState(false)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const stats = useMemo(() => {
    const active = (receipts ?? []).filter((r) => r.status === 'active')
    const month = todayISO().slice(0, 7)
    return {
      thisMonth: active.filter((r) => r.receipt_date.startsWith(month)).reduce((s, r) => s + r.amount, 0),
      unapplied: active.reduce((s, r) => s + (r.amount - r.amount_allocated), 0),
    }
  }, [receipts])

  function exportCsv() {
    downloadCsv(`receipts-${todayISO()}`, receipts ?? [], [
      { header: 'Receipt No', value: (r) => r.receipt_no },
      { header: 'Date', value: (r) => r.receipt_date },
      { header: 'Client', value: (r) => r.client?.name },
      { header: 'Mode', value: (r) => paymentModeLabel(r.mode) },
      { header: 'Reference', value: (r) => r.reference },
      { header: 'Amount', value: (r) => r.amount },
      { header: 'Applied', value: (r) => r.amount_allocated },
      { header: 'Unapplied', value: (r) => r.amount - r.amount_allocated },
      { header: 'Sales Order', value: (r) => r.sales_order?.so_number },
      { header: 'Invoices', value: (r) => r.receipt_allocations.map((a) => a.invoice?.invoice_no).join(' ') },
      { header: 'Status', value: (r) => r.status },
    ])
  }

  return (
    <div>
      <PageHeader title="Payments Received" description="Customer receipts and how they are applied to invoices">
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!receipts?.length}>
          <Download className="w-4 h-4" />
          Export
        </Button>
        {canBill && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" />
            Record payment
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard label="Received this month" value={formatCurrency(stats.thisMonth)} icon={<Wallet className="w-5 h-5" />} />
        <StatCard
          label="Unapplied (advances / on account)"
          value={formatCurrency(stats.unapplied)}
          sub="Money received but not yet set against an invoice"
        />
      </div>

      {showForm && <RecordPaymentForm onClose={() => setShowForm(false)} />}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <TableLoader />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="text-left px-4 py-3">Receipt</th>
                  <th className="text-left px-4 py-3">Client</th>
                  <th className="text-left px-4 py-3">Mode</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-left px-4 py-3">Applied to</th>
                  <th className="text-right px-4 py-3">Unapplied</th>
                  <th className="text-center px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {receipts?.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400 text-sm">
                      No payments recorded yet
                    </td>
                  </tr>
                )}
                {receipts?.map((r) => {
                  const unapplied = round2(r.amount - r.amount_allocated)
                  const active = r.status === 'active'
                  return (
                    <tr key={r.id} className={active ? 'hover:bg-slate-50' : 'opacity-60'}>
                      <td className="px-4 py-3">
                        <div className="font-mono text-sm font-semibold text-slate-900">{r.receipt_no}</div>
                        <div className="text-xs text-slate-400">{formatDate(r.receipt_date)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{r.client?.name}</div>
                        {r.sales_order && (
                          <Link
                            href={`/sales-orders/${r.sales_order.id}` as Route}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Advance on {r.sales_order.so_number}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {paymentModeLabel(r.mode)}
                        {r.reference && <div className="text-xs text-slate-400 font-mono">{r.reference}</div>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatCurrency(r.amount)}</td>
                      <td className="px-4 py-3">
                        {r.receipt_allocations.length === 0 ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {r.receipt_allocations.map((a) => (
                              <Link
                                key={a.id}
                                href={`/invoices/${a.invoice?.id}` as Route}
                                className="text-xs font-mono text-blue-600 hover:underline"
                                title={formatCurrency(a.amount)}
                              >
                                {a.invoice?.invoice_no}
                              </Link>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {!active ? (
                          <Badge>Cancelled</Badge>
                        ) : unapplied > 0 ? (
                          <span className="text-amber-600 font-medium">{formatCurrency(unapplied)}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {active && unapplied > 0 && canBill && (
                            <Button
                              variant="ghost"
                              size="sm"
                              loading={allocate.isPending && allocate.variables?.receiptId === r.id}
                              onClick={() => allocate.mutate({ receiptId: r.id })}
                              title="Apply to this client's oldest open invoices"
                            >
                              Apply
                            </Button>
                          )}
                          {active && canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:bg-red-50"
                              onClick={() => {
                                setCancelId(r.id)
                                setReason('')
                              }}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                        {cancelId === r.id && (
                          <div className="mt-2 flex gap-2">
                            <input
                              autoFocus
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              placeholder="Reason (e.g. cheque bounced)"
                              className="flex-1 px-2 py-1 text-xs rounded border border-slate-300"
                            />
                            <Button
                              size="sm"
                              variant="danger"
                              loading={cancel.isPending}
                              onClick={() => {
                                if (!reason.trim()) {
                                  toast.error('Give a reason')
                                  return
                                }
                                cancel.mutate({ id: r.id, reason: reason.trim() }, { onSuccess: () => setCancelId(null) })
                              }}
                            >
                              Confirm
                            </Button>
                            <button onClick={() => setCancelId(null)} className="text-slate-400">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Record payment ────────────────────────────────────────────

function RecordPaymentForm({ onClose }: { onClose: () => void }) {
  const { data: clients } = useActiveClients()
  const [clientId, setClientId] = useState('')
  const { data: openInvoices } = useInvoiceAgeing(clientId || undefined)
  const record = useRecordReceipt()

  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<PaymentMode>('bank_transfer')
  const [date, setDate] = useState(todayISO)
  const [reference, setReference] = useState('')
  const [manual, setManual] = useState(false)
  const [alloc, setAlloc] = useState<Record<string, string>>({})

  const invoices = useMemo(() => (clientId ? openInvoices ?? [] : []), [clientId, openInvoices])
  const totalDue = invoices.reduce((s, i) => s + (i.balance_due ?? 0), 0)
  const allocated = Object.values(alloc).reduce((s, v) => s + (Number(v) || 0), 0)
  const value = Number(amount) || 0

  // FIFO preview, mirroring the server: oldest due date first
  const fifo = useMemo(() => {
    const result = new Map<string, number>()
    let left = value
    for (const i of invoices) {
      const take = round2(Math.max(0, Math.min(left, i.balance_due ?? 0)))
      result.set(i.id ?? '', take)
      left = round2(left - take)
    }
    return result
  }, [invoices, value])

  async function save() {
    if (!clientId) {
      toast.error('Select a client')
      return
    }
    if (!(value > 0)) {
      toast.error('Enter the amount received')
      return
    }
    if (mode === 'cash' && value >= 200000) {
      toast.error('Cash receipts of ₹2,00,000 or more are not allowed (Income Tax Act s.269ST)')
      return
    }
    const allocations = manual
      ? Object.entries(alloc)
          .map(([invoice_id, v]) => ({ invoice_id, amount: round2(Number(v) || 0) }))
          .filter((a) => a.amount > 0)
      : undefined
    if (manual && allocated > value + 0.005) {
      toast.error('Allocations add up to more than the amount received')
      return
    }
    try {
      const res = await record.mutateAsync({
        clientId,
        amount: round2(value),
        mode,
        receiptDate: date,
        reference: reference.trim() || undefined,
        allocations,
        autoAllocate: !manual,
      })
      toast.success(
        res.unallocated > 0
          ? `Receipt ${res.receipt_no} saved — ${formatCurrency(res.unallocated)} kept on account`
          : `Receipt ${res.receipt_no} saved and applied`
      )
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not record the payment')
    }
  }

  return (
    <Card className="mb-6 border-blue-200">
      <CardHeader className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Record a payment</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="space-y-1 md:col-span-2">
            <label className="block text-sm font-medium text-slate-700">Client</label>
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value)
                setAlloc({})
              }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            >
              <option value="">Select client…</option>
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Input label="Amount (₹)" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as PaymentMode)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            >
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <Input label="Date" type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Input
          label="Reference"
          placeholder="UTR / cheque no. / transaction ID"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />

        {clientId && (
          <div className="rounded-lg border border-slate-200">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200 text-sm">
              <span className="font-medium text-slate-700">
                Open invoices · {formatCurrency(totalDue)} due
              </span>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} />
                Choose invoices myself
              </label>
            </div>
            {invoices.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500">
                No open invoices — the full amount is kept on account and applied to the next invoice.
              </p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-50">
                  {invoices.map((i) => (
                    <tr key={i.id}>
                      <td className="px-4 py-2 font-mono text-xs">{i.invoice_no}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        due {formatDate(i.due_date)}
                        {(i.days_overdue ?? 0) > 0 && <span className="text-red-600"> · {i.days_overdue}d overdue</span>}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(i.balance_due)}</td>
                      <td className="px-4 py-2 text-right w-36">
                        {manual ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            max={i.balance_due ?? undefined}
                            value={alloc[i.id ?? ''] ?? ''}
                            onChange={(e) => setAlloc((prev) => ({ ...prev, [i.id ?? '']: e.target.value }))}
                            className="w-28 px-2 py-1 text-right text-sm rounded border border-slate-300"
                          />
                        ) : (
                          <span className="tabular-nums text-slate-700">
                            {(fifo.get(i.id ?? '') ?? 0) > 0 ? formatCurrency(fifo.get(i.id ?? '')) : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {value > 0 && (
              <p className="px-4 py-2 text-xs text-slate-500 border-t border-slate-100">
                {manual
                  ? `Applying ${formatCurrency(allocated)} · ${formatCurrency(Math.max(0, round2(value - allocated)))} stays on account`
                  : value > totalDue
                    ? `Oldest first · ${formatCurrency(round2(value - totalDue))} stays on account`
                    : 'Applied to the oldest invoices first'}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={record.isPending} onClick={save}>
            Save receipt
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
