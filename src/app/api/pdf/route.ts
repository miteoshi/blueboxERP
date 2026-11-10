import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { html, raw, printScript, printableResponse, type SafeHtml } from '@/lib/pdf/html'
import { amountInWords } from '@/lib/gst'

// ─────────────────────────────────────────────────────────────
// PDF Generation Route
// GET /api/pdf?type=quotation&id=uuid
// GET /api/pdf?type=challan&id=uuid
// GET /api/pdf?type=grn&id=uuid
// GET /api/pdf?type=invoice&id=uuid[&copies=3]
// GET /api/pdf?type=credit_note&id=uuid
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
  invoice_terms?: string | null
  bank_name?: string | null
  bank_account_no?: string | null
  bank_ifsc?: string | null
  bank_branch?: string | null
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
        name, address, city, state, pincode, phone, email, gst_number,
        invoice_terms, bank_name, bank_account_no, bank_ifsc, bank_branch
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
      case 'invoice':
        return printableResponse(
          await invoicePage(supabase, id, org, searchParams.get('copies') === '3')
        )
      case 'credit_note':
        return printableResponse(await creditNotePage(supabase, id, org))
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

// ── GST Tax Invoice (CGST Rule 46) ────────────────────────────

const INVOICE_CSS = `
  .inv          { border: 1px solid #1E3A5F; }
  .inv-head     { display: flex; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid #1E3A5F; }
  .inv-title    { text-align: center; font-size: 16px; font-weight: bold; letter-spacing: 0.08em; color: #1E3A5F; padding: 6px; border-bottom: 1px solid #1E3A5F; }
  .copy-label   { font-size: 9px; font-weight: bold; color: #64748B; text-align: right; }
  .grid2        { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #1E3A5F; }
  .grid2 > div  { padding: 8px 12px; font-size: 10.5px; line-height: 1.6; }
  .grid2 > div + div { border-left: 1px solid #1E3A5F; }
  .lbl          { font-size: 8.5px; font-weight: bold; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; }
  .inv table    { margin: 0; }
  .inv thead th { font-size: 8.5px; padding: 6px 5px; }
  .inv tbody td { font-size: 10px; padding: 5px; border-bottom: 1px solid #E2E8F0; }
  .inv tfoot td { font-size: 10px; padding: 5px; font-weight: bold; border-top: 1px solid #1E3A5F; background: #F8FAFC; }
  .sum          { display: grid; grid-template-columns: 1.4fr 1fr; border-top: 1px solid #1E3A5F; }
  .sum > div    { padding: 8px 12px; font-size: 10.5px; }
  .sum > div + div { border-left: 1px solid #1E3A5F; }
  .row          { display: flex; justify-content: space-between; padding: 2px 0; }
  .grand        { font-size: 13px; font-weight: bold; color: #1D4ED8; border-top: 1px solid #CBD5E1; margin-top: 4px; padding-top: 4px; }
  .words        { font-style: italic; margin-top: 6px; }
  .small        { font-size: 9px; color: #475569; line-height: 1.5; }
  .sign         { text-align: right; padding: 8px 12px 10px; border-top: 1px solid #1E3A5F; font-size: 10.5px; }
  .sign .space  { height: 42px; }
  .page-break   { page-break-after: always; break-after: page; }
`

