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

interface SupplierOption {
  id: string
  name: string
  outstanding?: number
}

// Records a payment to a supplier. With `bill`, the whole amount goes to that
// bill; otherwise the supplier's oldest due bills are paid first and anything
// left over is kept as an advance.
export function SupplierPaymentForm({
  suppliers,
  supplierId: fixedSupplierId,
  bill,
  onDone,
}: {
  suppliers?: SupplierOption[]
  supplierId?: string
  bill?: { id: string; bill_no: string; balance_due: number }
  onDone: () => void
}) {
  const record = useRecordSupplierPayment()
  const [supplierId, setSupplierId] = useState(fixedSupplierId ?? '')
  const [amount, setAmount] = useState(bill ? String(bill.balance_due) : '')
  const [mode, setMode] = useState<PaymentMode>('bank_transfer')
  const [paymentDate, setPaymentDate] = useState(todayISO)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const outstanding = suppliers?.find((s) => s.id === supplierId)?.outstanding
  const value = Number(amount)

  function submit() {
    if (!supplierId) return toast.error('Select a supplier')
    if (!(value > 0)) return toast.error('Enter the amount paid')
    if (Math.round(value * 100) / 100 !== value) return toast.error('Amount can have at most 2 decimals')
    if (bill && value > bill.balance_due + 0.005) {
      return toast.error(`Only ${formatCurrency(bill.balance_due)} is due on ${bill.bill_no}`)
    }
    if (paymentDate > todayISO()) return toast.error('Payment date cannot be in the future')
    if (mode !== 'cash' && !reference.trim()) return toast.error('Enter the UTR, cheque or transaction number')
    record.mutate(
      { supplierId, amount: value, mode, paymentDate, reference, notes, billId: bill?.id },
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
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {!fixedSupplierId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Supplier <span className="text-red-500">*</span>
              </label>
              <select
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
          <Input label="Amount (₹)" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Mode</label>
            <select
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
          <Input label="Payment date" type="date" max={todayISO()} value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          <Input
            label={mode === 'cash' ? 'Reference (optional)' : 'UTR / cheque / transaction no.'}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
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
