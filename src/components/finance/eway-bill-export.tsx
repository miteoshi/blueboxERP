'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  EWAY_BILL_THRESHOLD,
  buildEwayBillJson,
  ewayBillProblems,
  type EwayInvoice,
  type EwayParty,
} from '@/lib/eway-bill'
import { formatCurrency } from '@/lib/utils/format'
import { AlertTriangle, Download, Truck } from 'lucide-react'

/**
 * Prepares the JSON file for "Generate Bulk" on the e-way bill portal.
 * Nothing is sent anywhere: the user uploads the file themselves and the
 * portal issues the e-way bill number.
 */
export function EwayBillExport({
  invoice,
  from,
  to,
  defaultVehicleNo,
}: {
  invoice: EwayInvoice
  from: EwayParty
  to: EwayParty
  defaultVehicleNo?: string | null
}) {
  const overThreshold = Number(invoice.total_amount) > EWAY_BILL_THRESHOLD
  const [open, setOpen] = useState(false)
  const [distance, setDistance] = useState('')
  const [vehicleNo, setVehicleNo] = useState(defaultVehicleNo ?? '')
  const [transporterId, setTransporterId] = useState('')
  const [transporterName, setTransporterName] = useState('')

  const transport = useMemo(
    () => ({ distanceKm: Number(distance), vehicleNo, transporterId, transporterName }),
    [distance, vehicleNo, transporterId, transporterName]
  )
  const problems = useMemo(() => ewayBillProblems(invoice, from, to, transport), [invoice, from, to, transport])

  function download() {
    const json = JSON.stringify(buildEwayBillJson(invoice, from, to, transport), null, 2)
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `eway-bill-${invoice.invoice_no.replace(/[^A-Za-z0-9]+/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!open) {
    return (
      <div
        className={`mb-6 rounded-xl border px-4 py-3 text-sm flex flex-wrap items-center gap-3 ${
          overThreshold ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-600'
        }`}
      >
        {overThreshold ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Truck className="w-4 h-4 shrink-0" />}
        <span className="flex-1 min-w-[220px]">
          {overThreshold
            ? `This consignment is worth ${formatCurrency(invoice.total_amount)}, over ${formatCurrency(EWAY_BILL_THRESHOLD)} — an e-way bill is needed before the goods move.`
            : `Under ${formatCurrency(EWAY_BILL_THRESHOLD)}, so an e-way bill is not normally needed. Some states set a different limit for movement within the state.`}
        </span>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Prepare e-way bill file
        </Button>
      </div>
    )
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <h3 className="text-sm font-semibold text-slate-900">E-way bill file</h3>
        <p className="text-xs text-slate-500 mt-0.5">For Generate Bulk on ewaybillgst.gov.in — goods moved by road</p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            label="Distance (km)"
            type="number"
            min="1"
            max="4000"
            step="1"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
          />
          <Input
            label="Vehicle number"
            placeholder="GJ06AB1234"
            value={vehicleNo}
            onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
          />
          <Input
            label="Transporter ID (optional)"
            placeholder="Transporter's GSTIN"
            value={transporterId}
            onChange={(e) => setTransporterId(e.target.value.toUpperCase())}
          />
          <Input
            label="Transporter name (optional)"
            value={transporterName}
            onChange={(e) => setTransporterName(e.target.value)}
          />
        </div>

        {problems.length > 0 && (
          <ul className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 space-y-1">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={download} disabled={problems.length > 0}>
            <Download className="w-4 h-4" />
            Download JSON
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <span className="text-xs text-slate-500">
            Upload it under e-Waybill → Generate Bulk. The portal checks the file again and issues the e-way bill number.
          </span>
        </div>
      </CardBody>
    </Card>
  )
}
