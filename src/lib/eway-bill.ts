// E-way bill JSON for the "Generate Bulk" upload on ewaybillgst.gov.in.
//
// Built for one outward supply against a tax invoice, moved by road. The
// portal validates the file again on upload and is the final word; the
// checks here exist so a file that would be refused is not produced at all.

export const EWAY_BILL_THRESHOLD = 50000
const EWB_JSON_VERSION = '1.0.1118'

// Unit names as kept in Units, mapped to the portal's unit quantity codes
const UQC: Record<string, string> = {
  bag: 'BAG', box: 'BOX', bundle: 'BDL', carton: 'CTN', centimeter: 'CMS', 'cubic meter': 'CBM',
  dozen: 'DOZ', each: 'NOS', no: 'NOS', 'no.': 'NOS', nos: 'NOS', piece: 'PCS', pcs: 'PCS',
  gram: 'GMS', kilogram: 'KGS', kg: 'KGS', kilometer: 'KME', liter: 'LTR', litre: 'LTR',
  meter: 'MTR', mtr: 'MTR', 'metric ton': 'MTS', milliliter: 'MLT', pack: 'PAC', pair: 'PRS',
  roll: 'ROL', set: 'SET', 'square foot': 'SQF', 'square meter': 'SQM', yard: 'YDS', quintal: 'QTL',
}

export const unitQuantityCode = (unitName: string | null | undefined) =>
  UQC[(unitName ?? '').trim().toLowerCase()] ?? 'OTH'

export type EwayInvoice = {
  invoice_no: string
  invoice_date: string // yyyy-mm-dd
  supplier_name: string | null
  supplier_gstin: string | null
  supplier_state_code: string | null
  buyer_name: string | null
  buyer_gstin: string | null
  buyer_state_code: string | null
  place_of_supply: string | null
  is_interstate: boolean | null
  taxable_value: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  round_off: number | null
  total_amount: number
  lines: {
    description: string | null
    hsn_code: string | null
    qty: number
    unit_name: string | null
    taxable_value: number
    gst_rate: string | number | null
  }[]
}

export type EwayParty = { address: string | null; city: string | null; pincode: string | null }

export type EwayTransport = {
  distanceKm: number
  vehicleNo: string
  transporterId: string
  transporterName: string
}

const pin = (v: string | null) => (/^[1-9][0-9]{5}$/.test((v ?? '').trim()) ? Number(v) : null)
const ddmmyyyy = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const clip = (v: string | null | undefined, n: number) => (v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
export const normalizeVehicleNo = (v: string) => v.replace(/[\s-]/g, '').toUpperCase()

/** Everything that would make the portal refuse the file, in plain words. */
export function ewayBillProblems(inv: EwayInvoice, from: EwayParty, to: EwayParty, t: EwayTransport): string[] {
  const problems: string[] = []
  const vehicle = normalizeVehicleNo(t.vehicleNo)
  const transporter = t.transporterId.trim().toUpperCase()

  if (!inv.supplier_gstin) problems.push('The invoice has no supplier GSTIN.')
  if (inv.invoice_no.length > 16) problems.push('The portal accepts document numbers of at most 16 characters.')
  if (pin(from.pincode) == null) problems.push('Your company PIN code is missing — add it under Settings → Company.')
  if (pin(to.pincode) == null) problems.push(`${inv.buyer_name ?? 'The client'} has no PIN code — add it under Clients.`)
  if (!clip(from.city, 50)) problems.push('Your company city is missing — add it under Settings → Company.')
  if (!clip(to.city, 50)) problems.push(`${inv.buyer_name ?? 'The client'} has no city — add it under Clients.`)
  if (!Number.isInteger(t.distanceKm) || t.distanceKm < 1 || t.distanceKm > 4000)
    problems.push('Enter the distance in whole kilometres, between 1 and 4000.')
  if (!vehicle && !transporter)
    problems.push('Give the vehicle number, or the transporter’s GSTIN / transporter ID if they will fill in the vehicle.')
  if (vehicle && !/^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/.test(vehicle))
    problems.push('The vehicle number does not look right — for example GJ06AB1234.')
  if (transporter && transporter.length !== 15) problems.push('A transporter ID has 15 characters.')

  const noHsn = inv.lines.filter((l) => !/^[0-9]{4,8}$/.test((l.hsn_code ?? '').trim()))
  if (noHsn.length > 0)
    problems.push(`HSN code missing or not 4–8 digits for: ${noHsn.map((l) => l.description ?? 'an item').join(', ')}.`)
  if (inv.lines.length === 0) problems.push('The invoice has no lines.')
  return problems
}

export function buildEwayBillJson(inv: EwayInvoice, from: EwayParty, to: EwayParty, t: EwayTransport) {
  const interstate = inv.is_interstate === true
  const toState = Number(inv.place_of_supply ?? inv.buyer_state_code)
  const fromState = Number(inv.supplier_state_code)
  const vehicle = normalizeVehicleNo(t.vehicleNo)
  const mainLine = [...inv.lines].sort((a, b) => Number(b.taxable_value) - Number(a.taxable_value))[0]

  return {
    version: EWB_JSON_VERSION,
    billLists: [
      {
        userGstin: inv.supplier_gstin,
        supplyType: 'O',
        subSupplyType: 1,
        docType: 'INV',
        docNo: inv.invoice_no,
        docDate: ddmmyyyy(inv.invoice_date),
        transType: 1,
        fromGstin: inv.supplier_gstin,
        fromTrdName: clip(inv.supplier_name, 100),
        fromAddr1: clip(from.address, 120),
        fromAddr2: '',
        fromPlace: clip(from.city, 50),
        fromPincode: pin(from.pincode),
        fromStateCode: fromState,
        actualFromStateCode: fromState,
        // An unregistered buyer is declared as URP
        toGstin: inv.buyer_gstin || 'URP',
        toTrdName: clip(inv.buyer_name, 100),
        toAddr1: clip(to.address, 120),
        toAddr2: '',
        toPlace: clip(to.city, 50),
        toPincode: pin(to.pincode),
        toStateCode: toState,
        actualToStateCode: toState,
        totalValue: Number(inv.taxable_value),
        cgstValue: Number(inv.cgst_amount),
        sgstValue: Number(inv.sgst_amount),
        igstValue: Number(inv.igst_amount),
        cessValue: 0,
        TotNonAdvolVal: 0,
        OthValue: Number(inv.round_off ?? 0),
        totInvValue: Number(inv.total_amount),
        transMode: 1,
        transDistance: t.distanceKm,
        transporterName: clip(t.transporterName, 100),
        transporterId: t.transporterId.trim().toUpperCase(),
        transDocNo: '',
        transDocDate: '',
        vehicleNo: vehicle,
        vehicleType: vehicle ? 'R' : '',
        mainHsnCode: Number((mainLine?.hsn_code ?? '').trim()),
        itemList: inv.lines.map((l, i) => {
          const rate = Number(l.gst_rate ?? 0)
          return {
            itemNo: i + 1,
            productName: clip(l.description, 100),
            productDesc: clip(l.description, 100),
            hsnCode: Number((l.hsn_code ?? '').trim()),
            quantity: Number(l.qty),
            qtyUnit: unitQuantityCode(l.unit_name),
            taxableAmount: Number(l.taxable_value),
            sgstRate: interstate ? 0 : rate / 2,
            cgstRate: interstate ? 0 : rate / 2,
            igstRate: interstate ? rate : 0,
            cessRate: 0,
            cessNonAdvol: 0,
          }
        }),
      },
    ],
  }
}
