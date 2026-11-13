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
import { debitNoteReasonLabel, useCancelDebitNote, useDebitNote } from '@/lib/hooks/use-payables'
import { useCan } from '@/lib/hooks/use-profile'
import { formatCurrency, formatDate, formatDateTime, formatQty } from '@/lib/utils/format'
import { toast } from 'sonner'
import { ArrowLeft, Printer, XCircle } from 'lucide-react'

export default function DebitNoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: note, isLoading } = useDebitNote(id)
  const canManage = useCan('managePayables')
  const cancelNote = useCancelDebitNote()
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')

  if (isLoading) return <PageLoader />
  if (!note) return <p className="text-sm text-slate-500">Debit note not found.</p>

  const lines = [...note.debit_note_lines].sort((a, b) => a.sort_order - b.sort_order)
  const issued = note.status === 'issued'
  const gst = note.cgst_amount + note.sgst_amount + note.igst_amount

  function cancel() {
    if (!note) return
    if (!reason.trim()) {
      toast.error('Give a reason')
      return
    }
    cancelNote.mutate({ id: note.id, reason: reason.trim() }, { onSuccess: () => setCancelling(false) })
  }

  return (
    <div>
      <PageHeader
        title={note.debit_note_no}
        description={`Debit note · ${note.supplier?.name ?? ''} · ${formatDate(note.note_date)}`}
      >
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <a
          href={`/api/pdf?type=debit_note&id=${note.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700"
        >
          <Printer className="w-4 h-4" />
          Print
        </a>
        {issued && canManage && (
          <Button variant="outline" size="sm" className="text-red-600" onClick={() => setCancelling((c) => !c)}>
            <XCircle className="w-4 h-4" />
            Cancel note
          </Button>
        )}
      </PageHeader>

      {!issued && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Cancelled{note.cancelled_at ? ` ${formatDateTime(note.cancelled_at)}` : ''}
          {note.canceller?.full_name ? ` by ${note.canceller.full_name}` : ''}
          {note.cancel_reason ? ` — ${note.cancel_reason}` : ''}.
          {note.returned_stock && ' The goods were put back into stock.'}
        </div>
      )}

      {cancelling && (
        <Card className="mb-6 border-red-200">
          <CardBody className="space-y-3">
            <Textarea
              label="Why cancel this debit note?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. the supplier would not accept the return"
              rows={2}
            />
            <p className="text-xs text-slate-500">
              {note.bill?.bill_no} goes back up by {formatCurrency(note.total_amount)}
              {note.returned_stock ? ', and the goods come back into stock.' : '.'} The note number stays reserved.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCancelling(false)}>
                Keep note
              </Button>
              <Button variant="danger" loading={cancelNote.isPending} onClick={cancel}>
                Cancel note
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                    <th className="text-left px-4 py-3">Item</th>
                    <th className="text-right px-4 py-3">Qty</th>
                    <th className="text-right px-4 py-3">Rate</th>
                    <th className="text-right px-4 py-3">Taxable</th>
                    <th className="text-right px-4 py-3">GST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{l.item?.name}</div>
                        <div className="text-xs text-slate-400 font-mono">
                          {l.item?.item_code}
                          {l.item?.hsn_code ? ` · HSN ${l.item.hsn_code}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {l.qty ? formatQty(l.qty, l.unit?.name) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(l.rate)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(l.taxable_value)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCurrency(l.gst_amount)}
                        <div className="text-xs text-slate-400">{l.gst_percent}%</div>
                      </td>
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
                <Badge variant={issued ? 'info' : 'default'}>{issued ? 'Issued' : 'Cancelled'}</Badge>
              </div>
              <Line label="Taxable value" value={note.taxable_value} />
              {note.is_interstate ? (
                <Line label="IGST reversed" value={note.igst_amount} />
              ) : (
                <>
                  <Line label="CGST reversed" value={note.cgst_amount} />
                  <Line label="SGST reversed" value={note.sgst_amount} />
                </>
              )}
              {note.round_off !== 0 && <Line label="Round-off" value={note.round_off} />}
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                <span>Debit note total</span>
                <span className="tabular-nums">{formatCurrency(note.total_amount)}</span>
              </div>
              <p className="text-xs text-slate-500">
                {formatCurrency(gst)} of input GST comes off your credit for this period.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="text-sm space-y-2">
              <Meta label="Supplier" value={note.supplier?.name ?? '—'} />
              {note.supplier_gstin && <Meta label="GSTIN" value={note.supplier_gstin} />}
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Against bill</span>
                <Link href={`/supplier-bills/${note.bill?.id}` as Route} className="font-mono text-blue-600 hover:underline">
                  {note.bill?.bill_no}
                </Link>
              </div>
              <Meta label="Their invoice" value={note.bill?.supplier_invoice_no ?? '—'} />
              <Meta label="Reason" value={debitNoteReasonLabel(note.reason)} />
              <Meta label="Goods returned" value={note.returned_stock ? 'Yes, taken out of stock' : 'No'} />
              <Meta label="Raised by" value={note.creator?.full_name ?? '—'} />
              {note.notes && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-xs font-semibold uppercase text-slate-400 mb-1">Notes</div>
                  <p className="text-slate-600 whitespace-pre-line">{note.notes}</p>
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
