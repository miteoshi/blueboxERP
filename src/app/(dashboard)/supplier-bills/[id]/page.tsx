'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Textarea } from '@/components/ui/input'
import { PageLoader } from '@/components/ui/spinner'
import { SupplierPaymentForm } from '@/components/payables/payment-form'
import { paymentModeLabel } from '@/lib/hooks/use-finance'
import { BILL_STATE, billState, debitNoteReasonLabel, useCancelSupplierBill, useSupplierBill } from '@/lib/hooks/use-payables'
import { useCan } from '@/lib/hooks/use-profile'
import { formatCurrency, formatDate, formatDateTime, formatQty, todayISO } from '@/lib/utils/format'
import { toast } from 'sonner'
import { ArrowLeft, Undo2, Wallet, XCircle } from 'lucide-react'

export default function SupplierBillDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: bill, isLoading } = useSupplierBill(id)
  const canManage = useCan('managePayables')
  const cancelBill = useCancelSupplierBill()
  const [panel, setPanel] = useState<'pay' | 'cancel' | null>(null)
  const [reason, setReason] = useState('')

  if (isLoading) return <PageLoader />
  if (!bill) return <p className="text-sm text-slate-500">Bill not found.</p>

  const state = billState(bill, todayISO())
  const st = BILL_STATE[state]
  const lines = [...bill.supplier_bill_lines].sort((a, b) => a.sort_order - b.sort_order)
  const payments = bill.supplier_payment_allocations.filter((a) => a.payment?.status === 'active')
  const notes = [...(bill.debit_notes ?? [])].sort((a, b) => a.debit_note_no.localeCompare(b.debit_note_no))
  const issuedNotes = notes.filter((n) => n.status === 'issued')
  const balance = bill.balance_due ?? 0
  const posted = bill.status === 'posted'

  function cancel() {
    if (!bill) return
    if (!reason.trim()) {
      toast.error('Give a reason')
      return
    }
    cancelBill.mutate({ id: bill.id, reason: reason.trim() }, { onSuccess: () => setPanel(null) })
  }

  return (
    <div>
      <PageHeader
        title={bill.bill_no}
        description={`${bill.supplier?.name ?? ''} · invoice ${bill.supplier_invoice_no} · ${formatDate(bill.bill_date)}`}
      >
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        {posted && balance > 0 && canManage && (
          <Button size="sm" onClick={() => setPanel(panel === 'pay' ? null : 'pay')}>
            <Wallet className="w-4 h-4" />
            Record payment
          </Button>
        )}
        {posted && canManage && (
          <Link href={`/debit-notes/new?bill=${bill.id}` as Route}>
            <Button variant="outline" size="sm">
              <Undo2 className="w-4 h-4" />
              Raise debit note
            </Button>
          </Link>
        )}
        {posted && canManage && (
          <Button variant="outline" size="sm" className="text-red-600" onClick={() => setPanel(panel === 'cancel' ? null : 'cancel')}>
            <XCircle className="w-4 h-4" />
            Cancel bill
          </Button>
        )}
      </PageHeader>

      {!posted && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Cancelled{bill.cancelled_at ? ` ${formatDateTime(bill.cancelled_at)}` : ''}
          {bill.canceller?.full_name ? ` by ${bill.canceller.full_name}` : ''}
          {bill.cancel_reason ? ` — ${bill.cancel_reason}` : ''}. The goods can be billed again.
        </div>
      )}

      {panel === 'pay' && (
        <SupplierPaymentForm
          supplierId={bill.supplier_id}
          bill={{ id: bill.id, bill_no: bill.bill_no, balance_due: balance }}
          onDone={() => setPanel(null)}
        />
      )}

      {panel === 'cancel' && (
        <Card className="mb-6 border-red-200">
          <CardBody className="space-y-3">
            <Textarea
              label="Why cancel this bill?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. entered against the wrong GRN"
              rows={2}
            />
            <p className="text-xs text-slate-500">
              {bill.amount_paid > 0
                ? 'This bill has payments against it. Cancel those payments first.'
                : issuedNotes.length > 0
                  ? `This bill has ${issuedNotes.map((n) => n.debit_note_no).join(', ')} against it. Cancel those first.`
                  : 'The received goods become unbilled again. The bill number stays reserved.'}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setPanel(null)}>
                Keep bill
              </Button>
              <Button variant="danger" loading={cancelBill.isPending} onClick={cancel}>
                Cancel bill
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                    <th className="text-left px-4 py-3">Item</th>
                    <th className="text-left px-4 py-3">GRN</th>
                    <th className="text-right px-4 py-3">Qty</th>
                    <th className="text-right px-4 py-3">Rate</th>
                    <th className="text-right px-4 py-3">Taxable</th>
                    <th className="text-right px-4 py-3">GST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {lines.map((l) => {
                    const grnRate = l.grn_line?.rate
                    const variance = grnRate != null && Number(grnRate) !== Number(l.rate)
                    return (
                      <tr key={l.id}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{l.item?.name}</div>
                          <div className="text-xs text-slate-400 font-mono">
                            {l.item?.item_code}
                            {l.item?.hsn_code ? ` · HSN ${l.item.hsn_code}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {l.grn_line?.receipt && (
                            <Link href={`/inbound/${l.grn_line.receipt.id}` as Route} className="font-mono text-xs text-blue-600 hover:underline">
                              {l.grn_line.receipt.receipt_no}
                            </Link>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatQty(l.qty, l.unit?.name)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatCurrency(l.rate)}
                          {variance && <div className="text-xs text-amber-700">GRN {formatCurrency(grnRate)}</div>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(l.taxable_value)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatCurrency(l.gst_amount)}
                          <div className="text-xs text-slate-400">{l.gst_percent}%</div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-slate-900">Debit notes</h3>
            </CardHeader>
            <CardBody className="p-0">
              {notes.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-400">None against this bill.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-50">
                    {notes.map((n) => (
                      <tr key={n.id} className={n.status === 'cancelled' ? 'opacity-60' : ''}>
                        <td className="px-5 py-3">
                          <Link href={`/debit-notes/${n.id}` as Route} className="font-mono text-blue-600 hover:underline">
                            {n.debit_note_no}
                          </Link>
                          <div className="text-xs text-slate-400">{formatDate(n.note_date)}</div>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500">
                          {debitNoteReasonLabel(n.reason)}
                          {n.returned_stock ? ' · stock sent back' : ''}
                          {n.status === 'cancelled' ? ' · cancelled' : ''}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums font-medium">{formatCurrency(n.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-slate-900">Payments</h3>
            </CardHeader>
            <CardBody className="p-0">
              {payments.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-400">No payments yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-50">
                    {payments.map((a) => (
                      <tr key={a.id}>
                        <td className="px-5 py-3">
                          <span className="font-mono">{a.payment?.payment_no}</span>
                          <div className="text-xs text-slate-400">{formatDate(a.payment?.payment_date)}</div>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500">
                          {paymentModeLabel(a.payment?.mode ?? '')}
                          {a.payment?.reference ? ` · ${a.payment.reference}` : ''}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums font-medium">{formatCurrency(a.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-2 text-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500">Status</span>
                <Badge variant={st.variant}>{st.label}</Badge>
              </div>
              <Line label="Taxable value" value={bill.taxable_value} />
              {bill.is_interstate ? (
                <Line label="IGST" value={bill.igst_amount} />
              ) : (
                <>
                  <Line label="CGST" value={bill.cgst_amount} />
                  <Line label="SGST" value={bill.sgst_amount} />
                </>
              )}
              {bill.round_off !== 0 && <Line label="Round-off" value={bill.round_off} />}
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                <span>Bill total</span>
                <span className="tabular-nums">{formatCurrency(bill.total_amount)}</span>
              </div>
              {bill.amount_debited > 0 && <Line label="Debit notes" value={-bill.amount_debited} />}
              <Line label="Paid" value={bill.amount_paid} />
              {posted && (
                <div className={`flex justify-between font-semibold ${balance > 0 ? 'text-slate-900' : 'text-teal-700'}`}>
                  <span>Balance due</span>
                  <span className="tabular-nums">{formatCurrency(balance)}</span>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="text-sm space-y-2">
              <Meta label="Supplier" value={bill.supplier?.name ?? '—'} />
              {bill.supplier_gstin && <Meta label="GSTIN" value={bill.supplier_gstin} />}
              <Meta label="Their invoice no." value={bill.supplier_invoice_no} />
              <Meta label="Invoice date" value={formatDate(bill.bill_date)} />
              <Meta label="Due date" value={formatDate(bill.due_date)} />
              <Meta label="Entered by" value={bill.creator?.full_name ?? '—'} />
              {bill.notes && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-xs font-semibold uppercase text-slate-400 mb-1">Notes</div>
                  <p className="text-slate-600 whitespace-pre-line">{bill.notes}</p>
                </div>
              )}
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

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900 text-right">{value}</span>
    </div>
  )
}
