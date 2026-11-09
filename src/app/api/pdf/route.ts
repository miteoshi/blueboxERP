import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { html, raw, printScript, printableResponse, type SafeHtml } from '@/lib/pdf/html'

// ─────────────────────────────────────────────────────────────
// PDF Generation Route
// GET /api/pdf?type=quotation&id=uuid
// GET /api/pdf?type=challan&id=uuid
// GET /api/pdf?type=grn&id=uuid
//
// Returns printable HTML — the browser auto-triggers window.print().
// All document data is HTML-escaped (see lib/pdf/html.ts) and the page
// is served with a CSP that only allows the print script.
// ─────────────────────────────────────────────────────────────

type Supabase = Awaited<ReturnType<typeof createClient>>

type Organization = {
  name?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  phone?: string | null
  email?: string | null
  gst_number?: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const id = searchParams.get('id')

  if (!type || !id) {
    return NextResponse.json({ error: 'type and id are required' }, { status: 400 })
  }
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid document id' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`
      org_id,
      organizations:org_id (
        name, address, city, state, pincode, phone, email, gst_number
      )
    `)
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.org_id) {
    return NextResponse.json(
      { error: 'User is not associated with an organization' },
      { status: 403 }
    )
  }

  const org: Organization | null = profile.organizations

  try {
    switch (type) {
      case 'quotation':
        return printableResponse(await quotationPage(supabase, id, org))
      case 'challan':
        return printableResponse(await challanPage(supabase, id, org))
      case 'grn':
        return printableResponse(await grnPage(supabase, id, org))
      default:
        return NextResponse.json({ error: 'Unknown document type' }, { status: 400 })
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    const status = message.endsWith('not found') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

// ── Shared print CSS ──────────────────────────────────────────

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; background: #fff; }
  .page { max-width: 210mm; margin: 0 auto; padding: 16mm 20mm; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #1E3A5F; padding-bottom: 16px; }
  .company-name { font-size: 20px; font-weight: bold; color: #1E3A5F; }
  .company-sub  { font-size: 10px; color: #666; margin-top: 2px; }
  .doc-title    { font-size: 18px; font-weight: bold; color: #2563EB; text-align: right; }
  .doc-no       { font-size: 13px; font-family: monospace; color: #111; text-align: right; margin-top: 4px; }
  .meta-grid    { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .meta-box     { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px; }
  .meta-label   { font-size: 9px; font-weight: bold; color: #64748B; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 5px; }
  .meta-value   { font-size: 11px; color: #111; line-height: 1.7; }
  table         { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  thead th      { background: #1E3A5F; color: #fff; padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; text-align: left; }
  thead th.r    { text-align: right; }
  thead th.c    { text-align: center; }
  tbody td      { padding: 8px 10px; border-bottom: 1px solid #F1F5F9; font-size: 11px; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #F8FAFC; }
  .r            { text-align: right; }
  .c            { text-align: center; }
  .mono         { font-family: monospace; font-size: 10px; background: #F1F5F9; padding: 1px 5px; border-radius: 3px; }
  .totals       { margin-left: auto; width: 250px; border: 1px solid #E2E8F0; border-radius: 6px; overflow: hidden; }
  .totals-row   { display: flex; justify-content: space-between; padding: 6px 12px; font-size: 11px; border-bottom: 1px solid #F1F5F9; }
  .totals-row.bold { font-weight: bold; font-size: 13px; background: #EFF6FF; color: #1D4ED8; border-bottom: none; }
  .terms        { margin-top: 18px; padding-top: 14px; border-top: 1px solid #E2E8F0; font-size: 10px; color: #555; line-height: 1.7; }
  .footer       { margin-top: 32px; display: flex; justify-content: space-between; padding-top: 16px; border-top: 1px solid #E2E8F0; }
  .sign-box     { text-align: center; }
  .sign-line    { width: 150px; border-bottom: 1px solid #333; margin-bottom: 5px; height: 40px; }
  .sign-label   { font-size: 10px; color: #666; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 8mm 12mm; }
    @page { size: A4; margin: 8mm; }
  }
`

const inr = (n: number | null | undefined) =>
  n != null
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n)
    : '—'

