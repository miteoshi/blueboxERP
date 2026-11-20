'use client'

import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, StatCard } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { TableLoader } from '@/components/ui/spinner'
import { PAYMENT_MODES, paymentModeLabel, type PaymentMode } from '@/lib/hooks/use-finance'
import type { MoneyEntry, MoneyHead, RecordMoneyEntry, RecordedMoneyEntry } from '@/lib/money-entries'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { useRole } from '@/lib/hooks/use-profile'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils/format'
import { monthRange, reportPeriods } from '@/lib/utils/periods'
import { downloadCsv } from '@/lib/utils/csv'
import { Download, Plus, Receipt, Tags, type LucideIcon } from 'lucide-react'
import { useClosedPeriod } from '@/lib/hooks/use-books-lock'

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

// Everything that differs between the Expenses and Other Income pages
export type MoneyEntriesConfig = {
  title: string
  description: string
  csvName: string
  icon?: LucideIcon
  noun: string // "expense" / "income entry"
  nouns: string // "expenses" / "income entries"
  numberHeader: string // "Expense" / "Income"
  recordLabel: string // "Record expense"
  saveLabel: string // "Save expense"
  formTitle: string
  formHint: string
  amountMissing: string
  dateLabel: string // used in "… date cannot be in the future"
  partyLabel: string // "Paid to" / "Received from"
  partyPlaceholder: string
  notesPlaceholder: string
  totalLabel: string // "Spent in the period"
  totalUnderHead: string // "Spent under this head"
  cashLabel: string
  cashSub: string
  headsTitle: string // "Expense heads"
  headWord: string // "expense head" (for "Choose an expense head")
  newHeadPlaceholder: string
  emptyText: string
  footnote: ReactNode
  barClass: string
  useHeads: () => UseQueryResult<MoneyHead[]>
  useEntries: (from: string, to: string) => UseQueryResult<MoneyEntry[]>
  useRecord: () => UseMutationResult<RecordedMoneyEntry, Error, RecordMoneyEntry>
  useCancel: () => UseMutationResult<{ no: string }, Error, { id: string; reason: string }>
  useSaveHead: () => UseMutationResult<MoneyHead, Error, { name: string; id?: string; isActive?: boolean }>
}

