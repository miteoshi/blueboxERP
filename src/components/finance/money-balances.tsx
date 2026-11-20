'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useMoneyBalances,
  useSetMoneyOpening,
  type MoneyAccount,
  type MoneyPosition,
} from '@/lib/hooks/use-money-balances'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils/format'
import { Banknote, Landmark } from 'lucide-react'
import { useClosedPeriod } from '@/lib/hooks/use-books-lock'

const LABEL: Record<MoneyAccount, string> = { cash: 'Cash in hand', bank: 'Bank' }
const signed = (n: number) => `${n < 0 ? '−' : ''}${formatCurrency(Math.abs(n))}`

const dayBefore = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
}

// Cash and bank balance at the start and end of the period on the Cash & Bank Book
export function MoneyBalances({ from, to, canEdit }: { from: string; to: string; canEdit: boolean }) {
  const { data, isLoading } = useMoneyBalances(from, to)
  const [editing, setEditing] = useState<MoneyAccount | null>(null)

  if (isLoading || !data) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      {(['cash', 'bank'] as const).map((account) => (
        <div key={account} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            {account === 'cash' ? <Banknote className="w-4 h-4 text-slate-500" /> : <Landmark className="w-4 h-4 text-slate-500" />}
            <h2 className="text-sm font-semibold text-slate-900">{LABEL[account]}</h2>
            <span className="text-xs text-slate-400">
              {account === 'cash' ? 'payments recorded as cash' : 'bank transfer, UPI, cheque, card and other'}
            </span>
          </div>
          {editing === account ? (
            <OpeningForm account={account} current={data[account]} onDone={() => setEditing(null)} />
          ) : (
            <Position
              account={account}
              position={data[account]}
              from={from}
              to={to}
              canEdit={canEdit}
              onEdit={() => setEditing(account)}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function Position({
  account,
  position,
  from,
  to,
  canEdit,
  onEdit,
}: {
  account: MoneyAccount
  position: MoneyPosition
  from: string
  to: string
  canEdit: boolean
  onEdit: () => void
}) {
  if (!position.set) {
    return (
      <div className="text-sm text-slate-500">
        <p>No opening balance yet, so only the movement below can be shown, not what is actually there.</p>
        {canEdit ? (
          <Button variant="outline" size="sm" className="mt-3" onClick={onEdit}>
            Set opening balance
          </Button>
        ) : (
          <p className="mt-2 text-xs">An admin or manager can set it here.</p>
        )}
      </div>
    )
  }

  const unknown = (
    <span className="block text-sm font-normal text-slate-400">Not known — before the opening date</span>
  )
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-slate-500">On {formatDate(dayBefore(from))}</div>
          <div className="text-lg font-semibold tabular-nums text-slate-900">
            {position.start === null ? unknown : signed(position.start)}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">On {formatDate(to)}</div>
          <div className={`text-lg font-semibold tabular-nums ${position.end !== null && position.end < 0 ? 'text-amber-700' : 'text-slate-900'}`}>
            {position.end === null ? unknown : signed(position.end)}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span>
          Opening {signed(position.opening_amount)} as at {formatDate(position.as_of)}
        </span>
        {canEdit && (
          <button type="button" className="text-blue-600 hover:underline" onClick={onEdit}>
            Change
          </button>
        )}
      </div>
      {position.end !== null && position.end < 0 && (
        <p className="mt-2 text-xs text-amber-700">
          {account === 'cash'
            ? 'Cash cannot be below zero: a receipt is missing, a payment was recorded as cash by mistake, or the opening balance is wrong.'
            : 'Overdrawn — if the account has no overdraft, a receipt is missing or the opening balance is wrong.'}
        </p>
      )}
    </div>
  )
}

function OpeningForm({ account, current, onDone }: { account: MoneyAccount; current: MoneyPosition; onDone: () => void }) {
  const save = useSetMoneyOpening()
  const [asOf, setAsOf] = useState(current.set ? current.as_of : dayBefore(todayISO()))
  const closed = useClosedPeriod()
  const [amount, setAmount] = useState(current.set ? String(current.opening_amount) : '')

  function submit() {
    const value = Number(amount)
    if (amount.trim() === '' || !Number.isFinite(value)) return toast.error('Enter the opening balance')
    if (Math.round(value * 100) / 100 !== value) return toast.error('Amount can have at most 2 decimals')
    if (account === 'cash' && value < 0) return toast.error('Cash in hand cannot be below zero')
    if (!asOf) return toast.error('Give the date the balance is as at')
    if (asOf > todayISO()) return toast.error('The opening date cannot be in the future')
    if (closed.error(asOf)) return toast.error(closed.error(asOf))
    save.mutate({ account, asOf, amount: value }, { onSuccess: onDone })
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        What was {account === 'cash' ? 'in the cash box' : 'in the bank'} at the end of the day you choose — usually the
        day before you started recording payments here.{account === 'bank' ? ' Enter a minus amount if the account was overdrawn.' : ''}{' '}
        Payments dated on or before that day are taken to be inside this figure.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="As at the end of" type="date" min={closed.min()} error={closed.error(asOf)} max={todayISO()} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        <Input label="Balance (₹)" type="number" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onDone}>
          Close
        </Button>
        <Button size="sm" loading={save.isPending} onClick={submit}>
          Save opening balance
        </Button>
      </div>
    </div>
  )
}