// Document dates are plain YYYY-MM-DD; format them without a time zone shift.
const dt = (d: string | null | undefined) => {
  if (!d) return '—'
  const [y, m, day] = d.slice(0, 10).split('-').map(Number)
  if (!y || !m || !day) return '—'
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

const qtyFmt = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 }).format(n)

const lines = (...parts: (string | null | undefined | false)[]) =>
  parts.filter(Boolean).map((p) => html`${p}<br>`)

function document(title: string, body: SafeHtml): SafeHtml {
  return html`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${title}</title><style>${raw(CSS)}</style></head>
<body><div class="page">${body}</div>
${printScript}
</body></html>`
}

function organizationHeader(org: Organization | null) {
  const address = [org?.address, org?.city, org?.state, org?.pincode].filter(Boolean).join(', ')
  const contact = [org?.phone, org?.email].filter(Boolean).join(' | ')

  return html`
    <div class="company-name">${org?.name ?? 'Blue Box ERP'}</div>
    ${address ? html`<div class="company-sub">${address}</div>` : ''}
    ${contact ? html`<div class="company-sub">${contact}</div>` : ''}
    ${org?.gst_number ? html`<div class="company-sub">GSTIN: ${org.gst_number}</div>` : ''}
  `
}

function header(org: Organization | null, title: string, number: string) {
  return html`
  <div class="header">
    <div>${organizationHeader(org)}</div>
    <div>
      <div class="doc-title">${title}</div>
      <div class="doc-no">${number}</div>
    </div>
  </div>`
}

function signatures(...labels: string[]) {
  return html`
  <div class="footer">
    ${labels.map((label) => html`
    <div class="sign-box">
      <div class="sign-line"></div>
      <div class="sign-label">${label}</div>
    </div>`)}
  </div>`
}

// ── Quotation ─────────────────────────────────────────────────

