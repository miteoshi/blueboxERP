'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { PageLoader } from '@/components/ui/spinner'
import { useCompanyProfile, useCreateInvoice, useGstStates, useUninvoicedChallans } from '@/lib/hooks/use-finance'
import { useCanBill, useIsAdmin } from '@/lib/hooks/use-profile'
import { formatCurrency, formatDate, formatQty, todayISO } from '@/lib/utils/format'
import { amountInWords } from '@/lib/gst'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft, Receipt } from 'lucide-react'

// Same rounding as create_sales_invoice(): per line, to the paisa
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <NewInvoice />
    </Suspense>
  )
}

function NewInvoice() {
  const router = useRouter()
  const params = useSearchParams()
  const canBill = useCanBill()
  const isAdmin = useIsAdmin()

  const { data: company, isLoading: loadingCompany } = useCompanyProfile()
  const { data: challans, isLoading: loadingChallans } = useUninvoicedChallans()
  const { data: gstStates } = useGstStates()
  const createInvoice = useCreateInvoice()

  // Pre-select from ?challan= or ?so= (e.g. the "Create invoice" button on a challan)
  const preChallan = params.get('challan')
  const preSo = params.get('so')

  const [clientId, setClientId] = useState<string>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [initialised, setInitialised] = useState(false)
  const [invoiceDate, setInvoiceDate] = useState(todayISO)
  const [notes, setNotes] = useState('')
  const [reverseCharge, setReverseCharge] = useState(false)

  if (!initialised && challans) {
    setInitialised(true)
    const seed = challans.filter((c) => c.id === preChallan || (preSo && c.so_id === preSo))
    if (seed.length > 0) {
      setClientId(seed[0].client_id)
      setSelected(new Set(seed.filter((c) => c.client_id === seed[0].client_id).map((c) => c.id)))
    }
  }

  const clients = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number; value: number }>()
    for (const c of challans ?? []) {
      const entry = map.get(c.client_id) ?? { id: c.client_id, name: c.client?.name ?? '—', count: 0, value: 0 }
      entry.count += 1
      entry.value += c.total_amount ?? 0
      map.set(c.client_id, entry)
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [challans])

  const clientChallans = useMemo(
    () => (challans ?? []).filter((c) => c.client_id === clientId),
    [challans, clientId]
  )
  const client = clientChallans[0]?.client ?? null
  const chosen = clientChallans.filter((c) => selected.has(c.id))

  const sellerState = company?.state_code ?? null
  const placeOfSupply = client?.state_code ?? (client?.gst_number ? client.gst_number.slice(0, 2) : null)
  const interstate = !!sellerState && !!placeOfSupply && sellerState !== placeOfSupply
  const stateName = (code: string | null) => gstStates?.find((s) => s.code === code)?.name ?? code ?? '—'

  const preview = useMemo(() => {
    const lines = chosen.flatMap((c) =>
      c.delivery_challan_lines.map((l) => {
        const taxable = round2(l.qty * (l.rate ?? 0))
        const rate = Number(l.so_line?.gst_percent ?? 18)
        const cgst = interstate ? 0 : round2((taxable * rate) / 200)
        const igst = interstate ? round2((taxable * rate) / 100) : 0
        return {
          key: l.id,
          challan: c.challan_no,
          name: l.item?.name ?? '—',
          hsn: l.item?.hsn_code ?? null,
          qty: l.qty,
          rate: l.rate ?? 0,
          gstRate: rate,
          taxable,
          cgst,
          sgst: cgst,
          igst,
        }
      })
    )
    const taxable = lines.reduce((s, l) => s + l.taxable, 0)
    const cgst = lines.reduce((s, l) => s + l.cgst, 0)
    const sgst = lines.reduce((s, l) => s + l.sgst, 0)
    const igst = lines.reduce((s, l) => s + l.igst, 0)
    const exact = round2(taxable + cgst + sgst + igst)
    const total = Math.round(exact)
    return { lines, taxable, cgst, sgst, igst, roundOff: round2(total - exact), total }
  }, [chosen, interstate])

  const missingHsn = client?.gst_number
    ? [...new Set(preview.lines.filter((l) => !l.hsn).map((l) => l.name))]
    : []

  const blockers: { text: string; href?: string; cta?: string }[] = []
  if (!loadingCompany && (!company?.gst_number || !company?.state_code)) {
    blockers.push({
      text: 'Your company GSTIN is not set, so tax invoices cannot be issued yet.',
      href: isAdmin ? '/settings?tab=Company' : undefined,
      cta: 'Add company GSTIN',
    })
  }
  if (client && !placeOfSupply) {
    blockers.push({
      text: `${client.name} has no state set — it decides CGST + SGST or IGST.`,
      href: '/clients',
      cta: 'Edit client',
    })
  }
  if (missingHsn.length > 0) {
    blockers.push({
      text: `HSN code missing for ${missingHsn.join(', ')} (required on B2B invoices).`,
      href: '/items',
      cta: 'Open items',
    })
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit() {
    if (chosen.length === 0) {
      toast.error('Select at least one challan')
      return
    }
    try {
      const res = await createInvoice.mutateAsync({
        challanIds: chosen.map((c) => c.id),
        invoiceDate,
        notes: notes.trim() || undefined,
        reverseCharge,
      })
      toast.success(
        res.advance_applied > 0
          ? `Invoice ${res.invoice_no} issued — ${formatCurrency(res.advance_applied)} advance applied`
          : `Invoice ${res.invoice_no} issued`
      )
      router.push(`/invoices/${res.id}` as Route)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not create the invoice')
    }
  }

  if (!canBill) {
    return <p className="text-sm text-slate-500">Only admin, manager or sales users can raise invoices.</p>
  }
  if (loadingChallans || loadingCompany) return <PageLoader />

  return (
    <div>
      <PageHeader title="New Tax Invoice" description="Bill delivered goods — one invoice can cover several challans for the same client">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </PageHeader>

      {clients.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center text-sm text-slate-500">
            Every dispatched challan has been invoiced. New challans appear here once goods are dispatched.
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-slate-900">1. Client & challans</h3>
              </CardHeader>
              <CardBody className="space-y-4">
                <select
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value)
                    setSelected(new Set((challans ?? []).filter((c) => c.client_id === e.target.value).map((c) => c.id)))
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.count} challan{c.count === 1 ? '' : 's'} ({formatCurrency(c.value)})
                    </option>
                  ))}
                </select>

                {clientChallans.length > 0 && (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                    {clientChallans.map((c) => (
                      <label key={c.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          onChange={() => toggle(c.id)}
                          className="w-4 h-4 rounded border-slate-300"
                        />
                        <div className="flex-1">
                          <div className="font-mono text-sm font-semibold text-slate-900">{c.challan_no}</div>
                          <div className="text-xs text-slate-500">
                            {formatDate(c.challan_date)}
                            {c.sales_order && ` · ${c.sales_order.so_number}`} · {c.delivery_challan_lines.length} line
                            {c.delivery_challan_lines.length === 1 ? '' : 's'} · {c.status}
                          </div>
                        </div>
                        <div className="tabular-nums text-sm text-slate-700">{formatCurrency(c.total_amount)}</div>
                      </label>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            {preview.lines.length > 0 && (
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-slate-900">2. Preview</h3>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                        <th className="text-left px-4 py-2">Item</th>
                        <th className="text-left px-4 py-2">HSN</th>
                        <th className="text-right px-4 py-2">Qty</th>
                        <th className="text-right px-4 py-2">Rate</th>
                        <th className="text-right px-4 py-2">Taxable</th>
                        <th className="text-right px-4 py-2">GST</th>
                        <th className="text-right px-4 py-2">{interstate ? 'IGST' : 'CGST + SGST'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {preview.lines.map((l) => (
                        <tr key={l.key}>
                          <td className="px-4 py-2">
                            <div className="text-slate-900">{l.name}</div>
                            <div className="text-xs text-slate-400 font-mono">{l.challan}</div>
                          </td>
                          <td className="px-4 py-2 font-mono text-xs">
                            {l.hsn ?? <span className="text-amber-600">missing</span>}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">{formatQty(l.qty)}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(l.rate)}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(l.taxable)}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{l.gstRate}%</td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {formatCurrency(interstate ? l.igst : l.cgst + l.sgst)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            {blockers.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                {blockers.map((b) => (
                  <div key={b.text} className="flex gap-2 text-sm text-amber-800">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      {b.text}{' '}
                      {b.href && (
                        <Link href={b.href as Route} className="font-medium underline">
                          {b.cta}
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Card>
              <CardHeader>
                <h3 className="font-semibold text-slate-900">3. Invoice</h3>
              </CardHeader>
              <CardBody className="space-y-4">
                <Input
                  label="Invoice date"
                  type="date"
                  value={invoiceDate}
                  max={todayISO()}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
                {client && (
                  <div className="text-sm space-y-1 rounded-lg bg-slate-50 p-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Buyer</span>
                      <span className="font-medium text-slate-900 text-right">{client.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">GSTIN</span>
                      <span className="font-mono text-xs">{client.gst_number ?? 'Unregistered (B2C)'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Place of supply</span>
                      <span>{placeOfSupply ? `${placeOfSupply} — ${stateName(placeOfSupply)}` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tax</span>
                      <span className="font-medium">{interstate ? 'IGST (inter-state)' : 'CGST + SGST (intra-state)'}</span>
                    </div>
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={reverseCharge}
                    onChange={(e) => setReverseCharge(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  Tax payable on reverse charge
                </label>
                <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </CardBody>
            </Card>

            {preview.lines.length > 0 && (
              <Card>
                <CardBody className="space-y-2 text-sm">
                  <Row label="Taxable value" value={preview.taxable} />
                  {interstate ? (
                    <Row label="IGST" value={preview.igst} />
                  ) : (
                    <>
                      <Row label="CGST" value={preview.cgst} />
                      <Row label="SGST" value={preview.sgst} />
                    </>
                  )}
                  {preview.roundOff !== 0 && <Row label="Round off" value={preview.roundOff} />}
                  <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
                    <span>Invoice total</span>
                    <span className="tabular-nums">{formatCurrency(preview.total)}</span>
                  </div>
                  <p className="text-xs text-slate-500">{amountInWords(preview.total)}</p>
                  <Button
                    className="w-full mt-2"
                    loading={createInvoice.isPending}
                    disabled={blockers.length > 0 || chosen.length === 0}
                    onClick={submit}
                  >
                    <Receipt className="w-4 h-4" />
                    Issue invoice
                  </Button>
                  <p className="text-xs text-slate-400">
                    Numbers are assigned in sequence for the financial year. Any advance paid on the sales order is applied automatically.
                  </p>
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <span className="tabular-nums">{formatCurrency(value)}</span>
    </div>
  )
}
