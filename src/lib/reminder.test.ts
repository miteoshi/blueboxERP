import { describe, expect, it } from 'vitest'
import { buildPaymentReminder, whatsappNumber, lastReminderText } from './reminder'

const company = { name: 'High Power Electricals', phone: '98250 12345', bank_name: 'HDFC Bank', bank_branch: 'Vadodara', bank_account_no: '50100012345678', bank_ifsc: 'HDFC0000123' }

describe('buildPaymentReminder', () => {
  const invoices = [
    { invoice_no: 'INV/1', invoice_date: '2026-09-01', due_date: '2026-10-01', days_overdue: 48, balance_due: 1180 },
    { invoice_no: 'INV/2', invoice_date: '2026-10-01', due_date: '2026-10-31', days_overdue: 18, balance_due: 2360.5 },
    { invoice_no: 'INV/3', invoice_date: '2026-11-10', due_date: '2026-12-10', days_overdue: -22, balance_due: 590 },
    { invoice_no: 'INV/0', invoice_date: '2026-08-01', due_date: '2026-08-31', days_overdue: 79, balance_due: 0 },
  ]

  it('lists overdue invoices, most overdue first, with the total and what is not yet due', () => {
    const r = buildPaymentReminder({ company, clientName: 'Alpha Traders', contactPerson: 'Mr Shah', invoices })
    expect(r.overdueCount).toBe(2)
    expect(r.overdueTotal).toBe(3540.5)
    expect(r.subject).toBe('Payment reminder from High Power Electricals: Rs. 3,540.50 overdue')
    expect(r.body.startsWith('Dear Mr Shah,')).toBe(true)
    expect(r.body.indexOf('INV/1')).toBeLessThan(r.body.indexOf('INV/2'))
    expect(r.body).toContain('(48 days overdue): Rs. 1,180.00')
    expect(r.body).toContain('Total overdue: Rs. 3,540.50')
    expect(r.body).toContain('A further Rs. 590.00 is outstanding but not yet due.')
    expect(r.body).toContain('Account no. 50100012345678')
    expect(r.body).not.toContain('INV/0')
    expect(r.body).not.toMatch(/\n{3,}/)
  })

  it('leaves bank details out unless both account number and IFSC are set, and greets the client by name', () => {
    const r = buildPaymentReminder({ company: { name: 'X', bank_account_no: '123' }, clientName: ' Beta Corp ', invoices: invoices.slice(0, 1) })
    expect(r.body.startsWith('Dear Beta Corp,')).toBe(true)
    expect(r.body).toContain('the invoice below from X is past its due date')
    expect(r.body).not.toContain('Bank details')
    expect(r.body).not.toContain('Total overdue')
  })
})

describe('whatsappNumber', () => {
  it.each([
    ['98250 12345', '919825012345'],
    ['09825012345', '919825012345'],
    ['+91 98250-12345', '919825012345'],
    ['919825012345', '919825012345'],
    ['+44 7700 900123', '447700900123'],
  ])('%s → %s', (input, want) => {
    expect(whatsappNumber(input)).toBe(want)
  })

  it.each(['0265 2345678', '12345', '', null, '5825012345'])('rejects %j', (input) => {
    expect(whatsappNumber(input)).toBeNull()
  })
})

describe('lastReminderText', () => {
  const now = new Date('2026-11-20T10:00:00+05:30')
  it('says today for earlier the same day in India', () => {
    expect(lastReminderText('2026-11-20T00:30:00+05:30', 'whatsapp', now)).toBe('Reminded today on WhatsApp')
  })
  it('says yesterday for last evening, though under 24 hours ago', () => {
    expect(lastReminderText('2026-11-19T21:00:00+05:30', 'email', now)).toBe('Reminded yesterday by email')
  })
  it('counts days', () => {
    expect(lastReminderText('2026-11-17T12:00:00+05:30', 'whatsapp', now)).toBe('Reminded 3 days ago on WhatsApp')
  })
  it('words a copied reminder differently', () => {
    expect(lastReminderText('2026-11-20T09:00:00+05:30', 'copy', now)).toBe('Reminder copied today')
  })
})
