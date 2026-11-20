'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { TableLoader } from '@/components/ui/spinner'
import { useBooksLock, useSetBooksLock } from '@/lib/hooks/use-books-lock'
import { formatDate, formatDateTime, todayISO } from '@/lib/utils/format'
import { Lock, LockOpen } from 'lucide-react'

const dayBefore = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
}

const dayAfter = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

// Settings → Close the books (admin only, like the rest of Settings)
export function BooksLockSettings() {
  const { data: lock, isLoading } = useBooksLock()
  const save = useSetBooksLock()
  const latest = dayBefore(todayISO())
  const [day, setDay] = useState('')
  const [reason, setReason] = useState('')

  const current = lock?.locked_until ?? null
  const earlier = !!current && !!day && day < current

  function close() {
    if (!day) return toast.error('Choose the last day to close')
    if (day > latest) return toast.error('Close the books up to a day before today')
    if (earlier && !reason.trim()) return toast.error(`Moving the close back from ${formatDate(current)} reopens those days — give a reason`)
    save.mutate({ lockedUntil: day, reason: reason.trim() }, { onSuccess: () => { setDay(''); setReason('') } })
  }

  function reopen() {
    if (!reason.trim()) return toast.error('Give a reason for reopening the books')
    save.mutate({ lockedUntil: null, reason: reason.trim() }, { onSuccess: () => { setDay(''); setReason('') } })
  }

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-600" />
            Close the books
          </h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Once a month or a year is done — the GST return filed, the accounts handed over — close it. Nothing dated on or
            before the closed day can then be added, changed or cancelled: invoices, notes, receipts, payments, bills,
            expenses, income, transfers, GST payments, capital and loans, fixed assets, stock movements and opening balances.
            Later documents can still settle old ones, so a payment received today can be set against an invoice from a closed
            month.
          </p>

          {isLoading ? (
            <TableLoader />
          ) : current ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
              <p className="font-semibold">Closed up to {formatDate(current)}</p>
              <p className="text-blue-800">
                {lock?.updater?.full_name ? `By ${lock.updater.full_name}, ` : ''}
                {lock?.updated_at ? formatDateTime(lock.updated_at) : ''}
                {lock?.reason ? ` — ${lock.reason}` : ''}
              </p>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-600">
              The books are open: any date can be used.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={current ? 'Move the close to' : 'Close up to and including'}
              type="date"
              max={latest}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
            <Input
              label={current ? 'Reason (needed to reopen days)' : 'Reason (optional)'}
              placeholder={current ? 'e.g. October rent was entered twice' : 'e.g. GSTR-3B for October filed'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {earlier && (
            <p className="text-sm text-amber-700">
              This reopens {formatDate(dayAfter(day))} to {formatDate(current)}.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button loading={save.isPending} onClick={close} disabled={!day}>
              <Lock className="w-4 h-4" />
              {current ? 'Change the closed period' : 'Close the books'}
            </Button>
            {current && (
              <Button variant="outline" loading={save.isPending} onClick={reopen}>
                <LockOpen className="w-4 h-4" />
                Reopen everything
              </Button>
            )}
          </div>
          <p className="text-xs text-slate-500">Only admins can close or reopen. Every change is kept in the audit log.</p>
        </CardBody>
      </Card>
    </div>
  )
}