async function invoicePage(supabase: Supabase, id: string, org: Organization | null, threeCopies: boolean) {
  const [{ data: inv, error }, { data: states }] = await Promise.all([
    supabase
      .from('sales_invoices')
      .select(`
        *,
        sales_order:sales_orders ( so_number, order_date ),
        sales_invoice_lines ( * ),
        delivery_challans ( challan_no, challan_date, vehicle_no )
      `)
      .eq('id', id)
      .single(),
    supabase.from('gst_states').select('code, name'),
  ])

  if (error || !inv) throw new Error('Invoice not found')

  const stateName = (code: string | null) => {
    if (!code) return '—'
    return `${states?.find((s) => s.code === code)?.name ?? ''} (${code})`
  }
  const items = [...(inv.sales_invoice_lines ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const inter = inv.is_interstate
  const cancelled = inv.status === 'cancelled'

  // HSN / rate-wise tax summary
  const summary = new Map<string, { hsn: string; rate: number; taxable: number; cgst: number; sgst: number; igst: number }>()
  for (const l of items) {
    const key = `${l.hsn_code ?? '—'}|${l.gst_rate}`
    const row = summary.get(key) ?? { hsn: l.hsn_code ?? '—', rate: l.gst_rate, taxable: 0, cgst: 0, sgst: 0, igst: 0 }
    row.taxable += l.taxable_value
    row.cgst += l.cgst_amount
    row.sgst += l.sgst_amount
    row.igst += l.igst_amount
    summary.set(key, row)
  }

  const qtyTotal = items.reduce((s, l) => s + l.qty, 0)
  const challans = inv.delivery_challans ?? []
  const vehicles = [...new Set(challans.map((c) => c.vehicle_no).filter(Boolean))]

  const copy = (label: string, last: boolean) => html`
  <div class="${last ? '' : 'page-break'}">
  <div class="copy-label">${label}</div>
  ${cancelled ? html`<div style="color:#DC2626;font-weight:bold;text-align:center;font-size:14px;margin:4px 0">CANCELLED — ${inv.cancel_reason ?? ''}</div>` : ''}
  <div class="inv">
    <div class="inv-title">TAX INVOICE</div>
    <div class="inv-head">
      <div>
        <div class="company-name">${inv.supplier_name}</div>
        ${inv.supplier_address ? html`<div class="company-sub">${inv.supplier_address}</div>` : ''}
        <div class="company-sub">State: ${stateName(inv.supplier_state_code)}</div>
        ${[org?.phone, org?.email].filter(Boolean).length ? html`<div class="company-sub">${[org?.phone, org?.email].filter(Boolean).join(' | ')}</div>` : ''}
        <div class="company-sub"><strong>GSTIN: ${inv.supplier_gstin}</strong></div>
      </div>
      <div style="text-align:right; font-size:10.5px; line-height:1.7">
        <div class="lbl">Invoice No.</div>
        <div style="font-family:monospace;font-size:13px;font-weight:bold">${inv.invoice_no}</div>
        <div><span class="lbl">Date</span> ${dt(inv.invoice_date)}</div>
        <div><span class="lbl">Due</span> ${dt(inv.due_date)}</div>
      </div>
    </div>

    <div class="grid2">
      <div>
        <div class="lbl">Bill to / Ship to</div>
        <strong>${inv.buyer_name}</strong><br>
        ${inv.buyer_address ? html`${inv.buyer_address}<br>` : ''}
        GSTIN: ${inv.buyer_gstin ?? 'Unregistered'}<br>
        State: ${stateName(inv.buyer_state_code ?? inv.place_of_supply)}
      </div>
      <div>
        <div><span class="lbl">Place of supply</span> ${stateName(inv.place_of_supply)}</div>
        <div><span class="lbl">Reverse charge</span> ${inv.reverse_charge ? 'Yes' : 'No'}</div>
        ${inv.sales_order ? html`<div><span class="lbl">Order ref.</span> ${inv.sales_order.so_number} (${dt(inv.sales_order.order_date)})</div>` : ''}
        ${challans.length ? html`<div><span class="lbl">Delivery challan</span> ${challans.map((c) => `${c.challan_no} (${dt(c.challan_date)})`).join(', ')}</div>` : ''}
        ${vehicles.length ? html`<div><span class="lbl">Vehicle</span> ${vehicles.join(', ')}</div>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:22px">#</th>
          <th>Description of goods</th>
          <th class="c" style="width:62px">HSN</th>
          <th class="r" style="width:54px">Qty</th>
          <th class="r" style="width:66px">Rate</th>
          <th class="r" style="width:78px">Taxable value</th>
          ${inter
            ? html`<th class="r" style="width:84px">IGST</th>`
            : html`<th class="r" style="width:74px">CGST</th><th class="r" style="width:74px">SGST</th>`}
          <th class="r" style="width:82px">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((l, i) => html`<tr>
          <td class="c">${i + 1}</td>
          <td>${l.description}</td>
          <td class="c">${l.hsn_code ?? '—'}</td>
          <td class="r">${qtyFmt(l.qty)} ${l.unit_name ?? ''}</td>
          <td class="r">${inr(l.rate)}</td>
          <td class="r">${inr(l.taxable_value)}</td>
          ${inter
            ? html`<td class="r">${inr(l.igst_amount)}<br><span class="small">@ ${l.gst_rate}%</span></td>`
            : html`<td class="r">${inr(l.cgst_amount)}<br><span class="small">@ ${l.gst_rate / 2}%</span></td>
                   <td class="r">${inr(l.sgst_amount)}<br><span class="small">@ ${l.gst_rate / 2}%</span></td>`}
          <td class="r">${inr(l.line_total)}</td>
        </tr>`)}
      </tbody>
      <tfoot>
        <tr>
          <td></td><td>Total</td><td></td>
          <td class="r">${qtyFmt(qtyTotal)}</td><td></td>
          <td class="r">${inr(inv.taxable_value)}</td>
          ${inter
            ? html`<td class="r">${inr(inv.igst_amount)}</td>`
            : html`<td class="r">${inr(inv.cgst_amount)}</td><td class="r">${inr(inv.sgst_amount)}</td>`}
          <td class="r">${inr(inv.taxable_value + inv.cgst_amount + inv.sgst_amount + inv.igst_amount)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="sum">
      <div>
        <div class="lbl">Tax summary (HSN-wise)</div>
        <table style="margin-top:4px">
          <thead><tr>
            <th>HSN</th><th class="r">Taxable</th><th class="c">Rate</th>
            ${inter ? html`<th class="r">IGST</th>` : html`<th class="r">CGST</th><th class="r">SGST</th>`}
          </tr></thead>
          <tbody>
            ${[...summary.values()].map((r) => html`<tr>
              <td>${r.hsn}</td><td class="r">${inr(r.taxable)}</td><td class="c">${r.rate}%</td>
              ${inter ? html`<td class="r">${inr(r.igst)}</td>` : html`<td class="r">${inr(r.cgst)}</td><td class="r">${inr(r.sgst)}</td>`}
            </tr>`)}
          </tbody>
        </table>
        <div class="words"><strong>Amount in words:</strong> ${amountInWords(inv.total_amount)}</div>
        ${org?.bank_account_no ? html`
        <div class="small" style="margin-top:8px">
          <strong>Bank details</strong><br>
          ${[org.bank_name, org.bank_branch].filter(Boolean).join(', ')}<br>
          A/c No. ${org.bank_account_no}${org.bank_ifsc ? html` · IFSC ${org.bank_ifsc}` : ''}
        </div>` : ''}
      </div>
      <div>
        <div class="row"><span>Taxable value</span><span>${inr(inv.taxable_value)}</span></div>
        ${inter
          ? html`<div class="row"><span>IGST</span><span>${inr(inv.igst_amount)}</span></div>`
          : html`<div class="row"><span>CGST</span><span>${inr(inv.cgst_amount)}</span></div>
                 <div class="row"><span>SGST</span><span>${inr(inv.sgst_amount)}</span></div>`}
        ${inv.round_off !== 0 ? html`<div class="row"><span>Round off</span><span>${inr(inv.round_off)}</span></div>` : ''}
        <div class="row grand"><span>Invoice total</span><span>${inr(inv.total_amount)}</span></div>
        ${inv.reverse_charge ? html`<div class="small" style="margin-top:6px">Tax on this supply is payable by the recipient under reverse charge.</div>` : ''}
      </div>
    </div>

    ${org?.invoice_terms || inv.notes ? html`
    <div class="small" style="padding:8px 12px; border-top:1px solid #1E3A5F; white-space:pre-line">
      ${org?.invoice_terms ? html`<strong>Terms &amp; conditions</strong>\n${org.invoice_terms}` : ''}
      ${inv.notes ? html`${org?.invoice_terms ? '\n' : ''}<strong>Notes:</strong> ${inv.notes}` : ''}
    </div>` : ''}

    <div class="sign">
      For <strong>${inv.supplier_name}</strong>
      <div class="space"></div>
      Authorised Signatory
    </div>
  </div>
  <div class="small" style="text-align:center;margin-top:6px">This is a computer-generated invoice.</div>
  </div>`

  const labels = threeCopies
    ? ['ORIGINAL FOR RECIPIENT', 'DUPLICATE FOR TRANSPORTER', 'TRIPLICATE FOR SUPPLIER']
    : ['ORIGINAL FOR RECIPIENT']

  return html`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${inv.invoice_no}</title><style>${raw(CSS)}${raw(INVOICE_CSS)}</style></head>
<body><div class="page">
${labels.map((label, i) => copy(label, i === labels.length - 1))}
</div>
${printScript}
</body></html>`
}

// ── Credit note (CGST Rules, Rule 53) ─────────────────────────

const REASON_LABEL: Record<string, string> = {
  sales_return: 'Sales return',
  rate_difference: 'Rate difference',
  discount: 'Post-sale discount',
  deficiency: 'Deficiency in supply',
  other: 'Other',
}

async function creditNotePage(supabase: Supabase, id: string, org: Organization | null) {
  const [{ data: cn, error }, { data: states }] = await Promise.all([
    supabase
      .from('credit_notes')
      .select(`
        *,
        invoice:sales_invoices (
          invoice_no, invoice_date, supplier_name, supplier_gstin, supplier_address, supplier_state_code,
          buyer_name, buyer_address, buyer_state_code
        ),
        credit_note_lines ( * )
      `)
      .eq('id', id)
      .single(),
    supabase.from('gst_states').select('code, name'),
  ])

  if (error || !cn || !cn.invoice) throw new Error('Credit note not found')

  const inv = cn.invoice
  const stateName = (code: string | null) => {
    if (!code) return '—'
    return `${states?.find((s) => s.code === code)?.name ?? ''} (${code})`
  }
  const items = [...(cn.credit_note_lines ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const inter = cn.is_interstate
  const cancelled = cn.status === 'cancelled'

  return html`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${cn.credit_note_no}</title><style>${raw(CSS)}${raw(INVOICE_CSS)}</style></head>
<body><div class="page">
  ${cancelled ? html`<div style="color:#DC2626;font-weight:bold;text-align:center;font-size:14px;margin:4px 0">CANCELLED — ${cn.cancel_reason ?? ''}</div>` : ''}
  <div class="inv">
    <div class="inv-title">CREDIT NOTE</div>
    <div class="inv-head">
      <div>
        <div class="company-name">${inv.supplier_name}</div>
        ${inv.supplier_address ? html`<div class="company-sub">${inv.supplier_address}</div>` : ''}
        <div class="company-sub">State: ${stateName(inv.supplier_state_code)}</div>
        ${[org?.phone, org?.email].filter(Boolean).length ? html`<div class="company-sub">${[org?.phone, org?.email].filter(Boolean).join(' | ')}</div>` : ''}
        <div class="company-sub"><strong>GSTIN: ${inv.supplier_gstin}</strong></div>
      </div>
      <div style="text-align:right; font-size:10.5px; line-height:1.7">
        <div class="lbl">Credit Note No.</div>
        <div style="font-family:monospace;font-size:13px;font-weight:bold">${cn.credit_note_no}</div>
        <div><span class="lbl">Date</span> ${dt(cn.note_date)}</div>
      </div>
    </div>

    <div class="grid2">
      <div>
        <div class="lbl">Issued to</div>
        <strong>${inv.buyer_name}</strong><br>
        ${inv.buyer_address ? html`${inv.buyer_address}<br>` : ''}
        GSTIN: ${cn.buyer_gstin ?? 'Unregistered'}<br>
        State: ${stateName(inv.buyer_state_code ?? cn.place_of_supply)}
      </div>
      <div>
        <div><span class="lbl">Against invoice</span> ${inv.invoice_no} dated ${dt(inv.invoice_date)}</div>
        <div><span class="lbl">Place of supply</span> ${stateName(cn.place_of_supply)}</div>
        <div><span class="lbl">Reason</span> ${REASON_LABEL[cn.reason] ?? cn.reason}${cn.reason === 'sales_return' && cn.restocked ? ' (goods received back)' : ''}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:22px">#</th>
          <th>Description of goods</th>
          <th class="c" style="width:62px">HSN</th>
          <th class="r" style="width:54px">Qty</th>
          <th class="r" style="width:66px">Rate</th>
          <th class="r" style="width:78px">Taxable value</th>
          ${inter
            ? html`<th class="r" style="width:84px">IGST</th>`
            : html`<th class="r" style="width:74px">CGST</th><th class="r" style="width:74px">SGST</th>`}
          <th class="r" style="width:82px">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((l, i) => html`<tr>
          <td class="c">${i + 1}</td>
          <td>${l.description}</td>
          <td class="c">${l.hsn_code ?? '—'}</td>
          <td class="r">${l.qty != null ? html`${qtyFmt(l.qty)} ${l.unit_name ?? ''}` : '—'}</td>
          <td class="r">${l.qty != null ? inr(l.rate) : '—'}</td>
          <td class="r">${inr(l.taxable_value)}</td>
          ${inter
            ? html`<td class="r">${inr(l.igst_amount)}<br><span class="small">@ ${l.gst_rate}%</span></td>`
            : html`<td class="r">${inr(l.cgst_amount)}<br><span class="small">@ ${l.gst_rate / 2}%</span></td>
                   <td class="r">${inr(l.sgst_amount)}<br><span class="small">@ ${l.gst_rate / 2}%</span></td>`}
          <td class="r">${inr(l.line_total)}</td>
        </tr>`)}
      </tbody>
    </table>

    <div class="sum">
      <div>
        <div class="words"><strong>Amount in words:</strong> ${amountInWords(cn.total_amount)}</div>
        ${cn.notes ? html`<div class="small" style="margin-top:8px"><strong>Notes:</strong> ${cn.notes}</div>` : ''}
      </div>
      <div>
        <div class="row"><span>Taxable value</span><span>${inr(cn.taxable_value)}</span></div>
        ${inter
          ? html`<div class="row"><span>IGST</span><span>${inr(cn.igst_amount)}</span></div>`
          : html`<div class="row"><span>CGST</span><span>${inr(cn.cgst_amount)}</span></div>
                 <div class="row"><span>SGST</span><span>${inr(cn.sgst_amount)}</span></div>`}
        ${cn.round_off !== 0 ? html`<div class="row"><span>Round off</span><span>${inr(cn.round_off)}</span></div>` : ''}
        <div class="row grand"><span>Total credit</span><span>${inr(cn.total_amount)}</span></div>
      </div>
    </div>

    <div class="sign">
      For <strong>${inv.supplier_name}</strong>
      <div class="space"></div>
      Authorised Signatory
    </div>
  </div>
  <div class="small" style="text-align:center;margin-top:6px">This is a computer-generated credit note issued under section 34 of the CGST Act, 2017.</div>
</div>
${printScript}
</body></html>`
}
