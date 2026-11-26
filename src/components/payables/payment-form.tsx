'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PAYMENT_MODES, type PaymentMode } from '@/lib/hooks/use-finance'
import { useRecordSupplierPayment } from '@/lib/hooks/use-payables'
import { formatCurrency, todayISO } from '@/lib/utils/format'
import { toast } from 'sonner'
import { Wallet } from 'lucide-react'
import { useClosedPeriod } from '@/lib/hooks/use-books-lock'
import { useTdsFields } from '@/components/finance/tds-fields'

interface SupplierOption {
  id: string
  name: string
  outstanding?: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

// Records a payment to a supplier, optionally deducting TDS. The money paid
// plus the TDS settles bills: with `bill`, that bill; otherwise the supplier's
// oldest due bills first, and anything left over is kept as an advance.
export function SupplierPaymentForm({
  suppliers,
  supplierId: fixedSupplierId,
  bill,
  onDone,
}: {
  suppliers?: SupplierOption[]
  supplierId?: string
  bill?: { id: string; bill_no: string; balance_due: number; taxable_value?: number; total_amount?: number }
  onDone: () => void
}) {
  const record = useRecordSupplierPayment()
  const [supplierId, setSupplierId] = useState(fixedSupplierId ?? '')
  const [amount, setAmount] = useState(bill ? String(bill.balance_due) : '')
  const [mode, setMode] = useState<PaymentMode>('bank_transfer')
  const [paymentDate, setPaymentDate] = useState(todayISO)
  const closed = useClosedPeriod()
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  // TDS: the base defaults to the value before GST of what is still due on the bill
  const billBase =
    bill?.taxable_value && bill.total_amount ? r2((bill.taxable_value * bill.balance_due) / bill.total_amount) : undefined
  const tdsFields = useTdsFields({
    initialBase: billBase,
    onToggle: (on, defaultTds) => {
      // Paying a bill in full: the supplier gets what is due less the TDS
      if (on && bill && Number(amount) === bill.balance_due && billBase) setAmount(String(r2(bill.balance_due - defaultTds)))
      else if (!on && bill && Number(amount) < bill.balance_due) setAmount(String(bill.balance_due))
    },
  })
  const withTds = tdsFields.on
  const tds = tdsFields.tds

  const outstanding = suppliers?.find((s) => s.id === supplierId)?.outstanding
  const value = Number(amount)
  const settles = r2((Number.isFinite(value) ? value : 0) + tds)

  function submit() {
    if (!supplierId) return toast.error('Select a supplier')
    if (!(value > 0)) return toast.error('Enter the amount paid')
    if (Math.round(value * 100) / 100 !== value) return toast.error('Amount can have at most 2 decimals')
    const tdsProblem = tdsFields.problem()
    if (tdsProblem) return toast.error(tdsProblem)
    if (bill && settles > bill.balance_due + 0.005) {
      return toast.error(
        withTds
          ? `Paid plus TDS is ${formatCurrency(settles)}, but only ${formatCurrency(bill.balance_due)} is due on ${bill.bill_no}`
          : `Only ${formatCurrency(bill.balance_due)} is due on ${bill.bill_no}`,
      )
    }
    if (paymentDate > todayISO()) return toast.error('Payment date cannot be in the future')
    if (closed.error(paymentDate)) return toast.error(closed.error(paymentDate))
    if (mode !== 'cash' && !reference.trim()) return toast.error('Enter the UTR, cheque or transaction number')
    record.mutate(
      {
        supplierId,
        amount: value,
        mode,
        paymentDate,
        reference,
        notes,
        billId: bill?.id,
        tds: tdsFields.input,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <Card className="mb-6 border-teal-200">
      <CardHeader>
        <h3 className="text-sm font-semibold text-slate-900">{bill ? `Pay ${bill.bill_no}` : 'Record a payment to a supplier'}</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {bill
            ? `${formatCurrency(bill.balance_due)} is due on this bill.`
            : 'Applied to the oldest due bills first. Anything left over is kept as an advance.'}
          {' '}If you deduct TDS, the money paid and the TDS together settle the bills.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {!fixedSupplierId && (
            <div>
              <label htmlFor="payables-payment-form-supplier" className="block text-sm font-medium text-slate-700 mb-1.5">
                Supplier <span className="text-red-500">*</span>
              </label>
              <select id="payables-payment-form-supplier"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select supplier…</option>
                {suppliers?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {outstanding !== undefined && supplierId && (
                <p className="mt-1 text-xs text-slate-500">
                  {outstanding > 0 ? `${formatCurrency(outstanding)} outstanding` : 'Nothing outstanding — this will be an advance'}
                </p>
              )}
            </div>
          )}
          <Input
            label={withTds ? 'Paid to the supplier (₹)' : 'Amount (₹)'}
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div>
            <label htmlFor="payables-payment-form-mode" className="block text-sm font-medium text-slate-700 mb-1.5">Mode</label>
            <select id="payables-payment-form-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as PaymentMode)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <Input label="Payment date" type="date" min={closed.min()} error={closed.error(paymentDate)} max={todayISO()} value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          <Input
            label={mode === 'cash' ? 'Reference (optional)' : 'UTR / cheque / transaction no.'}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {tdsFields.fields({
          summary: (
            <>
              <p className="text-sm text-slate-600 pb-2">
                Supplier gets <span className="font-semibold tabular-nums">{formatCurrency(Number.isFinite(value) ? value : 0)}</span>
                {' · '}TDS <span className="font-semibold tabular-nums">{formatCurrency(tds)}</span>
                {' · '}settles <span className="font-semibold tabular-nums">{formatCurrency(settles)}</span>
              </p>
              {bill && tds > 0 && Math.abs(settles - bill.balance_due) > 0.005 && (
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline pb-2.5"
                  onClick={() => setAmount(String(r2(bill.balance_due - tds)))}
                >
                  Pay the rest of the bill: {formatCurrency(r2(bill.balance_due - tds))}
                </button>
              )}
            </>
          ),
        })}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button loading={record.isPending} onClick={submit}>
            <Wallet className="w-4 h-4" />
            Record payment
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
