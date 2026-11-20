// ─────────────────────────────────────────────────────────────
// Payment reminder wording. Pure text building: nothing is sent
// from here — the Receivables page hands the text to the user's
// own WhatsApp or mail app, or copies it.
// ─────────────────────────────────────────────────────────────

export type ReminderInvoice = {
  invoice_no: string | null
  invoice_date: string | null
  due_date: string | null
  days_overdue: number | null
  balance_due: number | null
}

export type ReminderCompany = {
  name?: string | null
  phone?: string | null
  bank_name?: string | null
  bank_account_no?: string | null
  bank_ifsc?: string | null
  bank_branch?: string | null
}

// "Rs." rather than the rupee sign: it survives every phone, SMS gateway and old mail client
const rupees = (n: number) =>
  `Rs. ${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`

const day = (d: string | null) => {
  if (!d) return ''
  const [y, m, dd] = d.slice(0, 10).split('-').map(Number)
  if (!y || !m || !dd) return ''
  return new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export function buildPaymentReminder(input: {
  company: ReminderCompany | null
  clientName: string
  contactPerson?: string | null
  invoices: ReminderInvoice[]
}): { subject: string; body: string; overdueTotal: number; overdueCount: number } {
  const open = input.invoices.filter((i) => (i.balance_due ?? 0) > 0)
  const overdue = open
    .filter((i) => (i.days_overdue ?? 0) > 0)
    .sort((a, b) => (b.days_overdue ?? 0) - (a.days_overdue ?? 0))
  const notDue = open.filter((i) => (i.days_overdue ?? 0) <= 0)
  const overdueTotal = r2(overdue.reduce((s, i) => s + (i.balance_due ?? 0), 0))
  const notDueTotal = r2(notDue.reduce((s, i) => s + (i.balance_due ?? 0), 0))

  const company = input.company?.name?.trim() || 'us'
  const greeting = input.contactPerson?.trim() || input.clientName.trim()

  const lines: string[] = [`Dear ${greeting},`, '']
  lines.push(
    overdue.length === 1
      ? `This is a reminder that the invoice below from ${company} is past its due date:`
      : `This is a reminder that the invoices below from ${company} are past their due date:`,
    ''
  )
  for (const i of overdue) {
    const days = i.days_overdue ?? 0
    lines.push(
      `${i.invoice_no ?? 'Invoice'} dated ${day(i.invoice_date)}, due ${day(i.due_date)} ` +
        `(${days} ${days === 1 ? 'day' : 'days'} overdue): ${rupees(i.balance_due ?? 0)}`
    )
  }
  if (overdue.length > 1) lines.push('', `Total overdue: ${rupees(overdueTotal)}`)
  if (notDueTotal > 0) lines.push('', `A further ${rupees(notDueTotal)} is outstanding but not yet due.`)

  const bank = input.company
  if (bank?.bank_account_no && bank.bank_ifsc) {
    lines.push(
      '',
      'Bank details for payment:',
      [bank.bank_name, bank.bank_branch].filter(Boolean).join(', '),
      `Account no. ${bank.bank_account_no}`,
      `IFSC ${bank.bank_ifsc}`
    )
  }

  lines.push(
    '',
    'If you have already paid, please share the payment reference so that we can update our records.',
    '',
    'Regards,',
    input.company?.name?.trim() || '',
    input.company?.phone?.trim() || ''
  )

  return {
    subject: `Payment reminder from ${input.company?.name?.trim() || 'us'}: ${rupees(overdueTotal)} overdue`,
    // No blank-line runs and no trailing blanks where an optional line was empty
    body: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    overdueTotal,
    overdueCount: overdue.length,
  }
}

/**
 * A phone number as WhatsApp's click-to-chat link wants it: digits only,
 * with the country code. Indian numbers are assumed when none is given.
 * Returns null when the number cannot be a mobile number we can dial.
 */
export function whatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null
  const raw = phone.trim()
  const digits = raw.replace(/\D/g, '')
  if (raw.startsWith('+')) return digits.length >= 8 && digits.length <= 15 ? digits : null
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) return `91${digits.slice(1)}`
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) return digits
  return null
}

export type ReminderChannel = 'whatsapp' | 'email' | 'copy'

const CHANNEL_WORD: Record<ReminderChannel, string> = { whatsapp: 'on WhatsApp', email: 'by email', copy: 'copied' }

/**
 * "Reminded today on WhatsApp", "Reminded 3 days ago by email" — counted in
 * calendar days in India, so a reminder sent last evening reads "yesterday".
 */
export function lastReminderText(sentAt: string, channel: ReminderChannel, now: Date = new Date()): string {
  const istDay = (d: Date) => Math.floor((d.getTime() + 5.5 * 3600 * 1000) / 86400000)
  const days = istDay(now) - istDay(new Date(sentAt))
  const when = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
  return channel === 'copy' ? `Reminder copied ${when}` : `Reminded ${when} ${CHANNEL_WORD[channel]}`
}
