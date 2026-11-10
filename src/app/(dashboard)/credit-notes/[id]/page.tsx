'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardBody } from '@/components/ui/card'
import { Textarea } from '@/components/ui/input'
import { PageLoader } from '@/components/ui/spinner'
import { creditNoteReasonLabel, useCancelCreditNote, useCreditNote, useGstStates } from '@/lib/hooks/use-finance'
import { useCanManageFinance } from '@/lib/hooks/use-profile'
import { formatCurrency, formatDate, formatDateTime, formatQty } from '@/lib/utils/format'
import { amountInWords } from '@/lib/gst'
import { toast } from 'sonner'
import { ArrowLeft, Printer, XCircle } from 'lucide-react'

export default function CreditNoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const canManage = useCanManageFinance()
  const { data: cn, isLoading } = useCreditNote(id)
  const { data: gstStates } = useGstStates()
  const cancelNote = useCancelCreditNote()
  const [showCancel, setShowCancel] = useState(false)
  const [reason, setReason] = useState('')

  if (isLoading) return <PageLoader />
  if (!cn) return <p className="text-sm text-slate-500">Credit note not found.</p>

  const lines = [...cn.credit_note_lines].sort((a, b) => a.sort_order - b.sort_order)
  const stateName = (code: string | null) =>
    code ? `${code} — ${gstStates?.find((s) => s.code === code)?.name ?? ''}` : '—'

  function cancel() {
    if (!cn) return
    if (!reason.trim()) {
      toast.error('Give a reason for cancelling')
      return
    }
    cancelNote.mutate({ id: cn.id, reason: reason.trim() }, { onSuccess: () => setShowCancel(false) })
  }

  return (
    <div>
      <PageHeader
        title={cn.credit_note_no}
        description={`Credit note · ${formatDate(cn.note_date)} · ${creditNoteReasonLabel(cn.reason)}`}
      >
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <a
          href={`/api/pdf?type=credit_note&id=${cn.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700"
        >
          <Printer className="w-4 h-4" />
          Print
        </a>
        {canManage && cn.status === 'issued' && (
          <Button variant="outline" size="sm" className="text-red-600" onClick={() => setShowCancel(true)}>
            <XCircle className="w-4 h-4" />
            Cancel
          </Button>
        )}
      </PageHeader>

      {cn.status === 'cancelled' && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Cancelled {cn.cancelled_at ? formatDateTime(cn.cancelled_at) : ''}
          {cn.cancel_reason ? ` — ${cn.cancel_reason}` : ''}. The invoice balance was restored; the number stays
          reserved in the series.
        </div>
      )}

      {showCancel && (
        <Card className="mb-6 border-red-200">
          <CardBody className="space-y-3">
            <Textarea
              label="Reason for cancelling"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. issued against the wrong invoice"
              rows={2}
            />
            <p className="text-xs text-slate-500">
              The invoice balance goes back up by {formatCurrency(cn.total_amount)}.
              {cn.restocked ? ' The returned goods are taken back out of stock — refused if they have since been used.' : ''}{' '}
              Payment that was moved to on-account credit stays there; apply it again from Payments if needed.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCancel(false)}>
                Keep credit note
              </Button>
              <Button variant="danger" loading={cancelNote.isPending} onClick={cancel}>
                Cancel credit note
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
                <div className="text-xs font-semibold uppercase text-slate-400">Issued to</div>
                <div className="font-semibold text-slate-900">{cn.invoice?.buyer_name ?? cn.client?.name}</div>
                <div className="font-mono text-xs">{cn.buyer_gstin ? `GSTIN ${cn.buyer_gstin}` : 'Unregistered (B2C)'}</div>
                {cn.invoice?.buyer_address && <div className="text-slate-500">{cn.invoice.buyer_address}</div>}
                <div className="text-slate-500">Place of supply: {stateName(cn.place_of_supply)}</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-sm space-y-1">
                <div className="text-xs font-semibold uppercase text-slate-400">Original invoice</div>
                {cn.invoice && (
                  <Link href={`/invoices/${cn.invoice.id}` as Route} className="font-mono text-blue-600 hover:underline">
                    {cn.invoice.invoice_no}
                  </Link>
                )}
                <div className="text-slate-500">Dated {formatDate(cn.invoice?.invoice_date)}</div>
                <div className="text-slate-500">Invoice total {formatCurrency(cn.invoice?.total_amount ?? 0)}</div>
                <div className="text-slate-500">Balance due now {formatCurrency(cn.invoice?.balance_due ?? 0)}</div>
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
                      <td className="px-4 py-3 text-right tabular-nums">
                        {l.qty != null ? formatQty(l.qty, l.unit_name) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(l.taxable_value)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs text-slate-500">
                        {l.gst_rate}%
                        <div>
                          {cn.is_interstate
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
        </div>

        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-2 text-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500">Status</span>
                <Badge variant={cn.status === 'issued' ? 'success' : 'default'}>
                  {cn.status === 'issued' ? 'Issued' : 'Cancelled'}
                </Badge>
              </div>
              <Line label="Taxable value" value={cn.taxable_value} />
              {cn.is_interstate ? (
                <Line label="IGST" value={cn.igst_amount} />
              ) : (
                <>
                  <Line label="CGST" value={cn.cgst_amount} />
                  <Line label="SGST" value={cn.sgst_amount} />
                </>
              )}
              {cn.round_off !== 0 && <Line label="Round off" value={cn.round_off} />}
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                <span>Credit note total</span>
                <span className="tabular-nums">{formatCurrency(cn.total_amount)}</span>
              </div>
              <p className="text-xs text-slate-500">{amountInWords(cn.total_amount)}</p>
              {cn.reason === 'sales_return' && (
                <p className="text-xs text-slate-500">
                  {cn.restocked ? 'Returned goods were added back to stock.' : 'Returned goods were not added to stock.'}
                </p>
              )}
              {cn.notes && <p className="text-slate-600 pt-2 border-t border-slate-100">{cn.notes}</p>}
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