export function MoneyEntriesPage({ config: c }: { config: MoneyEntriesConfig }) {
  const role = useRole()
  const canWrite = role === 'admin' || role === 'manager'

  const thisMonth = monthRange(0)
  const [from, setFrom] = useState(thisMonth.from)
  const [to, setTo] = useState(thisMonth.to)
  const [headFilter, setHeadFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showHeads, setShowHeads] = useState(false)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const { data: heads } = c.useHeads()
  const { data: entries, isLoading } = c.useEntries(from, to)
  const cancel = c.useCancel()
  const Icon = c.icon ?? Receipt

  const rows = useMemo(
    () => (entries ?? []).filter((e) => !headFilter || e.head_id === headFilter),
    [entries, headFilter]
  )
  const active = rows.filter((e) => e.status === 'active')
  const total = r2(active.reduce((s, e) => s + Number(e.amount), 0))

  const byHead = useMemo(() => {
    const map = new Map<string, { name: string; amount: number; count: number }>()
    for (const e of (entries ?? []).filter((x) => x.status === 'active')) {
      const r = map.get(e.head_id) ?? { name: e.head_name ?? '—', amount: 0, count: 0 }
      r.amount = r2(r.amount + Number(e.amount))
      r.count += 1
      map.set(e.head_id, r)
    }
    return [...map.entries()].map(([id, r]) => ({ id, ...r })).sort((a, b) => b.amount - a.amount)
  }, [entries])
  const periodTotal = r2(byHead.reduce((s, h) => s + h.amount, 0))
  const cashTotal = r2(active.filter((e) => e.mode === 'cash').reduce((s, e) => s + Number(e.amount), 0))

  function confirmCancel(id: string) {
    if (!reason.trim()) {
      toast.error('Give a reason')
      return
    }
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

  function exportCsv() {
    downloadCsv(`${c.csvName}-${from}_${to}`, rows, [
      { header: `${c.numberHeader} No`, value: (e) => e.no },
      { header: 'Date', value: (e) => e.date },
      { header: 'Head', value: (e) => e.head_name },
      { header: c.partyLabel, value: (e) => e.party },
      { header: 'Mode', value: (e) => paymentModeLabel(e.mode) },
      { header: 'Reference', value: (e) => e.reference },
      { header: 'Amount', value: (e) => Number(e.amount) },
      { header: 'Status', value: (e) => (e.status === 'cancelled' ? `Cancelled: ${e.cancel_reason ?? ''}` : 'Active') },
      { header: 'Notes', value: (e) => e.notes },
    ])
  }

  const presets = reportPeriods()

  return (
    <div>
      <PageHeader title={c.title} description={c.description}>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
        {canWrite && (
          <>
            <Button variant="outline" size="sm" onClick={() => setShowHeads((v) => !v)}>
              <Tags className="w-4 h-4" />
              {c.headsTitle}
            </Button>
            <Button size="sm" onClick={() => setShowForm(true)} disabled={showForm}>
              <Plus className="w-4 h-4" />
              {c.recordLabel}
            </Button>
          </>
        )}
      </PageHeader>

      {showForm && canWrite && <EntryForm config={c} heads={heads ?? []} onDone={() => setShowForm(false)} />}
      {showHeads && canWrite && <HeadsManager config={c} heads={heads ?? []} onClose={() => setShowHeads(false)} />}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <div className="min-w-0">
            <label htmlFor="entry-head-filter" className="block text-sm font-medium text-slate-700 mb-1.5">
              Head
            </label>
            <select
              id="entry-head-filter"
              value={headFilter}
              onChange={(e) => setHeadFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All heads</option>
              {heads?.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                  {h.is_active ? '' : ' (off)'}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {presets.map((p) => (
            <Button
              key={p.label}
              variant={from === p.from && to === p.to ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => {
                setFrom(p.from)
                setTo(p.to)
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
        {from > to && <p className="text-sm text-red-600">The period must start on or before the day it ends</p>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label={headFilter ? c.totalUnderHead : c.totalLabel}
          value={formatCurrency(total)}
          sub={`${active.length} ${active.length === 1 ? c.noun : c.nouns}`}
        />
        <StatCard label={c.cashLabel} value={formatCurrency(cashTotal)} sub={c.cashSub} />
        <StatCard
          label="Largest head"
          value={byHead[0] ? formatCurrency(byHead[0].amount) : '—'}
          sub={byHead[0] ? byHead[0].name : 'Nothing recorded'}
        />
        <StatCard
          label="Heads used"
          value={String(byHead.length)}
          sub={periodTotal ? `${formatCurrency(periodTotal)} across all heads` : undefined}
        />
      </div>

      {byHead.length > 1 && !headFilter && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">By head</h2>
          <div className="space-y-2">
            {byHead.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => setHeadFilter(h.id)}
                className="w-full text-left group"
                title={`Show only ${h.name}`}
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-slate-700 group-hover:text-blue-600 truncate">{h.name}</span>
                  <span className="tabular-nums text-slate-900 whitespace-nowrap">
                    {formatCurrency(h.amount)}
                    <span className="text-xs text-slate-400 ml-2">{Math.round((h.amount / periodTotal) * 100)}%</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                  <div className={`h-full rounded-full ${c.barClass}`} style={{ width: `${Math.max(2, (h.amount / byHead[0].amount) * 100)}%` }} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <TableLoader />
        ) : (
          <div className="overflow-x-auto">
            <table className="stack w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="text-left px-4 py-3">{c.numberHeader}</th>
                  <th className="text-left px-4 py-3">Head</th>
                  <th className="text-left px-4 py-3">{c.partyLabel}</th>
                  <th className="text-left px-4 py-3">Mode</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                      <Icon className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                      {c.emptyText}
                    </td>
                  </tr>
                )}
                {rows.map((e) => {
                  const off = e.status === 'cancelled'
                  return (
                    <Fragment key={e.id}>
                      <tr className={off ? 'opacity-60' : undefined}>
                        <td data-main className="px-4 py-3">
                          <span className={`font-mono font-semibold text-slate-900 whitespace-nowrap ${off ? 'line-through' : ''}`}>
                            {e.no}
                          </span>
                          <div className="text-xs text-slate-400">
                            {formatDate(e.date)}
                            {e.creator_name ? ` · ${e.creator_name}` : ''}
                          </div>
                          {off && (
                            <div className="mt-1">
                              <Badge variant="default">Cancelled</Badge>
                              {e.cancel_reason && <span className="ml-1 text-xs text-slate-500">{e.cancel_reason}</span>}
                            </div>
                          )}
                        </td>
                        <td data-label="Head" className="px-4 py-3 text-slate-700">{e.head_name ?? '—'}</td>
                        <td data-label={c.partyLabel} className="px-4 py-3 text-slate-700">
                          {e.party || '—'}
                          {e.notes && <div className="text-xs text-slate-400">{e.notes}</div>}
                        </td>
                        <td data-label="Mode" className="px-4 py-3 text-slate-600">
                          {paymentModeLabel(e.mode)}
                          {e.reference && <div className="text-xs text-slate-400">{e.reference}</div>}
                        </td>
                        <td data-label="Amount" className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                          {formatCurrency(Number(e.amount))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canWrite && !off && (
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
                                placeholder={`Why cancel ${e.no}? e.g. entered twice`}
                                value={reason}
                                onChange={(ev) => setReason(ev.target.value)}
                                className="flex-1 min-w-[200px] px-3 py-1.5 text-sm rounded-lg border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-300"
                              />
                              <Button variant="outline" size="sm" onClick={() => setCancelling(null)}>
                                Keep
                              </Button>
                              <Button variant="danger" size="sm" loading={cancel.isPending} onClick={() => confirmCancel(e.id)}>
                                Cancel {c.noun}
                              </Button>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">The {c.noun} stays on record, marked cancelled, and drops out of the totals.</p>
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
                    <td colSpan={4} className="px-4 py-3">
                      Total{headFilter ? ' for this head' : ''}, cancelled left out
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{formatCurrency(total)}</td>
                    <td data-hide />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
        <p className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100">{c.footnote}</p>
      </div>
    </div>
  )
}

function EntryForm({ config: c, heads, onDone }: { config: MoneyEntriesConfig; heads: MoneyHead[]; onDone: () => void }) {
  const record = c.useRecord()
  const [headId, setHeadId] = useState('')
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<PaymentMode>('cash')
  const [entryDate, setEntryDate] = useState(todayISO)
  const closed = useClosedPeriod()
  const [party, setParty] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const value = Number(amount)

  function submit(again: boolean) {
    if (!headId) return toast.error(`Choose an ${c.headWord}`)
    if (!(value > 0)) return toast.error(c.amountMissing)
    if (Math.round(value * 100) / 100 !== value) return toast.error('Amount can have at most 2 decimals')
    if (entryDate > todayISO()) return toast.error(`${c.dateLabel} date cannot be in the future`)
    if (closed.error(entryDate)) return toast.error(closed.error(entryDate))
    record.mutate(
      { headId, amount: value, mode, date: entryDate, party, reference, notes },
      {
        onSuccess: () => {
          if (!again) return onDone()
          // Keep head, mode and date: the next one is usually the same kind
          setAmount('')
          setParty('')
          setReference('')
          setNotes('')
        },
      }
    )
  }

  return (
    <Card className="mb-6 border-blue-200">
      <CardHeader>
        <h3 className="text-sm font-semibold text-slate-900">{c.formTitle}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{c.formHint}</p>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="entry-head" className="block text-sm font-medium text-slate-700 mb-1.5">
              Head <span className="text-red-500">*</span>
            </label>
            <select
              id="entry-head"
              value={headId}
              onChange={(e) => setHeadId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a head…</option>
              {heads.filter((h) => h.is_active).map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
          <Input label="Amount (₹)" type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input label="Date" type="date" min={closed.min()} error={closed.error(entryDate)} max={todayISO()} value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          <Input label={c.partyLabel} placeholder={c.partyPlaceholder} value={party} onChange={(e) => setParty(e.target.value)} />
          <div>
            <label htmlFor="entry-mode" className="block text-sm font-medium text-slate-700 mb-1.5">
              Mode
            </label>
            <select
              id="entry-mode"
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
          <Input
            label={mode === 'cash' ? 'Reference (optional)' : 'UTR / cheque / transaction no.'}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
          <div className="sm:col-span-3">
            <Input label="Notes" placeholder={c.notesPlaceholder} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={onDone}>
            Close
          </Button>
          <Button variant="outline" loading={record.isPending} onClick={() => submit(true)}>
            Save and add another
          </Button>
          <Button loading={record.isPending} onClick={() => submit(false)}>
            {c.saveLabel}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

function HeadsManager({ config: c, heads, onClose }: { config: MoneyEntriesConfig; heads: MoneyHead[]; onClose: () => void }) {
  const save = c.useSaveHead()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  function add() {
    if (!name.trim()) return toast.error('Give the head a name')
    save.mutate({ name }, { onSuccess: (h) => { setName(''); toast.success(`${h.name} added`) } })
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{c.headsTitle}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              A head that is switched off stays on old {c.nouns} but cannot be chosen for new ones.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px]">
            <Input label="New head" placeholder={c.newHeadPlaceholder} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button loading={save.isPending} onClick={add}>
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
        <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
          {heads.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              {editing === h.id ? (
                <>
                  <input
                    aria-label={`New name for ${h.name}`}
                    autoFocus
                    maxLength={60}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 min-w-[160px] px-2 py-1 text-sm rounded-lg border border-slate-300"
                  />
                  <Button
                    size="sm"
                    loading={save.isPending}
                    onClick={() =>
                      save.mutate(
                        { id: h.id, name: editName, isActive: h.is_active },
                        { onSuccess: () => { setEditing(null); toast.success('Head renamed') } }
                      )
                    }
                  >
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                    Keep
                  </Button>
                </>
              ) : (
                <>
                  <span className={`flex-1 min-w-0 text-sm ${h.is_active ? 'text-slate-900' : 'text-slate-400 line-through'}`}>{h.name}</span>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => {
                      setEditing(h.id)
                      setEditName(h.name)
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className={`text-xs hover:underline ${h.is_active ? 'text-red-600' : 'text-green-700'}`}
                    disabled={save.isPending}
                    onClick={() =>
                      save.mutate(
                        { id: h.id, name: h.name, isActive: !h.is_active },
                        { onSuccess: (r) => toast.success(r.is_active ? `${r.name} switched on` : `${r.name} switched off`) }
                      )
                    }
                  >
                    {h.is_active ? 'Switch off' : 'Switch on'}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  )
}
