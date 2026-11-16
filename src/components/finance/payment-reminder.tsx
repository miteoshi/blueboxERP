'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useOrg, useOrgId } from '@/lib/hooks/use-tenant'
import { Button } from '@/components/ui/button'
import { buildPaymentReminder, whatsappNumber, type ReminderInvoice } from '@/lib/reminder'
import { BellRing, Copy, Mail, MessageCircle } from 'lucide-react'

// The customer's contact details, read only when a reminder is opened
function useClientContact(clientId: string, enabled: boolean) {
  const supabase = createClient()
  const orgId = useOrgId()
  return useQuery({
    queryKey: ['client-contact', orgId, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('contact_person, phone, email')
        .eq('id', clientId)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!orgId && !!clientId && enabled,
    staleTime: 2 * 60 * 1000,
  })
}

// A ready-to-send reminder for one customer's overdue invoices. Nothing is
// sent from here: the buttons open the user's own WhatsApp or mail app with
// the text filled in, or copy it.
export function PaymentReminder({
  clientId,
  clientName,
  invoices,
}: {
  clientId: string
  clientName: string
  invoices: ReminderInvoice[]
}) {
  const org = useOrg()
  const [open, setOpen] = useState(false)
  const { data: contact, isLoading } = useClientContact(clientId, open)
  // null until the user edits the text; then their wording is kept
  const [edited, setEdited] = useState<string | null>(null)

  const hasOverdue = invoices.some((i) => (i.days_overdue ?? 0) > 0 && (i.balance_due ?? 0) > 0)
  const draft = useMemo(
    () => buildPaymentReminder({ company: org, clientName, contactPerson: contact?.contact_person, invoices }),
    [org, clientName, contact?.contact_person, invoices]
  )
  if (!hasOverdue) return null

  const text = edited ?? draft.body
  const wa = whatsappNumber(contact?.phone)
  const email = contact?.email?.trim() || null

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Reminder copied')
    } catch {
      toast.error('Could not copy. Select the text and copy it yourself.')
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="mt-3" onClick={() => setOpen(true)}>
        <BellRing className="w-4 h-4" />
        Payment reminder
      </Button>
    )
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900">Payment reminder</span>
        <span className="text-xs text-slate-500">
          {draft.overdueCount} overdue {draft.overdueCount === 1 ? 'invoice' : 'invoices'}. Edit the text if you wish; nothing
          is sent until you press a button below.
        </span>
      </div>
      <textarea
        aria-label="Reminder text"
        value={text}
        onChange={(e) => setEdited(e.target.value)}
        rows={Math.min(18, text.split('\n').length + 1)}
        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 whitespace-pre-wrap focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={copy}>
          <Copy className="w-4 h-4" />
          Copy
        </Button>
        {wa && (
          <a href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </Button>
          </a>
        )}
        {email && (
          <a href={`mailto:${encodeURIComponent(email).replace('%40', '@')}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(text)}`}>
            <Button variant="outline" size="sm">
              <Mail className="w-4 h-4" />
              Email
            </Button>
          </a>
        )}
        {edited !== null && (
          <Button variant="ghost" size="sm" onClick={() => setEdited(null)}>
            Reset text
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
      {!isLoading && (!wa || !email) && (
        <p className="text-xs text-slate-500">
          {!wa && !email
            ? 'This customer has no mobile number or email saved, so only Copy is offered. Add them under Clients.'
            : !wa
              ? 'No WhatsApp button: this customer has no mobile number saved (or it is not a mobile number).'
              : 'No Email button: this customer has no email saved.'}
        </p>
      )}
    </div>
  )
}
