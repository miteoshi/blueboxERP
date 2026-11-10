'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { PageLoader } from '@/components/ui/spinner'
import {
  poStatus,
  useClosePurchaseOrder,
  useIssuePurchaseOrder,
  usePurchaseOrder,
  useReceivePurchaseOrder,
} from '@/lib/hooks/use-purchasing'
import { useCan } from '@/lib/hooks/use-profile'
import { formatCurrency, formatDate, formatDateTime, formatQty, isPastDate, todayISO } from '@/lib/utils/format'
import { amountInWords } from '@/lib/gst'
import type { Enums } from '@/lib/types/database'
import { toast } from 'sonner'
import { ArrowLeft, PackageCheck, Pencil, Printer, Send, XCircle } from 'lucide-react'

type TransportMode = Enums<'transport_mode'>

const TRANSPORT_OPTIONS: { value: TransportMode; label: string }[] = [
  { value: 'supplier_truck', label: 'Supplier truck' },
  { value: 'own_truck', label: 'Our truck' },
  { value: 'courier', label: 'Courier' },
  { value: 'hand_delivery', label: 'Hand delivery' },
  { value: 'client_truck', label: 'Client truck' },
]

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: po, isLoading } = usePurchaseOrder(id)
  const canDraft = useCan('draftPurchaseOrders')
  const canApprove = useCan('approvePurchaseOrders')
  const canReceive = useCan('receiveGoods')
  const issuePo = useIssuePurchaseOrder()
  const closePo = useClosePurchaseOrder()

  const [panel, setPanel] = useState<'receive' | 'close' | null>(null)
  const [reason, setReason] = useState('')

  if (isLoading) return <PageLoader />
  if (!po) return <p className="text-sm text-slate-500">Purchase order not found.</p>

  const st = poStatus(po.status)
  const lines = [...po.purchase_order_lines].sort((a, b) => a.sort_order - b.sort_order)
  const grns = [...(po.inbound_receipts ?? [])].sort((a, b) => a.receipt_no.localeCompare(b.receipt_no))
  const isOpen = po.status === 'issued' || po.status === 'partially_received'
  const canEnd = po.status === 'draft' || isOpen
  const somethingReceived = lines.some((l) => Number(l.qty_received) > 0)
  const overdue = isOpen && isPastDate(po.expected_date)
  const cgst = po.is_interstate ? 0 : round2(po.gst_amount / 2)

  function close() {
    if (!po) return
    if (!reason.trim()) {
      toast.error('Give a reason')
      return
    }
    closePo.mutate({ id: po.id, reason: reason.trim() }, { onSuccess: () => setPanel(null) })
  }

  return (
    <div>
      <PageHeader
        title={po.po_no}
        description={`Purchase order · ${po.supplier?.name ?? ''} · ${formatDate(po.po_date)}`}
      >
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        {po.status !== 'draft' && (
          <a
            href={`/api/pdf?type=purchase_order&id=${po.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700"
          >
            <Printer className="w-4 h-4" />
            Print
          </a>
        )}
        {po.status === 'draft' && canDraft && (
          <Link href={`/purchase-orders/${po.id}/edit` as Route}>
            <Button variant="outline" size="sm">
              <Pencil className="w-4 h-4" />
              Edit
            </Button>
          </Link>
        )}
        {po.status === 'draft' && canApprove && (
          <Button size="sm" loading={issuePo.isPending} onClick={() => issuePo.mutate(po.id)}>
            <Send className="w-4 h-4" />
            Issue
          </Button>
        )}
        {isOpen && canReceive && (
          <Button size="sm" onClick={() => setPanel(panel === 'receive' ? null : 'receive')}>
            <PackageCheck className="w-4 h-4" />
            Receive goods
          </Button>
        )}
        {canEnd && canApprove && (
          <Button
            variant="outline"
            size="sm"
            className="text-red-600"
            onClick={() => setPanel(panel === 'close' ? null : 'close')}
          >
            <XCircle className="w-4 h-4" />
            {somethingReceived ? 'Close short' : 'Cancel order'}
          </Button>
        )}
      </PageHeader>

      {po.status === 'draft' && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Draft — not sent to the supplier yet. {canApprove ? 'Issue it to print and receive against it.' : 'A manager or admin issues it.'}
        </div>
      )}
      {(po.status === 'closed' || po.status === 'cancelled') && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {po.status === 'closed' ? 'Closed short' : 'Cancelled'}
          {po.closed_at ? ` ${formatDateTime(po.closed_at)}` : ''}
          {po.closer?.full_name ? ` by ${po.closer.full_name}` : ''}
          {po.close_reason ? ` — ${po.close_reason}` : ''}.
          {po.status === 'closed' && ' Goods already received stay in stock; the balance will not be received.'}
        </div>
      )}
      {overdue && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Expected by {formatDate(po.expected_date)} — overdue. Follow up with the supplier.
        </div>
      )}

      {panel === 'close' && (
        <Card className="mb-6 border-red-200">
          <CardBody className="space-y-3">
            <Textarea
              label={somethingReceived ? 'Why close the rest of this order?' : 'Why cancel this order?'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={somethingReceived ? 'e.g. balance no longer needed' : 'e.g. supplier cannot deliver'}
              rows={2}
            />
            <p className="text-xs text-slate-500">
              {somethingReceived
                ? 'What has been received stays in stock. Nothing more can be received against this order.'
                : 'The number stays reserved in the series. This cannot be undone.'}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setPanel(null)}>
                Keep order open
              </Button>
              <Button variant="danger" loading={closePo.isPending} onClick={close}>
                {somethingReceived ? 'Close short' : 'Cancel order'}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {panel === 'receive' && (
        <ReceiveForm
          po={{ id: po.id, po_date: po.po_date }}
          lines={lines.map((l) => ({
            id: l.id,
            name: l.item?.name ?? '',
            code: l.item?.item_code ?? '',
            unit: l.unit?.name ?? '',
            outstanding: Math.max(Number(l.qty) - Number(l.qty_received), 0),
          }))}
          onDone={() => setPanel(null)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                    <th className="text-left px-4 py-3">#</th>
                    <th className="text-left px-4 py-3">Item</th>
                    <th className="text-right px-4 py-3">Ordered</th>
                    <th className="text-right px-4 py-3">Received</th>
                    <th className="text-right px-4 py-3">Pending</th>
                    <th className="text-right px-4 py-3">Rate</th>
                    <th className="text-right px-4 py-3">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {lines.map((l, i) => {
                    const pending = Math.max(Number(l.qty) - Number(l.qty_received), 0)
                    return (
                      <tr key={l.id}>
                        <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{l.item?.name}</div>
                          <div className="text-xs text-slate-400 font-mono">
                            {l.item?.item_code}
                            {l.item?.hsn_code ? ` · HSN ${l.item.hsn_code}` : ''}
                          </div>
                          {l.notes && <div className="text-xs text-slate-500">{l.notes}</div>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatQty(l.qty, l.unit?.name)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatQty(l.qty_received)}</td>
                        <td
                          className={`px-4 py-3 text-right tabular-nums ${
                            pending > 0 && isOpen ? 'text-amber-700 font-medium' : 'text-slate-400'
                          }`}
                        >
                          {pending > 0 ? formatQty(pending) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatCurrency(l.rate)}
                          <div className="text-xs text-slate-400">GST {l.gst_percent}%</div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(l.line_total)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-slate-900">Goods received against this order</h3>
            </CardHeader>
            <CardBody className="p-0">
              {grns.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-400">Nothing received yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-50">
                    {grns.map((g) => (
                      <tr key={g.id}>
                        <td className="px-5 py-3">
                          <Link href={`/inbound/${g.id}` as Route} className="font-mono text-blue-600 hover:underline">
                            {g.receipt_no}
                          </Link>
                          <div className="text-xs text-slate-400">{formatDate(g.receipt_date)}</div>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500">
                          {g.challan_no && <div>Challan {g.challan_no}</div>}
                          {g.invoice_no && <div>Invoice {g.invoice_no}</div>}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {formatCurrency(g.total_amount)}
                          {(g.gst_amount ?? 0) > 0 && (
                            <div className="text-xs text-slate-400">+{formatCurrency(g.gst_amount)} GST</div>
                          )}
                        </td>
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
              <Line label="Taxable value" value={po.taxable_value} />
              {po.is_interstate ? (
                <Line label="IGST" value={po.gst_amount} />
              ) : (
                <>
                  <Line label="CGST" value={cgst} />
                  <Line label="SGST" value={po.gst_amount - cgst} />
                </>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                <span>Order total</span>
                <span className="tabular-nums">{formatCurrency(po.total_amount)}</span>
              </div>
              <p className="text-xs text-slate-500">{amountInWords(po.total_amount)}</p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="text-sm space-y-1">
              <div className="text-xs font-semibold uppercase text-slate-400">Supplier</div>
              <div className="font-semibold text-slate-900">{po.supplier?.name}</div>
              {po.supplier?.gst_number && <div className="font-mono text-xs">GSTIN {po.supplier.gst_number}</div>}
              {po.supplier?.contact_person && <div className="text-slate-500">{po.supplier.contact_person}</div>}
              {po.supplier?.phone && <div className="text-slate-500">{po.supplier.phone}</div>}
              {po.supplier?.email && <div className="text-slate-500">{po.supplier.email}</div>}
              {(po.supplier?.address || po.supplier?.city) && (
                <div className="text-slate-500">{[po.supplier?.address, po.supplier?.city].filter(Boolean).join(', ')}</div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="text-sm space-y-2">
              <Meta label="Order date" value={formatDate(po.po_date)} />
              <Meta label="Expected" value={po.expected_date ? formatDate(po.expected_date) : '—'} />
              <Meta label="Created by" value={po.creator?.full_name ?? '—'} />
              {po.issued_at && (
                <Meta label="Issued" value={`${formatDateTime(po.issued_at)}${po.issuer?.full_name ? ` · ${po.issuer.full_name}` : ''}`} />
              )}
              {po.terms && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-xs font-semibold uppercase text-slate-400 mb-1">Terms</div>
                  <p className="text-slate-600 whitespace-pre-line">{po.terms}</p>
                </div>
              )}
              {po.notes && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-xs font-semibold uppercase text-slate-400 mb-1">Internal notes</div>
                  <p className="text-slate-600 whitespace-pre-line">{po.notes}</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ReceiveForm({
  po,
  lines,
  onDone,
}: {
  po: { id: string; po_date: string }
  lines: { id: string; name: string; code: string; unit: string; outstanding: number }[]
  onDone: () => void
}) {
  const receive = useReceivePurchaseOrder()
  const open = lines.filter((l) => l.outstanding > 0)
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(open.map((l) => [l.id, String(l.outstanding)])),
  )
  const [receiptDate, setReceiptDate] = useState(todayISO)
  const [transportMode, setTransportMode] = useState<TransportMode>('supplier_truck')
  const [vehicleNo, setVehicleNo] = useState('')
  const [driverName, setDriverName] = useState('')
  const [challanNo, setChallanNo] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [notes, setNotes] = useState('')

  function submit() {
    if (receiptDate > todayISO()) return toast.error('Receipt date cannot be in the future')
    if (receiptDate < po.po_date) return toast.error('Receipt date cannot be before the order date')
    const entries = open
      .map((l) => ({ line: l, value: Number(qty[l.id] || 0) }))
      .filter((e) => e.value !== 0)
    if (entries.length === 0) return toast.error('Enter the quantity received for at least one item')
    for (const e of entries) {
      if (!(e.value > 0)) return toast.error(`Quantity for ${e.line.name} must be greater than zero`)
      if (e.value > e.line.outstanding + 1e-6) {
        return toast.error(`Only ${formatQty(e.line.outstanding, e.line.unit)} of ${e.line.name} is still on order`)
      }
    }
    receive.mutate(
      {
        id: po.id,
        lines: entries.map((e) => ({ po_line_id: e.line.id, qty: e.value })),
        receiptDate,
        transportMode,
        vehicleNo,
        driverName,
        challanNo,
        invoiceNo,
        notes,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <Card className="mb-6 border-teal-200">
      <CardHeader>
        <h3 className="text-sm font-semibold text-slate-900">Receive goods</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Creates a GRN at the order&apos;s rates and adds the goods to stock. Receive part now and the rest later if needed.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-semibold text-slate-500 border-b border-slate-100">
                <th className="text-left py-2">Item</th>
                <th className="text-right py-2 w-32">Still on order</th>
                <th className="text-right py-2 w-36">Received now</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {open.map((l) => (
                <tr key={l.id}>
                  <td className="py-2">
                    <div className="font-medium text-slate-900">{l.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{l.code}</div>
                  </td>
                  <td className="py-2 text-right tabular-nums text-slate-600">{formatQty(l.outstanding, l.unit)}</td>
                  <td className="py-2">
                    <input
                      type="number"
                      min="0"
                      max={l.outstanding}
                      step="any"
                      value={qty[l.id] ?? ''}
                      onChange={(e) => setQty((p) => ({ ...p, [l.id]: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm rounded border border-slate-200 text-right focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Receipt date"
            type="date"
            min={po.po_date}
            max={todayISO()}
            value={receiptDate}
            onChange={(e) => setReceiptDate(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Transport</label>
            <select
              value={transportMode}
              onChange={(e) => setTransportMode(e.target.value as TransportMode)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TRANSPORT_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <Input label="Vehicle no." value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="e.g. GJ01AB1234" />
          <Input label="Driver" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
          <Input label="Supplier challan no." value={challanNo} onChange={(e) => setChallanNo(e.target.value)} />
          <Input label="Supplier invoice no." value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
        </div>
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Condition of goods, shortages…" />

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button loading={receive.isPending} onClick={submit}>
            <PackageCheck className="w-4 h-4" />
            Record receipt
          </Button>
        </div>
      </CardBody>
    </Card>
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
