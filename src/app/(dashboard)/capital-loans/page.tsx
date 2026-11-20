'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { TableLoader } from '@/components/ui/spinner'
import { FundingAccountForm, FundingAccountsTable, FundingEntryForm, FundingEntryList } from '@/components/finance/funding'
import { useFundingBalances, useFundingEntries, type FundingAccount } from '@/lib/hooks/use-funding'
import { paymentModeLabel } from '@/lib/hooks/use-finance'
import { useRole } from '@/lib/hooks/use-profile'
import { financialYear } from '@/lib/gst'
import { fundingEntryLabel } from '@/lib/funding'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils/format'
import { reportPeriods } from '@/lib/utils/periods'
import { downloadCsv } from '@/lib/utils/csv'
import { Download, Landmark, Plus } from 'lucide-react'

// Same roles as funding_balances() and the read policies
const ROLES = ['admin', 'manager', 'viewer']

const r2 = (n: number) => Math.round(n * 100) / 100

export default function CapitalAndLoansPage() {
  const role = useRole()
  const allowed = !!role && ROLES.includes(role)
  const canEdit = role === 'admin' || role === 'manager'
  const today = todayISO()
  const fy = financialYear(today)

  const [asOf, setAsOf] = useState(today)
  const [from, setFrom] = useState(fy.from)
  const [to, setTo] = useState(fy.to)
  const [form, setForm] = useState<'entry' | 'account' | null>(null)
  const [editing, setEditing] = useState<FundingAccount | null>(null)

  const { data: balances, isLoading: loadingBalances, error } = useFundingBalances(asOf, allowed)
  // Today's balances, for the entry form (what is still owed now)
  const { data: current } = useFundingBalances(today, allowed && asOf !== today)
  const { data: entries, isLoading: loadingEntries } = useFundingEntries(from, to, allowed)

  if (role && !allowed) {
    return (
      <div>
        <PageHeader title="Capital & Loans" description="Owners' capital, drawings and loans taken" />
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Your role cannot see capital and loans.</div>
      </div>
    )
  }

  const accounts = balances?.accounts ?? []
  const active = (entries ?? []).filter((e) => e.status === 'active')
  const sum = (pick: (e: (typeof active)[number]) => boolean, value: (e: (typeof active)[number]) => number) =>
    r2(active.filter(pick).reduce((s, e) => s + value(e), 0))
  const introduced = sum((e) => e.account?.kind === 'capital' && e.direction === 'in', (e) => Number(e.amount))
  const drawings = sum((e) => e.account?.kind === 'capital' && e.direction === 'out', (e) => Number(e.amount))
  const interest = sum((e) => Number(e.interest) > 0, (e) => Number(e.interest))

  function exportCsv() {
    downloadCsv(`capital-and-loans-${from}_${to}`, entries ?? [], [
      { header: 'Entry No', value: (e) => e.entry_no },
      { header: 'Date', value: (e) => e.entry_date },
      { header: 'Account', value: (e) => e.account?.name },
      { header: 'Type', value: (e) => (e.account ? fundingEntryLabel(e.account.kind, e.direction) : '') },
      { header: 'Money In', value: (e) => (e.direction === 'in' ? Number(e.total) : null) },
      { header: 'Money Out', value: (e) => (e.direction === 'out' ? Number(e.total) : null) },
      { header: 'Of Which Interest', value: (e) => (Number(e.interest) > 0 ? Number(e.interest) : null) },
      { header: 'Mode', value: (e) => paymentModeLabel(e.mode) },
      { header: 'Reference', value: (e) => e.reference },
      { header: 'Status', value: (e) => (e.status === 'cancelled' ? `Cancelled: ${e.cancel_reason ?? ''}` : 'Active') },
      { header: 'Notes', value: (e) => e.notes },
    ])
  }

  const presets = reportPeriods()
  const formAccounts = (asOf === today ? balances : current)?.accounts ?? []

  return (
    <div>
      <PageHeader title="Capital & Loans" description="Money the owners put in or take out, and loans taken and repaid">
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!entries?.length}>
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
        {canEdit && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(null)
                setForm(form === 'account' && !editing ? null : 'account')
              }}
            >
              <Landmark className="w-4 h-4" />
              New account
            </Button>
            <Button size="sm" onClick={() => setForm('entry')} disabled={form === 'entry' || accounts.length === 0}>
              <Plus className="w-4 h-4" />
              Record entry
            </Button>
          </>
        )}
      </PageHeader>

      {canEdit && form === 'account' && (
        <FundingAccountForm
          key={editing?.id ?? 'new'}
          account={editing ?? undefined}
          onDone={() => {
            setForm(null)
            setEditing(null)
          }}
        />
      )}
      {canEdit && form === 'entry' && <FundingEntryForm accounts={formAccounts} onDone={() => setForm(null)} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Owners' capital"
          value={balances ? formatCurrency(balances.capital.amount) : '—'}
          sub={balances ? `on ${formatDate(balances.as_of)}` : undefined}
        />
        <StatCard
          label="Loans still owed"
          value={balances ? formatCurrency(balances.loans.amount) : '—'}
          sub={balances ? `${balances.loans.accounts} ${balances.loans.accounts === 1 ? 'loan' : 'loans'} with a balance` : undefined}
          className={balances && balances.loans.amount > 0 ? 'border-amber-200' : undefined}
        />
        <StatCard
          label="Capital in less drawings"
          value={`${introduced - drawings < 0 ? '−' : ''}${formatCurrency(Math.abs(r2(introduced - drawings)))}`}
          sub={`${formatCurrency(introduced)} in, ${formatCurrency(drawings)} drawn, in the period`}
        />
        <StatCard
          label="Loan interest paid"
          value={formatCurrency(interest)}
          sub="in the period — an expense in the Profit & Loss"
          className={interest > 0 ? 'border-amber-200' : undefined}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Accounts</h2>
            <p className="text-xs text-slate-500">Opening balance, then the entries after its opening date</p>
          </div>
          <Input label="As on" type="date" max={today} value={asOf} onChange={(e) => setAsOf(e.target.value || today)} />
        </div>
        {error ? (
          <div className="p-6 text-sm text-red-700">{(error as Error).message}</div>
        ) : loadingBalances ? (
          <TableLoader />
        ) : accounts.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 space-y-3">
            <Landmark className="w-6 h-6 mx-auto text-slate-300" />
            <p>No capital or loan accounts yet.</p>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setForm('account')}>
                Add the first account
              </Button>
            )}
          </div>
        ) : (
          <FundingAccountsTable
            accounts={accounts}
            asOf={asOf}
            canEdit={canEdit}
            onEdit={(a) => {
              setEditing(a)
              setForm('account')
            }}
          />
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <Input label="Entries from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loadingEntries ? <TableLoader /> : <FundingEntryList rows={entries ?? []} canEdit={canEdit} />}
        <div className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100 space-y-1">
          <p>
            Entries move the cash or bank balance by their mode and show in the{' '}
            <Link href={'/reports/cash-book' as Route} className="underline">
              Cash &amp; Bank Book
            </Link>{' '}
            and{' '}
            <Link href={'/reports/bank-reconciliation' as Route} className="underline">
              Bank Reconciliation
            </Link>
            . Capital, drawings and loan principal are not income or expense; loan interest is, so it appears in the{' '}
            <Link href={'/reports/profit-loss' as Route} className="underline">
              Profit &amp; Loss
            </Link>
            .
          </p>
          <p>
            The{' '}
            <Link href={'/reports/position' as Route} className="underline">
              Financial Position
            </Link>{' '}
            counts loans still owed, and shows the owners&apos; capital beside the net worth. A repayment cannot be more than
            the principal still owed.
          </p>
        </div>
      </div>
    </div>
  )
}