async function quotationPage(supabase: Supabase, id: string, org: Organization | null) {
  const { data: qt, error } = await supabase
    .from('quotations')
    .select(`
      *,
      client:clients ( name, phone, gst_number, address, city ),
      quotation_lines (
        *,
        unit:units ( id, name ),
        item:items ( item_code, name, hsn_code )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !qt) throw new Error('Quotation not found')

  const items = [...(qt.quotation_lines ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  )

  return document(qt.quotation_no, html`
  ${header(org, 'QUOTATION', qt.quotation_no)}

  <div class="meta-grid">
    <div class="meta-box">
      <div class="meta-label">Bill To</div>
      <div class="meta-value">
        <strong>${qt.client?.name ?? '—'}</strong><br>
        ${lines(
          qt.client?.phone,
          qt.client?.gst_number && `GSTIN: ${qt.client.gst_number}`,
          [qt.client?.address, qt.client?.city].filter(Boolean).join(', '),
        )}
      </div>
    </div>

    <div class="meta-box">
      <div class="meta-label">Quotation Details</div>
      <div class="meta-value">
        <strong>Date:</strong> ${dt(qt.quotation_date)}<br>
        ${qt.valid_until ? html`<strong>Valid Until:</strong> ${dt(qt.valid_until)}<br>` : ''}
        ${qt.delivery_days ? html`<strong>Delivery:</strong> ${qt.delivery_days} working days<br>` : ''}
        ${qt.payment_terms ? html`<strong>Payment:</strong> ${qt.payment_terms}` : ''}
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:28px">#</th>
        <th>Item Description</th>
        <th class="c" style="width:55px">HSN</th>
        <th class="r" style="width:70px">Qty</th>
        <th class="c" style="width:38px">Unit</th>
        <th class="r" style="width:90px">Rate (₹)</th>
        <th class="c" style="width:38px">GST%</th>
        <th class="r" style="width:95px">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((l, i) => {
        const taxable = l.qty * l.unit_rate
        const amount = l.line_total ?? taxable * (1 + Number(l.gst_percent) / 100)
        return html`<tr>
          <td class="c">${i + 1}</td>
          <td>
            <strong>${l.description || l.item?.name || ''}</strong>
            ${l.item ? html`<br><span class="mono">${l.item.item_code}</span>` : ''}
          </td>
          <td class="c">${l.item?.hsn_code ?? '—'}</td>
          <td class="r">${qtyFmt(l.qty)}</td>
          <td class="c">${l.unit?.name ?? '—'}</td>
          <td class="r">${inr(l.unit_rate)}</td>
          <td class="c">${l.gst_percent}%</td>
          <td class="r">${inr(amount)}</td>
        </tr>`
      })}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>Subtotal</span><span>${inr(qt.subtotal)}</span></div>
    <div class="totals-row"><span>GST</span><span>${inr(qt.gst_amount)}</span></div>
    <div class="totals-row bold"><span>Total Amount</span><span>${inr(qt.total_amount)}</span></div>
  </div>

  ${qt.notes ? html`<div class="terms"><strong>Notes:</strong> ${qt.notes}</div>` : ''}
  ${qt.transport_note ? html`<div class="terms"><strong>Transport:</strong> ${qt.transport_note}</div>` : ''}

  <div class="terms">
    <strong>Terms &amp; Conditions:</strong>
    <ol style="margin-top:4px; padding-left:14px">
      <li>Prices are exclusive of GST; GST is charged as shown above</li>
      <li>Freight &amp; insurance extra at actuals unless stated otherwise</li>
      <li>${qt.payment_terms ?? '100% advance before delivery'}</li>
      <li>Validity: ${qt.valid_until ? `till ${dt(qt.valid_until)}` : '30 days from quotation date'}</li>
      <li>Prices subject to change after validity without prior notice</li>
    </ol>
  </div>

  ${signatures('Client Signature & Stamp', `For ${org?.name ?? 'Blue Box ERP'}`)}
  `)
}

// ── Delivery Challan ──────────────────────────────────────────

const TRANSPORT_LABEL: Record<string, string> = {
  own_truck: 'Own Truck',
  client_truck: 'Client Truck',
  supplier_truck: 'Supplier Truck',
  courier: 'Courier',
  hand_delivery: 'Hand Delivery',
}

async function challanPage(supabase: Supabase, id: string, org: Organization | null) {
  const { data: dc, error } = await supabase
    .from('delivery_challans')
    .select(`
      *,
      client:clients ( name, phone, gst_number, address, city ),
      sales_order:sales_orders ( so_number ),
      delivery_challan_lines (
        *,
        unit:units ( id, name ),
        item:items ( item_code, name )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !dc) throw new Error('Challan not found')

  const items = dc.delivery_challan_lines ?? []
  const totalQty = items.reduce((s, l) => s + l.qty, 0)

  return document(dc.challan_no, html`
  ${header(org, 'DELIVERY CHALLAN', dc.challan_no)}

  <div class="meta-grid">
    <div class="meta-box">
      <div class="meta-label">Deliver To</div>
      <div class="meta-value">
        <strong>${dc.client?.name ?? '—'}</strong><br>
        ${lines(
          dc.client?.phone,
          dc.client?.gst_number && `GSTIN: ${dc.client.gst_number}`,
          [dc.client?.address, dc.client?.city].filter(Boolean).join(', '),
        )}
      </div>
    </div>

    <div class="meta-box">
      <div class="meta-label">Dispatch Details</div>
      <div class="meta-value">
        <strong>Challan Date:</strong> ${dt(dc.challan_date)}<br>
        ${dc.sales_order ? html`<strong>Against SO:</strong> ${dc.sales_order.so_number}<br>` : ''}
        <strong>Transport:</strong> ${TRANSPORT_LABEL[dc.transport_mode ?? ''] ?? dc.transport_mode ?? '—'}<br>
        ${dc.vehicle_no ? html`<strong>Vehicle No.:</strong> ${dc.vehicle_no}<br>` : ''}
        ${dc.driver_name ? html`<strong>Driver:</strong> ${dc.driver_name}<br>` : ''}
        <strong>Status:</strong> ${(dc.status ?? '').toUpperCase()}
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:28px">#</th>
        <th>Item Description</th>
        <th class="c" style="width:60px">Code</th>
        <th class="r" style="width:70px">Qty</th>
        <th class="c" style="width:45px">Unit</th>
        <th class="r" style="width:95px">Rate (₹)</th>
        <th class="r" style="width:95px">Value (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((l, i) => html`<tr>
        <td class="c">${i + 1}</td>
        <td><strong>${l.item?.name ?? '—'}</strong></td>
        <td class="c"><span class="mono">${l.item?.item_code ?? ''}</span></td>
        <td class="r"><strong>${qtyFmt(l.qty)}</strong></td>
        <td class="c">${l.unit?.name ?? '—'}</td>
        <td class="r">${l.rate ? inr(l.rate) : '—'}</td>
        <td class="r">${l.line_total ? inr(l.line_total) : '—'}</td>
      </tr>`)}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>Total Qty</span><span>${qtyFmt(totalQty)}</span></div>
    <div class="totals-row bold"><span>Challan Value</span><span>${inr(dc.total_amount)}</span></div>
  </div>

  <div class="terms">
    <strong>Note:</strong> This is a delivery challan only. GST tax invoice will be raised separately.
    Goods once dispatched will not be accepted back without prior written approval.
    ${dc.notes ? html`<br><strong>Notes:</strong> ${dc.notes}` : ''}
  </div>

  ${signatures("Receiver's Signature & Stamp", `For ${org?.name ?? 'Blue Box ERP'}`)}
  `)
}

