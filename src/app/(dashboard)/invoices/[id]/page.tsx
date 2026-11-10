'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { PageLoader } from '@/components/ui/spinner'
import { InvoiceStatusBadge } from '@/components/finance/invoice-status'
import {
  PAYMENT_MODES,
  creditNoteDeadline,
  creditNoteReasonLabel,
  paymentModeLabel,
  useCancelInvoice,
  useGstStates,
  useInvoice,
  useRecordReceipt,
  type PaymentMode,
} from '@/lib/hooks/use-finance'
import { useCanBill, useCanManageFinance } from '@/lib/hooks/use-profile'
import { formatCurrency, formatDate, formatDateTime, formatQty, todayISO } from '@/lib/utils/format'
import { amountInWords } from '@/lib/gst'
import { toast } from 'sonner'
import { ArrowLeft, FileMinus, Printer, Wallet, XCircle } from 'lucide-react'

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const canBill = useCanBill()
  const canManage = useCanManageFinance()
  const { data: inv, isLoading } = useInvoice(id)
  const { data: gstStates } = useGstStates()
  const recordReceipt = useRecordReceipt()
  const cancelInvoice = useCancelInvoice()

  const [showPay, setShowPay] = useState(false)
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<PaymentMode>('bank_transfer')
  const [payDate, setPayDate] = useState(todayISO)
  const [reference, setReference] = useState('')
  const [showCancel, setShowCancel] = useState(false)
  const [reason, setReason] = useState('')

  if (isLoading) return <PageLoader />
  if (!inv) return <p className="text-sm text-slate-500">Invoice not found.</p>

  const balance = inv.balance_due ?? 0
  const isOpen = inv.status === 'issued' && balance > 0
  const stateName = (code: string | null) =>
    code ? `${code} — ${gstStates?.find((s) => s.code === code)?.name ?? ''}` : '—'
  const lines = [...inv.sales_invoice_lines].sort((a, b) => a.sort_order - b.sort_order)
  const payments = inv.receipt_allocations.filter((a) => a.receipt?.status === 'active')
  const creditNotes = [...inv.credit_notes].sort((a, b) => b.note_date.localeCompare(a.note_date))
  const activeCreditNotes = creditNotes.filter((n) => n.status === 'issued')
  const deadline = creditNoteDeadline(inv.invoice_date)
  const canCredit =
    canManage &&
    inv.status === 'issued' &&
    inv.total_amount - inv.amount_credited > 0 &&
    todayISO() <= deadline

  async function recordPayment() {
    if (!inv) return
    const value = Number(amount)
    if (!(value > 0)) {
      toast.error('Enter the amount received')
      return
    }
    if (value > balance + 0.005) {
      toast.error(`Amount is more than the balance due (${formatCurrency(balance)})`)
      return
    }
    try {
      const res = await recordReceipt.mutateAsync({
        clientId: inv.client_id,
        amount: Math.round(value * 100) / 100,
        mode,
        receiptDate: payDate,
        reference: reference.trim() || undefined,
        allocations: [{ invoice_id: inv.id, amount: Math.round(value * 100) / 100 }],
      })
      toast.success(`Receipt ${res.receipt_no} recorded`)
      setShowPay(false)
      setAmount('')
      setReference('')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not record the payment')
    }
  }

  function cancel() {
    if (!inv) return
    if (!reason.trim()) {
      toast.error('Give a reason for cancelling')
      return
    }
    cancelInvoice.mutate(
      { id: inv.id, reason: reason.trim() },
      { onSuccess: () => setShowCancel(false) }
    )
  }

  return (
    <div>
      <PageHeader
        title={inv.invoice_no}
        description={`Tax invoice · ${formatDate(inv.invoice_date)} · ${inv.buyer_name}`}
      >
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <a
          href={`/api/pdf?type=invoice&id=${inv.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700"
        >
          <Printer className="w-4 h-4" />
          Print
        </a>
        <a
          href={`/api/pdf?type=invoice&id=${inv.id}&copies=3`}
          target="_blank"
          rel="noopener noreferrer"
          title="Original for recipient, duplicate for transporter, triplicate for supplier"
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700"
        >
          3 copies
        </a>
        {canBill && isOpen && (
          <Button
            size="sm"
            onClick={() => {
              setAmount(balance.toFixed(2))
              setShowPay(true)
            }}
          >
            <Wallet className="w-4 h-4" />
            Record payment
          </Button>
        )}
        {canCredit && (
          <Link href={`/credit-notes/new?invoice=${inv.id}` as Route}>
            <Button variant="outline" size="sm">
              <FileMinus className="w-4 h-4" />
              Credit note
            </Button>
          </Link>
        )}
        {canManage && inv.status === 'issued' && activeCreditNotes.length === 0 && (
          <Button variant="outline" size="sm" className="text-red-600" onClick={() => setShowCancel(true)}>
            <XCircle className="w-4 h-4" />
            Cancel
          </Button>
        )}
      </PageHeader>

      {inv.status === 'cancelled' && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Cancelled {inv.cancelled_at ? formatDateTime(inv.cancelled_at) : ''}
          {inv.cancel_reason ? ` — ${inv.cancel_reason}` : ''}. Its challans were released and can be invoiced again;
          the number stays reserved in the series.
        </div>
      )}

      {showPay && (
        <Card className="mb-6 border-blue-200">
          <CardBody className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <Input
              label="Amount received (₹)"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
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
            <Input label="Date" type="date" max={todayISO()} value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            <Input
              label="Reference"
              placeholder="UTR / cheque no."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowPay(false)}>
                Close
              </Button>
              <Button loading={recordReceipt.isPending} onClick={recordPayment}>
                Save
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {showCancel && (
        <Card className="mb-6 border-red-200">
          <CardBody className="space-y-3">
            <Textarea
              label="Reason for cancelling"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. wrong rate charged — re-invoicing"
              rows={2}
            />
            <p className="text-xs text-slate-500">
              Payments applied to this invoice go back to the receipts as unapplied credit, and its challans can be
              invoiced again.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCancel(false)}>
                Keep invoice
              </Button>
              <Button variant="danger" loading={cancelInvoice.isPending} onClick={cancel}>
                Cancel invoice
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardBody className="text-sm space-y-1">
                <div className="text-xs font-semibold uppercase text-slate-400">Supplier</div>
                <div className="font-semibold text-slate-900">{inv.supplier_name}</div>
                <div className="font-mono text-xs">GSTIN {inv.supplier_gstin}</div>
                {inv.supplier_address && <div className="text-slate-500">{inv.supplier_address}</div>}
                <div className="text-slate-500">State: {stateName(inv.supplier_state_code)}</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-sm space-y-1">
                <div className="text-xs font-semibold uppercase text-slate-400">Bill to</div>
                <div className="font-semibold text-slate-900">{inv.buyer_name}</div>
                <div className="font-mono text-xs">{inv.buyer_gstin ? `GSTIN ${inv.buyer_gstin}` : 'Unregistered (B2C)'}</div>
                {inv.buyer_address && <div className="text-slate-500">{inv.buyer_address}</div>}
                <div className="text-slate-500">Place of supply: {stateName(inv.place_of_supply)}</div>
              </CardBody>
            </Card>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                    <th className="text-left px-4 py-3">#</th>
                    <th className="text-left px-4 py-3">Description</th>
                    <th className="text-left px-4 py-3">HSN</th>
                    <th className="text-right px-4 py-3">Qty</th>
                    <th className="text-right px-4 py-3">Rate</th>
                    <th className="text-right px-4 py-3">Taxable</th>
                    <th className="text-right px-4 py-3">GST</th>
                    <th className="text-right px-4 py-3">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {lines.map((l, i) => (
                    <tr key={l.id}>
                      <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-3 text-slate-900">{l.description}</td>
                      <td className="px-4 py-3 font-mono text-xs">{l.hsn_code ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatQty(l.qty, l.unit_name)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(l.rate)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(l.taxable_value)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs text-slate-500">
                        {l.gst_rate}%
                        <div>
                          {inv.is_interstate
                            ? formatCurrency(l.igst_amount)
                            : `${formatCurrency(l.cgst_amount)} + ${formatCurrency(l.sgst_amount)}`}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(l.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-900">Payments received</h3>
            </CardHeader>
            {payments.length === 0 ? (
              <CardBody className="text-sm text-slate-400">No payments applied yet.</CardBody>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-50">
                  {payments.map((a) => (
                    <tr key={a.id}>
                      <td className="px-5 py-3 font-mono text-xs">{a.receipt?.receipt_no}</td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(a.receipt?.receipt_date)}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {paymentModeLabel(a.receipt?.mode ?? '')}
                        {a.receipt?.reference ? ` · ${a.receipt.reference}` : ''}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-medium">{formatCurrency(a.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {creditNotes.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-slate-900">Credit notes</h3>
              </CardHeader>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-50">
                  {creditNotes.map((n) => (
                    <tr key={n.id} className={n.status === 'cancelled' ? 'opacity-50' : undefined}>
                      <td className="px-5 py-3">
                        <Link href={`/credit-notes/${n.id}` as Route} className="font-mono text-xs text-blue-600 hover:underline">
                          {n.credit_note_no}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(n.note_date)}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {creditNoteReasonLabel(n.reason)}
                        {n.restocked ? ' · restocked' : ''}
                        {n.status === 'cancelled' ? ' · cancelled' : ''}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-medium">{formatCurrency(n.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-2 text-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500">Status</span>
                <InvoiceStatusBadge invoice={inv} />
              </div>
              <Line label="Taxable value" value={inv.taxable_value} />
              {inv.is_interstate ? (
                <Line label="IGST" value={inv.igst_amount} />
              ) : (
                <>
                  <Line label="CGST" value={inv.cgst_amount} />
                  <Line label="SGST" value={inv.sgst_amount} />
                </>
              )}
              {inv.round_off !== 0 && <Line label="Round off" value={inv.round_off} />}
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                <span>Invoice total</span>
                <span className="tabular-nums">{formatCurrency(inv.total_amount)}</span>
              </div>
              <p className="text-xs text-slate-500">{amountInWords(inv.total_amount)}</p>
              <Line label="Paid" value={inv.amount_paid} />
              {inv.amount_credited > 0 && <Line label="Credit notes" value={inv.amount_credited} />}
              <div className="flex justify-between font-semibold">
                <span>Balance due</span>
                <span className={`tabular-nums ${balance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                  {formatCurrency(balance)}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Due date</span>
                <span>{formatDate(inv.due_date)}</span>
              </div>
              {inv.reverse_charge && <p className="text-xs text-amber-700">Tax payable on reverse charge</p>}
              {inv.status === 'issued' && (
                <p className="text-xs text-slate-400 pt-1">
                  Credit notes allowed until {formatDate(deadline)} (CGST Act s.34)
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="text-sm space-y-2">
              <div className="text-xs font-semibold uppercase text-slate-400">Linked documents</div>
              {inv.sales_order && (
                <Link href={`/sales-orders/${inv.sales_order.id}` as Route} className="block text-blue-600 hover:underline">
                  {inv.sales_order.so_number}
                </Link>
              )}
              {inv.delivery_challans.map((c) => (
                <Link key={c.id} href={`/dispatch/${c.id}` as Route} className="block text-blue-600 hover:underline">
                  {c.challan_no} · {formatDate(c.challan_date)}
                </Link>
              ))}
              {inv.status === 'cancelled' && inv.delivery_challans.length === 0 && (
                <p className="text-slate-400">Challans released on cancellation.</p>
              )}
              {inv.notes && <p className="text-slate-600 pt-2 border-t border-slate-100">{inv.notes}</p>}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <span className="tabular-nums">{formatCurrency(value)}</span>
    </div>
  )
}
