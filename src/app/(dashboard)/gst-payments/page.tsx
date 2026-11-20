'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { TableLoader } from '@/components/ui/spinner'
import { GstLedgerTable, GstOpeningForm, GstPaymentForm, GstPaymentList, ledgerSetOff } from '@/components/finance/gst-payments'
import { useGstLedger, useGstOpening, useGstPayments } from '@/lib/hooks/use-gst-payments'
import { paymentModeLabel } from '@/lib/hooks/use-finance'
import { useRole } from '@/lib/hooks/use-profile'
import { financialYear } from '@/lib/gst'
import { GST_HEADS, GST_HEAD_LABEL, gstStanding, returnPeriodLabel } from '@/lib/gst-payments'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils/format'
import { reportPeriods } from '@/lib/utils/periods'
import { downloadCsv } from '@/lib/utils/csv'
import { AlertTriangle, Download, Plus, SlidersHorizontal } from 'lucide-react'

// Same roles as gst_ledger() and the read policies on gst_payments
const ROLES = ['admin', 'manager', 'viewer']

const r2 = (n: number) => Math.round(n * 100) / 100

export default function GstPaymentsPage() {
  const role = useRole()
  const allowed = !!role && ROLES.includes(role)
  const canEdit = role === 'admin' || role === 'manager'
  const today = todayISO()
  const fy = financialYear(today)

  const [asOf, setAsOf] = useState(today)
  const [from, setFrom] = useState(fy.from)
  const [to, setTo] = useState(fy.to)
  const [form, setForm] = useState<'payment' | 'opening' | null>(null)

  const { data: ledger, isLoading: loadingLedger, error: ledgerError } = useGstLedger(asOf, allowed)
  const { data: opening } = useGstOpening(allowed)
  const { data: payments, isLoading: loadingPayments } = useGstPayments(from, to, allowed)

  if (role && !allowed) {
    return (
      <div>
        <PageHeader title="GST Payments" description="GST paid to the government, and what is still payable" />
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Your role cannot see GST payments.</div>
      </div>
    )
  }

  const setLedger = ledger?.set ? ledger : null
  const standing = setLedger ? gstStanding(setLedger.balance) : null
  const setOff = setLedger ? ledgerSetOff(setLedger) : null
  const cashToPay = setOff ? r2(GST_HEADS.reduce((s, h) => s + setOff.cash[h], 0)) : 0
  const carried = setOff ? r2(GST_HEADS.reduce((s, h) => s + setOff.carriedForward[h], 0)) : 0
  // Spare credit under one head that cannot pay another (CGST cannot pay SGST)
  const blocked = standing && setOff && cashToPay > 0 && carried > 0

  const active = (payments ?? []).filter((p) => p.status === 'active')
  const taxPaid = r2(active.reduce((s, p) => s + Number(p.igst) + Number(p.cgst) + Number(p.sgst), 0))
  const extraPaid = r2(active.reduce((s, p) => s + Number(p.interest) + Number(p.late_fee), 0))

  function exportCsv() {
    downloadCsv(`gst-payments-${from}_${to}`, payments ?? [], [
      { header: 'Challan No', value: (p) => p.payment_no },
      { header: 'Date', value: (p) => p.payment_date },
      { header: 'Return Period', value: (p) => returnPeriodLabel(p.period) },
      { header: 'IGST', value: (p) => Number(p.igst) },
      { header: 'CGST', value: (p) => Number(p.cgst) },
      { header: 'SGST', value: (p) => Number(p.sgst) },
      { header: 'Interest', value: (p) => Number(p.interest) },
      { header: 'Late Fee', value: (p) => Number(p.late_fee) },
      { header: 'Amount', value: (p) => Number(p.amount) },
      { header: 'Mode', value: (p) => paymentModeLabel(p.mode) },
      { header: 'CPIN / CIN', value: (p) => p.reference },
      { header: 'Status', value: (p) => (p.status === 'cancelled' ? `Cancelled: ${p.cancel_reason ?? ''}` : 'Active') },
      { header: 'Notes', value: (p) => p.notes },
    ])
  }

  const presets = reportPeriods()

  return (
    <div>
      <PageHeader title="GST Payments" description="GST paid to the government by challan, and what is still payable or held as credit">
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!payments?.length}>
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
        {canEdit && (
          <>
            <Button variant="outline" size="sm" onClick={() => setForm(form === 'opening' ? null : 'opening')}>
              <SlidersHorizontal className="w-4 h-4" />
              Opening position
            </Button>
            <Button size="sm" onClick={() => setForm('payment')} disabled={form === 'payment'}>
              <Plus className="w-4 h-4" />
              Record GST payment
            </Button>
          </>
        )}
      </PageHeader>

      {canEdit && form === 'opening' && (
        // Remount once the saved opening arrives, so the form starts from it
        <GstOpeningForm key={opening?.updated_at ?? 'none'} opening={opening} onDone={() => setForm(null)} />
      )}
      {canEdit && form === 'payment' && (
        <GstPaymentForm payable={setLedger && setOff ? { asOf: setLedger.as_of, cash: setOff.cash } : null} onDone={() => setForm(null)} />
      )}

      {ledger && !ledger.set && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-900 flex gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
          <div className="space-y-2 min-w-0">
            {ledger.before_opening && ledger.opening_as_of ? (
              <p>
                The GST opening position is for {formatDate(ledger.opening_as_of)}. Choose a day on or after it to see the ledger.
              </p>
            ) : (
              <>
                <p>
                  No GST opening position yet. Set where GST stood at the end of a day — the tax still unpaid and the input
                  credit in hand, from your last filed return — and the app keeps the ledger from there, using your invoices,
                  bills, notes and the challans recorded here.
                </p>
                <p>
                  Until then GST is left out of the{' '}
                  <Link href={'/reports/position' as Route} className="underline">
                    Financial Position
                  </Link>
                  . Challans can still be recorded.
                </p>
                {canEdit && form !== 'opening' && (
                  <Button size="sm" variant="outline" onClick={() => setForm('opening')}>
                    Set the opening position
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label={standing?.kind === 'credit' ? 'Credit in hand' : 'GST payable'}
          value={standing ? formatCurrency(standing.amount) : '—'}
          sub={setLedger ? `net of all heads, on ${formatDate(setLedger.as_of)}` : 'No opening position'}
          className={standing?.kind === 'payable' ? 'border-amber-200' : standing?.kind === 'credit' ? 'border-green-200' : undefined}
        />
        <StatCard
          label="To pay in cash"
          value={setOff ? formatCurrency(cashToPay) : '—'}
          sub={setOff ? (carried > 0 ? `after using credit; ${formatCurrency(carried)} carried forward` : 'after using the credit in hand') : undefined}
        />
        <StatCard label="Tax paid in the period" value={formatCurrency(taxPaid)} sub={`${active.length} ${active.length === 1 ? 'challan' : 'challans'}`} />
        <StatCard
          label="Interest and late fee"
          value={formatCurrency(extraPaid)}
          sub="in the period — an expense in the Profit & Loss"
          className={extraPaid > 0 ? 'border-amber-200' : undefined}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">GST ledger</h2>
            <p className="text-xs text-slate-500">Head by head, before setting credit against tax</p>
          </div>
          <Input label="As on" type="date" max={today} value={asOf} onChange={(e) => setAsOf(e.target.value || today)} />
        </div>
        {ledgerError ? (
          <div className="p-6 text-sm text-red-700">{(ledgerError as Error).message}</div>
        ) : loadingLedger ? (
          <TableLoader />
        ) : setLedger ? (
          <>
            <GstLedgerTable ledger={setLedger} />
            {blocked && setOff && (
              <p className="px-4 py-3 text-xs text-amber-800 bg-amber-50 border-t border-amber-100">
                Credit under one head cannot always pay another — CGST credit cannot pay SGST, nor SGST credit CGST. So{' '}
                {GST_HEADS.filter((h) => setOff.cash[h] > 0)
                  .map((h) => `${GST_HEAD_LABEL[h]} ${formatCurrency(setOff.cash[h])}`)
                  .join(', ')}{' '}
                is to be paid in cash while{' '}
                {GST_HEADS.filter((h) => setOff.carriedForward[h] > 0)
                  .map((h) => `${GST_HEAD_LABEL[h]} ${formatCurrency(setOff.carriedForward[h])}`)
                  .join(', ')}{' '}
                of credit carries forward.
              </p>
            )}
          </>
        ) : (
          <div className="p-8 text-center text-sm text-slate-400">The ledger starts once the opening position is set.</div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <Input label="Challans from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
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
        {loadingPayments ? <TableLoader /> : <GstPaymentList rows={payments ?? []} canEdit={canEdit} />}
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
            . The tax itself is not a cost — it was collected on sales — but interest and late fee are, so they appear in the{' '}
            <Link href={'/reports/profit-loss' as Route} className="underline">
              Profit &amp; Loss
            </Link>
            .
          </p>
          <p>
            The ledger leaves out reverse-charge invoices (the buyer pays that tax) and bills without a supplier GSTIN (no
            credit can be claimed on them). It does not know about credit you choose not to claim, or tax paid on imports;
            adjust the opening position if those matter.
          </p>
        </div>
      </div>
    </div>
  )
}
