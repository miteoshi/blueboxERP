'use client'

import { Fragment, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PAYMENT_MODES, paymentModeLabel, type PaymentMode } from '@/lib/hooks/use-finance'
import {
  useCancelFundingEntry,
  useRecordFundingEntry,
  useSaveFundingAccount,
  type FundingAccount,
  type FundingEntryRow,
} from '@/lib/hooks/use-funding'
import {
  FUNDING_KIND_LABEL,
  firstEntryDate,
  fundingDirections,
  fundingEntryLabel,
  type FundingDirection,
  type FundingKind,
} from '@/lib/funding'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils/format'
import { Landmark, Pencil } from 'lucide-react'
import { useClosedPeriod } from '@/lib/hooks/use-books-lock'

const r2 = (n: number) => Math.round(n * 100) / 100
const SELECT = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const money = (n: number | null) => (n === null ? <span className="text-slate-400">—</span> : formatCurrency(n))
const validAmount = (n: number) => Number.isFinite(n) && n >= 0 && Math.round(n * 100) / 100 === n

function Choice<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; title: string; hint: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`text-left rounded-lg border px-3 py-2 transition-colors ${
            value === o.value ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-sm font-medium text-slate-900">{o.title}</div>
          <div className="text-xs text-slate-500">{o.hint}</div>
        </button>
      ))}
    </div>
  )
}

// ── Balances, account by account ───────────────────────────────
export function FundingAccountsTable({
  accounts,
  asOf,
  canEdit,
  onEdit,
}: {
  accounts: FundingAccount[]
  asOf: string
  canEdit: boolean
  onEdit: (a: FundingAccount) => void
}) {
  const groups: { kind: FundingKind; title: string; inLabel: string; outLabel: string }[] = [
    { kind: 'capital', title: "Owners' capital", inLabel: 'Introduced', outLabel: 'Drawings' },
    { kind: 'loan', title: 'Loans taken', inLabel: 'Received', outLabel: 'Repaid' },
  ]
  return (
    <div className="overflow-x-auto">
      <table className="stack w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
            <th className="text-left px-4 py-3">Account</th>
            <th className="text-right px-4 py-3">Opening</th>
            <th className="text-right px-4 py-3">In</th>
            <th className="text-right px-4 py-3">Out</th>
            <th className="text-right px-4 py-3">Interest paid</th>
            <th className="text-right px-4 py-3">Balance on {formatDate(asOf)}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        {groups.map((g) => {
          const rows = accounts.filter((a) => a.kind === g.kind)
          if (rows.length === 0) return null
          const total = r2(rows.reduce((s, a) => s + (a.balance ?? 0), 0))
          return (
            <tbody key={g.kind} className="divide-y divide-slate-50">
              <tr className="bg-slate-50/60">
                <td colSpan={7} className="px-4 pt-4 pb-1 text-xs font-semibold text-slate-500 uppercase">
                  {g.title}
                </td>
              </tr>
              {rows.map((a) => (
                <tr key={a.id} className={a.is_active ? undefined : 'opacity-60'}>
                  <td data-main className="px-4 py-3">
                    <span className="font-medium text-slate-900">{a.name}</span>
                    {!a.is_active && (
                      <Badge variant="default" className="ml-2">
                        Closed
                      </Badge>
                    )}
                    <div className="text-xs text-slate-400">
                      {a.started ? `opening on ${formatDate(a.opening_as_of)}` : `starts after ${formatDate(a.opening_as_of)}`}
                    </div>
                  </td>
                  <td data-label="Opening" className="px-4 py-3 text-right tabular-nums">
                    {formatCurrency(Number(a.opening_balance))}
                  </td>
                  <td data-label={g.inLabel} className="px-4 py-3 text-right tabular-nums text-green-700">
                    {money(a.received)}
                  </td>
                  <td data-label={g.outLabel} className="px-4 py-3 text-right tabular-nums">
                    {money(a.paid_out)}
                  </td>
                  <td
                    data-label="Interest paid"
                    data-hide={g.kind === 'capital' ? true : undefined}
                    className="px-4 py-3 text-right tabular-nums text-amber-700"
                  >
                    {g.kind === 'loan' ? money(a.interest) : <span className="text-slate-300">—</span>}
                  </td>
                  <td data-label="Balance" className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                    {a.started ? formatCurrency(a.balance ?? 0) : <span className="text-slate-400 font-normal">Not started</span>}
                  </td>
                  <td data-hide={canEdit ? undefined : true} className="px-4 py-3 text-right">
                    {canEdit && (
                      <button type="button" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1" onClick={() => onEdit(a)}>
                        <Pencil className="w-3 h-3" />
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="font-semibold text-slate-900">
                <td colSpan={5} className="px-4 py-2.5">
                  {g.kind === 'capital' ? 'Total capital' : 'Total still owed'}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">{formatCurrency(total)}</td>
                <td data-hide />
              </tr>
            </tbody>
          )
        })}
      </table>
    </div>
  )
}

// ── Adding or changing an account ──────────────────────────────
const KINDS: { value: FundingKind; title: string; hint: string }[] = [
  { value: 'capital', title: "Owner's capital", hint: 'An owner or partner: money put in, drawings taken out' },
  { value: 'loan', title: 'Loan taken', hint: 'From a bank, a lender or a person: received, then repaid' },
]

export function FundingAccountForm({ account, onDone }: { account?: FundingAccount; onDone: () => void }) {
  const save = useSaveFundingAccount()
  const [kind, setKind] = useState<FundingKind>(account?.kind ?? 'capital')
  const [name, setName] = useState(account?.name ?? '')
  const [openingAsOf, setOpeningAsOf] = useState(account?.opening_as_of ?? todayISO())
  const closed = useClosedPeriod()
  const [opening, setOpening] = useState(account ? String(Number(account.opening_balance) || '') : '')
  const [active, setActive] = useState(account?.is_active ?? true)

  function submit() {
    const amount = opening.trim() === '' ? 0 : Number(opening)
    if (!name.trim()) return toast.error('Give the account a name')
    if (!openingAsOf) return toast.error('Choose the opening date')
    if (openingAsOf > todayISO()) return toast.error('The opening date cannot be in the future')
    if (closed.error(openingAsOf)) return toast.error(closed.error(openingAsOf))
    if (!validAmount(amount)) return toast.error('Enter an opening balance of nil or more, with at most 2 decimals')
    save.mutate(
      { id: account?.id, kind, name: name.trim(), openingAsOf, openingBalance: amount, isActive: active },
      { onSuccess: onDone }
    )
  }

  return (
    <Card className="mb-6 border-blue-200">
      <CardHeader>
        <h3 className="text-sm font-semibold text-slate-900">{account ? `Change ${account.name}` : 'Add a capital or loan account'}</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          The opening balance is what stood in the account at the end of the opening date — the capital put in so far, or
          the principal still owed. Entries after that date are recorded here.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        {account ? (
          <p className="text-sm text-slate-600">
            Type: <span className="font-medium text-slate-900">{FUNDING_KIND_LABEL[account.kind]}</span> (cannot be changed)
          </p>
        ) : (
          <Choice value={kind} options={KINDS} onChange={setKind} label="Account type" />
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Name"
            placeholder={kind === 'capital' ? 'e.g. Piyush — capital' : 'e.g. HDFC term loan'}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input label="Opening date" type="date" min={closed.min()} error={closed.error(openingAsOf)} max={todayISO()} value={openingAsOf} onChange={(e) => setOpeningAsOf(e.target.value)} />
          <Input
            label={kind === 'capital' ? 'Capital on that day (₹)' : 'Principal owed on that day (₹)'}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
          />
        </div>
        {account && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={!active} onChange={(e) => setActive(!e.target.checked)} />
            Closed — no new entries (the balance stays in the reports)
          </label>
        )}
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={onDone}>
            Close
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            {account ? 'Save changes' : 'Add account'}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

// ── Recording money in or out ──────────────────────────────────
export function FundingEntryForm({ accounts, onDone }: { accounts: FundingAccount[]; onDone: () => void }) {
  const record = useRecordFundingEntry()
  const open = accounts.filter((a) => a.is_active)
  const [accountId, setAccountId] = useState(open.length === 1 ? open[0].id : '')
  const [direction, setDirection] = useState<FundingDirection>('in')
  const [amount, setAmount] = useState('')
  const [interest, setInterest] = useState('')
  const [entryDate, setEntryDate] = useState(todayISO)
  const closed = useClosedPeriod()
  const [mode, setMode] = useState<PaymentMode>('bank_transfer')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const account = open.find((a) => a.id === accountId)
  const withInterest = account?.kind === 'loan' && direction === 'out'
  const minDate = account ? firstEntryDate(account.opening_as_of) : undefined
  const principal = amount.trim() === '' ? 0 : Number(amount)
  const extra = withInterest && interest.trim() !== '' ? Number(interest) : 0
  const total = Number.isFinite(principal + extra) ? r2(principal + extra) : 0

  function submit(again: boolean) {
    if (!account) return toast.error('Choose the account')
    if (!validAmount(principal) || !validAmount(extra)) return toast.error('Enter amounts of nil or more, with at most 2 decimals')
    if (!(principal + extra > 0)) return toast.error('Enter the amount')
    if (!entryDate) return toast.error('Give the date')
    if (entryDate > todayISO()) return toast.error('The date cannot be in the future')
    if (closed.error(entryDate)) return toast.error(closed.error(entryDate))
    if (minDate && entryDate < minDate) {
      return toast.error(`The date must be after ${formatDate(account.opening_as_of)}, the opening date of ${account.name}`)
    }
    record.mutate(
      { accountId: account.id, direction, amount: principal, interest: extra, entryDate, mode, reference, notes },
      {
        onSuccess: () => {
          if (!again) return onDone()
          setAmount('')
          setInterest('')
          setReference('')
          setNotes('')
        },
      }
    )
  }

  return (
    <Card className="mb-6 border-blue-200">
      <CardHeader>
        <h3 className="text-sm font-semibold text-slate-900">Record capital or a loan</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Money the owners put in or take out, or a loan received or repaid. None of it is income or expense — only loan
          interest is a cost.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        {open.length === 0 ? (
          <p className="text-sm text-slate-600">Add a capital or loan account first.</p>
        ) : (
          <>
            <div className="max-w-md">
              <label htmlFor="funding-account" className="block text-sm font-medium text-slate-700 mb-1.5">
                Account <span className="text-red-500">*</span>
              </label>
              <select
                id="funding-account"
                value={accountId}
                onChange={(e) => {
                  setAccountId(e.target.value)
                  setInterest('')
                }}
                className={SELECT}
              >
                <option value="">Choose an account…</option>
                {(['capital', 'loan'] as const).map((k) => (
                  <optgroup key={k} label={FUNDING_KIND_LABEL[k]}>
                    {open
                      .filter((a) => a.kind === k)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              {account?.kind === 'loan' && account.balance !== null && (
                <p className="mt-1 text-xs text-slate-500">Principal still owed: {formatCurrency(account.balance)}</p>
              )}
            </div>
            {account && <Choice value={direction} options={fundingDirections(account.kind)} onChange={setDirection} label="What happened" />}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label={withInterest ? 'Principal (₹)' : 'Amount (₹)'}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {withInterest && (
                <Input
                  label="Interest (₹)"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0"
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                />
              )}
              <Input label="Date" type="date" min={closed.min(minDate)} error={closed.error(entryDate)} max={todayISO()} value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
              <div>
                <label htmlFor="funding-mode" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Mode
                </label>
                <select id="funding-mode" value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)} className={SELECT}>
                  {PAYMENT_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <Input label="Reference (optional)" placeholder="UTR, cheque no." value={reference} onChange={(e) => setReference(e.target.value)} />
              <Input label="Notes" placeholder={withInterest ? 'e.g. EMI for November' : ''} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {withInterest && (
              <p className="text-sm text-slate-700">
                Paid in all <span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
                <span className="text-xs text-slate-500"> — the principal reduces the loan, the interest goes to the Profit &amp; Loss</span>
              </p>
            )}
          </>
        )}
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={onDone}>
            Close
          </Button>
          {open.length > 0 && (
            <>
              <Button variant="outline" loading={record.isPending} onClick={() => submit(true)}>
                Save and add another
              </Button>
              <Button loading={record.isPending} onClick={() => submit(false)}>
                Save
              </Button>
            </>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

// ── Entries in a period ────────────────────────────────────────
export function FundingEntryList({ rows, canEdit }: { rows: FundingEntryRow[]; canEdit: boolean }) {
  const cancel = useCancelFundingEntry()
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

  const active = rows.filter((e) => e.status === 'active')
  const moneyIn = r2(active.filter((e) => e.direction === 'in').reduce((s, e) => s + Number(e.total), 0))
  const moneyOut = r2(active.filter((e) => e.direction === 'out').reduce((s, e) => s + Number(e.total), 0))

  return (
    <div className="overflow-x-auto">
      <table className="stack w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
            <th className="text-left px-4 py-3">Entry</th>
            <th className="text-left px-4 py-3">Account</th>
            <th className="text-left px-4 py-3">Mode</th>
            <th className="text-right px-4 py-3">Money in</th>
            <th className="text-right px-4 py-3">Money out</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                <Landmark className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                No capital or loan entries in this period
              </td>
            </tr>
          )}
          {rows.map((e) => {
            const off = e.status === 'cancelled'
            const what = e.account ? fundingEntryLabel(e.account.kind, e.direction) : ''
            return (
              <Fragment key={e.id}>
                <tr className={off ? 'opacity-60' : undefined}>
                  <td data-main className="px-4 py-3">
                    <span className={`font-mono font-semibold text-slate-900 whitespace-nowrap ${off ? 'line-through' : ''}`}>{e.entry_no}</span>
                    <div className="text-xs text-slate-400">
                      {formatDate(e.entry_date)}
                      {e.creator?.full_name ? ` · ${e.creator.full_name}` : ''}
                    </div>
                    {off && (
                      <div className="mt-1">
                        <Badge variant="default">Cancelled</Badge>
                        {e.cancel_reason && <span className="ml-1 text-xs text-slate-500">{e.cancel_reason}</span>}
                      </div>
                    )}
                  </td>
                  <td data-label="Account" className="px-4 py-3 text-slate-700">
                    {e.account?.name ?? '—'}
                    <div className="text-xs text-slate-400">
                      {what}
                      {e.notes ? ` · ${e.notes}` : ''}
                    </div>
                  </td>
                  <td data-label="Mode" className="px-4 py-3 text-slate-600">
                    {paymentModeLabel(e.mode)}
                    {e.reference && <div className="text-xs text-slate-400">{e.reference}</div>}
                  </td>
                  <td data-label="Money in" className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${e.direction === 'in' ? 'text-green-700' : 'text-slate-300'}`}>
                    {e.direction === 'in' ? formatCurrency(Number(e.total)) : '—'}
                  </td>
                  <td data-label="Money out" className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${e.direction === 'out' ? 'text-slate-900' : 'text-slate-300'}`}>
                    {e.direction === 'out' ? formatCurrency(Number(e.total)) : '—'}
                    {Number(e.interest) > 0 && (
                      <div className="text-xs text-amber-700">
                        incl. interest {formatCurrency(Number(e.interest))}
                      </div>
                    )}
                  </td>
                  <td data-hide={!canEdit || off ? true : undefined} className="px-4 py-3 text-right">
                    {canEdit && !off && (
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => {
                          setCancelling(cancelling === e.id ? null : e.id)
                          setReason('')
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
                {cancelling === e.id && (
                  <tr>
                    <td colSpan={6} className="bg-red-50 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          autoFocus
                          placeholder={`Why cancel ${e.entry_no}? e.g. entered twice`}
                          value={reason}
                          onChange={(ev) => setReason(ev.target.value)}
                          className="flex-1 min-w-[200px] px-3 py-1.5 text-sm rounded-lg border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-300"
                        />
                        <Button variant="outline" size="sm" onClick={() => setCancelling(null)}>
                          Keep
                        </Button>
                        <Button variant="danger" size="sm" loading={cancel.isPending} onClick={() => confirmCancel(e.id)}>
                          Cancel entry
                        </Button>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">The entry stays on record, marked cancelled, and drops out of the balances.</p>
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
                Total, cancelled left out
                {/* On phones the two amounts sit under the label, named */}
                <span className="md:hidden block text-sm font-normal tabular-nums">
                  <span className="text-green-700">{formatCurrency(moneyIn)} in</span> · {formatCurrency(moneyOut)} out
                </span>
              </td>
              <td data-hide className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-green-700">{formatCurrency(moneyIn)}</td>
              <td data-hide className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{formatCurrency(moneyOut)}</td>
              <td data-hide />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
