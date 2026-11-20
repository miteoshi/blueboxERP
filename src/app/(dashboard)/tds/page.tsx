'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { TableLoader } from '@/components/ui/spinner'
import { TdsDeductionList, TdsDepositForm, TdsDepositList, TdsMonthsTable, TdsOpeningForm } from '@/components/finance/tds'
import { useTdsDeductions, useTdsDeposits, useTdsLedger, useTdsOpening } from '@/lib/hooks/use-tds'
import { paymentModeLabel } from '@/lib/hooks/use-finance'
import { useRole } from '@/lib/hooks/use-profile'
import { financialYear } from '@/lib/gst'
import { returnPeriodLabel } from '@/lib/gst-payments'
import { deducteePan, tdsCodeLabel, tdsQuarter } from '@/lib/tds'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils/format'
import { reportPeriods } from '@/lib/utils/periods'
import { downloadCsv } from '@/lib/utils/csv'
import { AlertTriangle, Download, Plus, SlidersHorizontal } from 'lucide-react'

// Same roles as tds_ledger() and the read policies on tds_deposits
const ROLES = ['admin', 'manager', 'viewer']

const r2 = (n: number) => Math.round(n * 100) / 100

export default function TdsPage() {
  const role = useRole()
  const allowed = !!role && ROLES.includes(role)
  const canEdit = role === 'admin' || role === 'manager'
  const today = todayISO()
  const fy = financialYear(today)

  const [asOf, setAsOf] = useState(today)
  const [from, setFrom] = useState(fy.from)
  const [to, setTo] = useState(fy.to)
  const [form, setForm] = useState<'deposit' | 'opening' | null>(null)

  const { data: ledger, isLoading: loadingLedger, error: ledgerError } = useTdsLedger(asOf, allowed)
  const { data: opening } = useTdsOpening(allowed)
  const { data: deposits, isLoading: loadingDeposits } = useTdsDeposits(from, to, allowed)
  const { data: deductions, isLoading: loadingDeductions } = useTdsDeductions(from, to, allowed)

  if (role && !allowed) {
    return (
      <div>
        <PageHeader title="TDS" description="TDS deducted from suppliers, and deposited with the government" />
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Your role cannot see TDS.</div>
      </div>
    )
  }

  const setLedger = ledger?.set ? ledger : null
  const months = setLedger?.months ?? []
  const overdue = months.filter((m) => m.overdue)
  const overdueAmount = r2(overdue.reduce((s, m) => s + m.outstanding, 0))
  const deducted = r2((deductions ?? []).reduce((s, p) => s + p.tds, 0))
  const activeDeposits = (deposits ?? []).filter((d) => d.status === 'active')
  const charges = r2(activeDeposits.reduce((s, d) => s + Number(d.interest) + Number(d.late_fee), 0))

  // The deductions as the quarterly return wants them, one row per payment
  function exportDeductions() {
    downloadCsv(`tds-deductions-${from}_${to}`, deductions ?? [], [
      { header: 'Quarter', value: (p) => tdsQuarter(p.date).label },
      { header: 'Entry No', value: (p) => p.no },
      { header: 'Entry', value: (p) => (p.kind === 'expense' ? 'Expense' : 'Supplier payment') },
      { header: 'Date of Payment', value: (p) => p.date },
      { header: 'Deductee', value: (p) => p.party },
      { header: 'PAN', value: (p) => deducteePan(p.pan, p.gstin) ?? 'PANNOTAVBL' },
      { header: 'Payment Code', value: (p) => p.code },
      { header: 'Nature of Payment', value: (p) => tdsCodeLabel(p.code) },
      { header: 'Amount Paid / Credited', value: (p) => p.base },
      { header: 'Rate %', value: (p) => p.rate },
      { header: 'TDS', value: (p) => p.tds },
      { header: 'Paid to Deductee', value: (p) => p.paid },
      { header: 'Mode', value: (p) => paymentModeLabel(p.mode) },
      { header: 'Reference', value: (p) => p.reference },
    ])
  }

  function exportDeposits() {
    downloadCsv(`tds-deposits-${from}_${to}`, deposits ?? [], [
      { header: 'Challan No', value: (d) => d.deposit_no },
      { header: 'Date', value: (d) => d.deposit_date },
      { header: 'For Month', value: (d) => returnPeriodLabel(d.period) },
      { header: 'Payment Code', value: (d) => d.tds_code },
      { header: 'TDS', value: (d) => Number(d.tax) },
      { header: 'Interest', value: (d) => Number(d.interest) },
      { header: 'Late Fee', value: (d) => Number(d.late_fee) },
      { header: 'Amount', value: (d) => Number(d.amount) },
      { header: 'Mode', value: (d) => paymentModeLabel(d.mode) },
      { header: 'Challan / CIN', value: (d) => d.reference },
      { header: 'Status', value: (d) => (d.status === 'cancelled' ? `Cancelled: ${d.cancel_reason ?? ''}` : 'Active') },
      { header: 'Notes', value: (d) => d.notes },
    ])
  }

  const lastQuarter = tdsQuarter(
    (() => {
      const q = tdsQuarter(today)
      const d = new Date(`${q.from}T00:00:00Z`)
      d.setUTCDate(0)
      return d.toISOString().slice(0, 10)
    })(),
  )
  const presets = [...reportPeriods(), { label: `Last quarter (${lastQuarter.label})`, from: lastQuarter.from, to: lastQuarter.to }]

  return (
    <div>
      <PageHeader title="TDS" description="TDS deducted from supplier payments and expenses, what is still to deposit, and the challans paid">
        <Button variant="outline" size="sm" onClick={exportDeductions} disabled={!deductions?.length}>
          <Download className="w-4 h-4" />
          Deductions CSV
        </Button>
        <Button variant="outline" size="sm" onClick={exportDeposits} disabled={!deposits?.length}>
          <Download className="w-4 h-4" />
          Challans CSV
        </Button>
        {canEdit && (
          <>
            <Button variant="outline" size="sm" onClick={() => setForm(form === 'opening' ? null : 'opening')}>
              <SlidersHorizontal className="w-4 h-4" />
              Opening
            </Button>
            <Button size="sm" onClick={() => setForm('deposit')} disabled={form === 'deposit'}>
              <Plus className="w-4 h-4" />
              Record TDS deposit
            </Button>
          </>
        )}
      </PageHeader>

      {canEdit && form === 'opening' && (
        // Remount once the saved opening arrives, so the form starts from it
        <TdsOpeningForm key={opening?.updated_at ?? 'none'} opening={opening} onDone={() => setForm(null)} />
      )}
      {canEdit && form === 'deposit' && <TdsDepositForm months={months} onDone={() => setForm(null)} />}

      {ledger && !ledger.set && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-900 flex gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
          <p>The TDS opening is for {formatDate(ledger.opening_as_of)}. Choose a day on or after it to see the ledger.</p>
        </div>
      )}

      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-900 flex gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
          <p>
            {formatCurrency(overdueAmount)} of TDS is past its due date ({overdue.map((m) => returnPeriodLabel(m.period)).join(', ')}).
            Interest is charged for each month or part of a month it is late; deposit it and record the challan here.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label={setLedger && setLedger.balance < 0 ? 'Deposited in excess' : 'TDS to deposit'}
          value={setLedger ? formatCurrency(Math.abs(setLedger.balance)) : '—'}
          sub={setLedger ? `on ${formatDate(setLedger.as_of)}` : undefined}
          className={setLedger && setLedger.balance > 0 ? 'border-amber-200' : undefined}
        />
        <StatCard
          label="Overdue"
          value={formatCurrency(overdueAmount)}
          sub={overdue.length ? `${overdue.length} ${overdue.length === 1 ? 'month' : 'months'} past the due date` : 'Nothing past its due date'}
          className={overdueAmount > 0 ? 'border-red-200' : undefined}
        />
        <StatCard
          label="Deducted in the period"
          value={formatCurrency(deducted)}
          sub={`${deductions?.length ?? 0} ${(deductions?.length ?? 0) === 1 ? 'payment' : 'payments'}`}
        />
        <StatCard
          label="Interest and late fee"
          value={formatCurrency(charges)}
          sub="in the period — an expense in the Profit & Loss"
          className={charges > 0 ? 'border-amber-200' : undefined}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">TDS ledger</h2>
            <p className="text-xs text-slate-500">
              {setLedger?.opening_as_of
                ? `From the opening of ${formatCurrency(setLedger.opening)} on ${formatDate(setLedger.opening_as_of)}`
                : 'Every TDS deducted and deposited in the app'}
            </p>
          </div>
          <Input label="As on" type="date" max={today} value={asOf} onChange={(e) => setAsOf(e.target.value || today)} />
        </div>
        {ledgerError ? (
          <div className="p-6 text-sm text-red-700">{(ledgerError as Error).message}</div>
        ) : loadingLedger ? (
          <TableLoader />
        ) : setLedger ? (
          <TdsMonthsTable months={months} asOf={setLedger.as_of} />
        ) : null}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Deducted</h2>
          <p className="text-xs text-slate-500">
            Deduct TDS when paying a supplier under{' '}
            <Link href={'/payables' as Route} className="underline">
              Payables
            </Link>{' '}
            or recording rent, fees or labour under{' '}
            <Link href={'/expenses' as Route} className="underline">
              Expenses
            </Link>
            . The CSV has what the quarterly return asks for, one row per deduction.
          </p>
        </div>
        {loadingDeductions ? <TableLoader /> : <TdsDeductionList rows={deductions ?? []} />}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Deposited (challans)</h2>
        </div>
        {loadingDeposits ? <TableLoader /> : <TdsDepositList rows={deposits ?? []} canEdit={canEdit} />}
        <div className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100 space-y-1">
          <p>
            A challan reduces the cash or bank balance by its mode and shows in the{' '}
            <Link href={'/reports/cash-book' as Route} className="underline">
              Cash &amp; Bank Book
            </Link>{' '}
            and{' '}
            <Link href={'/reports/bank-reconciliation' as Route} className="underline">
              Bank Reconciliation
            </Link>
            . The TDS itself is not a cost — it was part of what you owed the supplier — but interest and late fee are, so they appear in
            the{' '}
            <Link href={'/reports/profit-loss' as Route} className="underline">
              Profit &amp; Loss
            </Link>
            .
          </p>
          <p>
            Payment codes are those of the Income-tax Act 2025, in force from 1 April 2026. Rates and thresholds shown are a guide; check
            them with your tax adviser.
          </p>
        </div>
      </div>
    </div>
  )
}
