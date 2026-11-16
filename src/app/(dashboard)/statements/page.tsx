'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatCard } from '@/components/ui/card'
import { PageLoader, TableLoader } from '@/components/ui/spinner'
import { useRole } from '@/lib/hooks/use-profile'
import { useStatement, useStatementParties } from '@/lib/hooks/use-statements'
import {
  balanceMeaning,
  balanceSide,
  statementDetail,
  statementDocHref,
  statementKindLabel,
  statementTotals,
  type StatementParty,
} from '@/lib/statement'
import { reportPeriods } from '@/lib/utils/periods'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { downloadCsv } from '@/lib/utils/csv'
import { Download, Printer, ScrollText } from 'lucide-react'

export default function StatementsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Statements />
    </Suspense>
  )
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// Matches the role checks in client_statement() and supplier_statement()
const CLIENT_ROLES = ['admin', 'manager', 'sales', 'viewer']
const SUPPLIER_ROLES = ['admin', 'manager', 'viewer']

function Statements() {
  const params = useSearchParams()
  const role = useRole()
  const canClient = !!role && CLIENT_ROLES.includes(role)
  const canSupplier = !!role && SUPPLIER_ROLES.includes(role)

  const presets = reportPeriods()
  const thisFy = presets[presets.length - 1]

  // Opened from Receivables or Payables with the account already chosen
  const linkedParty: StatementParty = params.get('party') === 'supplier' ? 'supplier' : 'client'
  const [party, setParty] = useState<StatementParty>(linkedParty)
  const [partyId, setPartyId] = useState(params.get('id') ?? '')
  const [from, setFrom] = useState(ISO_DATE.test(params.get('from') ?? '') ? params.get('from')! : thisFy.from)
  const [to, setTo] = useState(ISO_DATE.test(params.get('to') ?? '') ? params.get('to')! : thisFy.to)

  const allowed = party === 'client' ? canClient : canSupplier
  const { data: parties, isLoading: partiesLoading } = useStatementParties(party, allowed)
  const { data: rows, isLoading, error } = useStatement(party, allowed && partyId ? partyId : null, from, to)

  const selected = parties?.find((p) => p.id === partyId)
  const periodError = from && to && from > to ? 'The period must start on or before the day it ends' : null
  const totals = useMemo(() => statementTotals(rows ?? []), [rows])
  const noun = party === 'client' ? 'customer' : 'supplier'

  const switchParty = (next: StatementParty) => {
    if (next === party) return
    setParty(next)
    setPartyId('')
  }

  const signed = (amount: number) => {
    const side = balanceSide(party, amount)
    return `${formatCurrency(Math.abs(amount))}${side ? ` ${side}` : ''}`
  }

  const exportCsv = () => {
    if (!rows?.length || !selected) return
    downloadCsv(`statement-${selected.name}-${from}-to-${to}`, rows, [
      { header: 'Date', value: (r) => r.entry_date },
      { header: 'Type', value: (r) => statementKindLabel(r.kind) },
      { header: 'Document', value: (r) => r.doc_no },
      { header: 'Particulars', value: (r) => statementDetail(r) },
      { header: 'Debit', value: (r) => (r.debit ? r.debit : null) },
      { header: 'Credit', value: (r) => (r.credit ? r.credit : null) },
      { header: 'Balance', value: (r) => Math.abs(r.balance) },
      { header: 'Dr/Cr', value: (r) => balanceSide(party, r.balance) },
    ])
  }

  const printHref = `/api/pdf?type=${party}_statement&id=${partyId}&from=${from}&to=${to}`
  const ready = !!rows?.length && !!selected && !periodError

  if (role && !canClient && !canSupplier) {
    return (
      <div>
        <PageHeader title="Statement of Account" description="Every invoice, payment and note on one account" />
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          Your role cannot see account statements.
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Statement of Account"
        description="Every invoice, payment and note on one account, with the balance after each"
      >
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!ready}>
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
        {ready ? (
          <a href={printHref} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <Printer className="w-4 h-4" />
              Print
            </Button>
          </a>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <Printer className="w-4 h-4" />
            Print
          </Button>
        )}
      </PageHeader>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)] gap-4 md:items-end">
          {canClient && canSupplier && (
            <div className="space-y-1">
              <span className="block text-sm font-medium text-slate-700">Account type</span>
              <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
                {(['client', 'supplier'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => switchParty(p)}
                    aria-pressed={party === p}
                    className={`px-4 py-2 text-sm font-medium ${
                      party === p ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {p === 'client' ? 'Customer' : 'Supplier'}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-1 min-w-0">
            <label htmlFor="statement-party" className="block text-sm font-medium text-slate-700">
              {party === 'client' ? 'Customer' : 'Supplier'}
            </label>
            <select
              id="statement-party"
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              disabled={partiesLoading || !allowed}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{partiesLoading ? 'Loading…' : `Choose a ${noun}…`}</option>
              {parties?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.is_active ? '' : ' (inactive)'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Input label="From" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
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
        </div>
        {periodError && <p className="text-sm text-red-600">{periodError}</p>}
      </div>

      {!partyId ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <ScrollText className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Choose a {noun} to see the statement.</p>
        </div>
      ) : periodError ? null : error ? (
        <div className="bg-white rounded-xl border border-red-200 p-6 text-sm text-red-700">
          {(error as Error).message || 'The statement could not be loaded.'}
        </div>
      ) : isLoading || !rows ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <TableLoader />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Opening balance" value={signed(totals.opening)} sub={`as on ${formatDate(from)}`} />
            <StatCard
              label={party === 'client' ? 'Invoiced' : 'Paid and debited'}
              value={formatCurrency(totals.debit)}
              sub="debits in the period"
            />
            <StatCard
              label={party === 'client' ? 'Received and credited' : 'Billed'}
              value={formatCurrency(totals.credit)}
              sub="credits in the period"
            />
            <StatCard
              label="Closing balance"
              value={signed(totals.closing)}
              sub={balanceMeaning(party, totals.closing)}
              className={
                // Amber while money is still owed, green when the account is in advance
                Math.abs(totals.closing) < 0.005 ? undefined : totals.closing > 0 ? 'border-amber-200' : 'border-green-200'
              }
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold text-slate-900 break-words">{selected?.name ?? 'Statement'}</h2>
              <span className="text-xs text-slate-500">
                {formatDate(from)} to {formatDate(to)} · {totals.count} {totals.count === 1 ? 'entry' : 'entries'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="stack w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Document</th>
                    <th className="text-left px-4 py-3">Particulars</th>
                    <th className="text-right px-4 py-3">Debit</th>
                    <th className="text-right px-4 py-3">Credit</th>
                    <th className="text-right px-4 py-3">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => {
                    const href = statementDocHref(r)
                    const opening = r.kind === 'opening'
                    return (
                      <tr key={r.seq} className={opening ? 'bg-slate-50/60' : undefined}>
                        <td data-label="Date" className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                          {formatDate(r.entry_date)}
                        </td>
                        <td data-main className="px-4 py-2.5">
                          {opening ? (
                            <span className="font-medium text-slate-700">Opening balance</span>
                          ) : (
                            <>
                              {href ? (
                                <Link href={href as Route} className="font-mono text-blue-600 hover:underline whitespace-nowrap">
                                  {r.doc_no}
                                </Link>
                              ) : (
                                <span className="font-mono text-slate-900 whitespace-nowrap">{r.doc_no}</span>
                              )}
                              <div className="text-xs text-slate-400">{statementKindLabel(r.kind)}</div>
                            </>
                          )}
                        </td>
                        <td data-label="Particulars" className="px-4 py-2.5 text-slate-600">
                          {opening ? 'Brought forward' : statementDetail(r) || '—'}
                        </td>
                        <td data-label="Debit" className="px-4 py-2.5 text-right tabular-nums">
                          {r.debit ? formatCurrency(r.debit) : '—'}
                        </td>
                        <td data-label="Credit" className="px-4 py-2.5 text-right tabular-nums">
                          {r.credit ? formatCurrency(r.credit) : '—'}
                        </td>
                        <td data-label="Balance" className="px-4 py-2.5 text-right tabular-nums font-medium whitespace-nowrap">
                          {signed(r.balance)}
                        </td>
                      </tr>
                    )
                  })}
                  {totals.count === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                        Nothing was recorded on this account in the period.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
                    <td colSpan={3} className="px-4 py-3">
                      Closing balance as on {formatDate(to)}
                    </td>
                    <td data-hide className="px-4 py-3 text-right tabular-nums">{formatCurrency(totals.debit)}</td>
                    <td data-hide className="px-4 py-3 text-right tabular-nums">{formatCurrency(totals.credit)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className="whitespace-nowrap">{signed(totals.closing)}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Cancelled documents are left out. Dr means {party === 'client' ? 'the customer owes you' : 'the supplier owes you'};
            Cr means {party === 'client' ? 'you hold their advance' : 'you owe the supplier'}.
          </p>
        </>
      )}
    </div>
  )
}