// ── GRN ───────────────────────────────────────────────────────

async function grnPage(supabase: Supabase, id: string, org: Organization | null) {
  const { data: grn, error } = await supabase
    .from('inbound_receipts')
    .select(`
      *,
      supplier:suppliers ( name, phone, gst_number, city ),
      inbound_receipt_lines (
        *,
        unit:units ( id, name ),
        item:items ( item_code, name )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !grn) throw new Error('GRN not found')

  const items = grn.inbound_receipt_lines ?? []
  // total_amount is the pre-tax subtotal; GST is stored separately
  const grandTotal = (grn.total_amount ?? 0) + (grn.gst_amount ?? 0)

  return document(grn.receipt_no, html`
  ${header(org, 'GOODS RECEIVED NOTE', grn.receipt_no)}

  <div class="meta-grid">
    <div class="meta-box">
      <div class="meta-label">Received From</div>
      <div class="meta-value">
        <strong>${grn.supplier?.name ?? '—'}</strong><br>
        ${lines(
          grn.supplier?.phone,
          grn.supplier?.gst_number && `GSTIN: ${grn.supplier.gst_number}`,
          grn.supplier?.city,
        )}
      </div>
    </div>

    <div class="meta-box">
      <div class="meta-label">Receipt Details</div>
      <div class="meta-value">
        <strong>GRN No.:</strong> ${grn.receipt_no}<br>
        <strong>Date:</strong> ${dt(grn.receipt_date)}<br>
        <strong>Transport:</strong> ${TRANSPORT_LABEL[grn.transport_mode ?? ''] ?? grn.transport_mode ?? '—'}<br>
        ${grn.vehicle_no ? html`<strong>Vehicle:</strong> ${grn.vehicle_no}<br>` : ''}
        ${grn.challan_no ? html`<strong>Sup. Challan:</strong> ${grn.challan_no}<br>` : ''}
        ${grn.invoice_no ? html`<strong>Invoice No.:</strong> ${grn.invoice_no}` : ''}
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:28px">#</th>
        <th>Item</th>
        <th class="r" style="width:70px">Ordered</th>
        <th class="r" style="width:75px">Received</th>
        <th class="c" style="width:40px">Unit</th>
        <th class="r" style="width:90px">Rate (₹)</th>
        <th class="c" style="width:38px">GST%</th>
        <th class="r" style="width:95px">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((l, i) => html`<tr>
        <td class="c">${i + 1}</td>
        <td>
          <strong>${l.item?.name ?? '—'}</strong>
          <br><span class="mono">${l.item?.item_code ?? ''}</span>
        </td>
        <td class="r">${qtyFmt(l.qty_ordered)}</td>
        <td class="r"><strong>${qtyFmt(l.qty_received)}</strong></td>
        <td class="c">${l.unit?.name ?? '—'}</td>
        <td class="r">${inr(l.rate)}</td>
        <td class="c">${l.gst_percent}%</td>
        <td class="r">${inr(l.line_total)}</td>
      </tr>`)}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>Subtotal</span><span>${inr(grn.total_amount)}</span></div>
    <div class="totals-row"><span>GST</span><span>${inr(grn.gst_amount)}</span></div>
    <div class="totals-row bold"><span>Total</span><span>${inr(grandTotal)}</span></div>
  </div>

  ${grn.notes ? html`<div class="terms"><strong>Notes:</strong> ${grn.notes}</div>` : ''}

  ${signatures('Received By', 'Store Keeper', 'Authorised Signatory')}
  `)
}
