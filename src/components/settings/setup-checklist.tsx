'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useSetupReadiness } from '@/lib/hooks/use-setup'
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react'

type Step = {
  done: boolean
  blocking: boolean
  title: string
  detail: React.ReactNode
  href: Route
  action: string
}

/**
 * The gaps that stop an invoice being raised, shown before the user starts
 * one rather than when the save fails. Hidden entirely once nothing is
 * blocking and nothing is waiting.
 */
export function SetupChecklist() {
  const { data } = useSetupReadiness()
  if (!data) return null

  const steps: Step[] = [
    {
      done: data.has_gstin === true && data.has_state_code === true,
      blocking: true,
      title: 'Company GSTIN and state',
      detail: 'Every tax invoice carries them, and they decide CGST/SGST against IGST. No invoice can be raised without them.',
      href: '/settings?tab=Company' as Route,
      action: 'Open company settings',
    },
    {
      done: data.has_address === true,
      blocking: false,
      title: 'Company address',
      detail: 'Printed on invoices and challans. Without it the document looks unfinished to the buyer.',
      href: '/settings?tab=Company' as Route,
      action: 'Add address',
    },
    {
      done: data.has_bank_details === true,
      blocking: false,
      title: 'Bank details',
      detail: 'Printed on the invoice so the client knows where to pay.',
      href: '/settings?tab=Company' as Route,
      action: 'Add bank details',
    },
    {
      done: (data.clients_missing_state ?? 0) === 0,
      blocking: true,
      title: `${data.clients_missing_state} client${data.clients_missing_state === 1 ? '' : 's'} without a state`,
      detail: (
        <>
          A client with no state and no GSTIN cannot be invoiced, because the tax split cannot be worked out.
          {data.clients.length > 0 && (
            <>
              {' '}
              {data.clients.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && ', '}
                  <span className="font-medium">{c.name}</span>
                  {c.state ? <span className="text-slate-500"> (has &ldquo;{c.state}&rdquo;)</span> : null}
                </span>
              ))}
              {(data.clients_missing_state ?? 0) > data.clients.length &&
                ` and ${(data.clients_missing_state ?? 0) - data.clients.length} more`}
              .
            </>
          )}
        </>
      ),
      href: '/clients' as Route,
      action: 'Fix clients',
    },
    {
      done: (data.items_missing_hsn ?? 0) === 0,
      blocking: false,
      title: `${data.items_missing_hsn} item${data.items_missing_hsn === 1 ? '' : 's'} without an HSN code`,
      detail: (
        <>
          An invoice to a GST-registered buyer needs an HSN code on every line, so selling one of these will stop the
          invoice.
          {data.items.length > 0 && (
            <>
              {' '}
              {data.items.slice(0, 5).map((it, i) => (
                <span key={it.id}>
                  {i > 0 && ', '}
                  <Link href={`/items/${it.id}` as Route} className="underline font-medium">
                    {it.code ?? it.name}
                  </Link>
                </span>
              ))}
              {(data.items_missing_hsn ?? 0) > Math.min(5, data.items.length) &&
                ` and ${(data.items_missing_hsn ?? 0) - Math.min(5, data.items.length)} more`}
              .
            </>
          )}
        </>
      ),
      href: '/items' as Route,
      action: 'Open items',
    },
  ]

  const outstanding = steps.filter((s) => !s.done)
  const blocking = outstanding.filter((s) => s.blocking)
  const waiting = data.challans_awaiting_invoice ?? 0

  if (outstanding.length === 0) return null

  return (
    <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50/60 overflow-hidden">
      <div className="px-5 py-4 border-b border-amber-200/70 flex items-start gap-3">
        {blocking.length > 0 ? (
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        )}
        <div>
          <h2 className="text-sm font-semibold text-amber-900">
            {blocking.length > 0 ? 'Invoicing is blocked until this is filled in' : 'Finish setting up'}
          </h2>
          <p className="text-sm text-amber-800 mt-0.5">
            {blocking.length > 0
              ? 'A tax invoice is not valid without these, so the save will be refused.'
              : 'Nothing is blocked, but these show up on the documents you send out.'}
            {waiting > 0 && (
              <>
                {' '}
                {waiting} delivered challan{waiting === 1 ? '' : 's'} {waiting === 1 ? 'is' : 'are'} waiting to be
                invoiced.
              </>
            )}
          </p>
        </div>
      </div>
      <ul className="divide-y divide-amber-200/60">
        {outstanding.map((s) => (
          <li key={s.title} className="px-5 py-3 flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-[240px]">
              <p className="text-sm font-medium text-slate-900">
                {s.title}
                {s.blocking && <span className="ml-2 text-xs text-amber-700 font-normal">required</span>}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">{s.detail}</p>
            </div>
            <Link
              href={s.href}
              className="inline-flex items-center gap-1 text-xs font-medium text-amber-900 hover:text-amber-700 whitespace-nowrap mt-0.5"
            >
              {s.action}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
