'use client'

import { Fragment, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  TRANSFER_LABEL,
  useCancelMoneyTransfer,
  useRecordMoneyTransfer,
  type TransferDirection,
} from '@/lib/hooks/use-money-transfers'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils/format'
import { ArrowLeftRight } from 'lucide-react'
import { useClosedPeriod } from '@/lib/hooks/use-books-lock'

export type TransferRow = {
  id: string
  transfer_no: string
  transfer_date: string
  direction: TransferDirection
  amount: number
  reference: string | null
  notes: string | null
  status: string
  cancel_reason: string | null
  creator: { full_name: string | null } | null
}

const DIRECTIONS: { value: TransferDirection; title: string; hint: string }[] = [
  { value: 'cash_to_bank', title: 'Cash deposited in bank', hint: 'Cash in hand goes down, bank goes up' },
  { value: 'bank_to_cash', title: 'Cash drawn from bank', hint: 'Bank goes down, cash in hand goes up' },
]

// Record cash put into or taken out of the bank
export function TransferForm({ onDone }: { onDone: () => void }) {
  const record = useRecordMoneyTransfer()
  const [direction, setDirection] = useState<TransferDirection>('cash_to_bank')
  const [amount, setAmount] = useState('')
  const [transferDate, setTransferDate] = useState(todayISO)
  const closed = useClosedPeriod()
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const value = Number(amount)

  function submit() {
    if (!(value > 0)) return toast.error('Enter the amount moved')
    if (Math.round(value * 100) / 100 !== value) return toast.error('Amount can have at most 2 decimals')
    if (!transferDate) return toast.error('Give the date')
    if (transferDate > todayISO()) return toast.error('Transfer date cannot be in the future')
    if (closed.error(transferDate)) return toast.error(closed.error(transferDate))
    record.mutate({ direction, amount: value, transferDate, reference, notes }, { onSuccess: onDone })
  }

  return (
    <Card className="mb-6 border-blue-200">
      <CardHeader>
        <h3 className="text-sm font-semibold text-slate-900">Record a transfer between cash and bank</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Not money received or paid — it moves the same amount from one balance to the other.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Direction">
          {DIRECTIONS.map((d) => (
            <button
              key={d.value}
              type="button"
              role="radio"
              aria-checked={direction === d.value}
              onClick={() => setDirection(d.value)}
              className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                direction === d.value ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="text-sm font-medium text-slate-900">{d.title}</div>
              <div className="text-xs text-slate-500">{d.hint}</div>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input label="Amount (₹)" type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input label="Date" type="date" min={closed.min()} error={closed.error(transferDate)} max={todayISO()} value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
          <Input
            label={direction === 'cash_to_bank' ? 'Deposit slip no. (optional)' : 'Cheque / ATM ref. (optional)'}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
          <div className="sm:col-span-3">
            <Input label="Notes" placeholder="e.g. day's cash sales banked" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={onDone}>
            Close
          </Button>
          <Button loading={record.isPending} onClick={submit}>
            Save transfer
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

// Transfers in the period, with cancel for admin and manager
export function TransferList({ rows, canEdit }: { rows: TransferRow[]; canEdit: boolean }) {
  const cancel = useCancelMoneyTransfer()
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  function confirmCancel(id: string) {
    if (!reason.trim()) return toast.error('Give a reason')
    cancel.mutate(
      { id, reason: reason.trim() },
      {
        onSuccess: () => {
          setCancelling(null)
          setReason('')
        },
      }
    )
  }

  const active = rows.filter((t) => t.status === 'active')
  const deposited = active.filter((t) => t.direction === 'cash_to_bank').reduce((s, t) => s + Number(t.amount), 0)
  const drawn = active.filter((t) => t.direction === 'bank_to_cash').reduce((s, t) => s + Number(t.amount), 0)

  return (
    <div className="overflow-x-auto">
      <table className="stack w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
            <th className="text-left px-4 py-3">Transfer</th>
            <th className="text-left px-4 py-3">Direction</th>
            <th className="text-left px-4 py-3">Reference</th>
            <th className="text-right px-4 py-3">Amount</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center py-12 text-slate-400 text-sm">
                <ArrowLeftRight className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                No cash deposited in or drawn from the bank in this period
              </td>
            </tr>
          )}
          {rows.map((t) => {
            const off = t.status === 'cancelled'
            return (
              <Fragment key={t.id}>
                <tr className={off ? 'opacity-60' : undefined}>
                  <td data-main className="px-4 py-3">
                    <span className={`font-mono font-semibold text-slate-900 whitespace-nowrap ${off ? 'line-through' : ''}`}>
                      {t.transfer_no}
                    </span>
                    <div className="text-xs text-slate-400">
                      {formatDate(t.transfer_date)}
                      {t.creator?.full_name ? ` · ${t.creator.full_name}` : ''}
                    </div>
                    {off && (
                      <div className="mt-1">
                        <Badge variant="default">Cancelled</Badge>
                        {t.cancel_reason && <span className="ml-1 text-xs text-slate-500">{t.cancel_reason}</span>}
                      </div>
                    )}
                  </td>
                  <td data-label="Direction" className="px-4 py-3 text-slate-700">
                    {TRANSFER_LABEL[t.direction]}
                    {t.notes && <div className="text-xs text-slate-400">{t.notes}</div>}
                  </td>
                  <td data-label="Reference" className="px-4 py-3 text-slate-600">{t.reference || '—'}</td>
                  <td data-label="Amount" className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                    {formatCurrency(Number(t.amount))}
                  </td>
                  <td data-hide={!canEdit || off ? true : undefined} className="px-4 py-3 text-right">
                    {canEdit && !off && (
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => {
                          setCancelling(cancelling === t.id ? null : t.id)
                          setReason('')
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
                {cancelling === t.id && (
                  <tr>
                    <td colSpan={5} className="bg-red-50 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          autoFocus
                          placeholder={`Why cancel ${t.transfer_no}? e.g. entered twice`}
                          value={reason}
                          onChange={(ev) => setReason(ev.target.value)}
                          className="flex-1 min-w-[200px] px-3 py-1.5 text-sm rounded-lg border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-300"
                        />
                        <Button variant="outline" size="sm" onClick={() => setCancelling(null)}>
                          Keep
                        </Button>
                        <Button variant="danger" size="sm" loading={cancel.isPending} onClick={() => confirmCancel(t.id)}>
                          Cancel transfer
                        </Button>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">The transfer stays on record, marked cancelled, and drops out of the balances.</p>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
        {active.length > 0 && (
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
              <td colSpan={3} className="px-4 py-3">
                Deposited {formatCurrency(deposited)} · drawn {formatCurrency(drawn)}
                <span className="block text-xs font-normal text-slate-500">Net into the bank, cancelled left out</span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                {deposited - drawn < 0 ? '−' : ''}
                {formatCurrency(Math.abs(Math.round((deposited - drawn) * 100) / 100))}
              </td>
              <td data-hide />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
