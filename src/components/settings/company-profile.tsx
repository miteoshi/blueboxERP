'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useCompanyProfile, useGstStates } from '@/lib/hooks/use-finance'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { TableLoader } from '@/components/ui/spinner'
import { gstinError, normalizeGstin, stateCodeFromGstin } from '@/lib/gst'
import { toast } from 'sonner'
import { Save, ShieldCheck, AlertTriangle } from 'lucide-react'

type Form = {
  name: string
  address: string
  city: string
  pincode: string
  state_code: string
  phone: string
  email: string
  gst_number: string
  pan: string
  invoice_prefix: string
  invoice_terms: string
  bank_name: string
  bank_account_no: string
  bank_ifsc: string
  bank_branch: string
}

type Profile = NonNullable<ReturnType<typeof useCompanyProfile>['data']>

const toForm = (p: Profile): Form => ({
  name: p.name ?? '',
  address: p.address ?? '',
  city: p.city ?? '',
  pincode: p.pincode ?? '',
  state_code: p.state_code ?? '',
  phone: p.phone ?? '',
  email: p.email ?? '',
  gst_number: p.gst_number ?? '',
  pan: p.pan ?? '',
  invoice_prefix: p.invoice_prefix ?? 'INV',
  invoice_terms: p.invoice_terms ?? '',
  bank_name: p.bank_name ?? '',
  bank_account_no: p.bank_account_no ?? '',
  bank_ifsc: p.bank_ifsc ?? '',
  bank_branch: p.bank_branch ?? '',
})

export function CompanyProfile() {
  const { data: profile, isLoading } = useCompanyProfile()

  if (isLoading || !profile) return <TableLoader />
  // Keyed so the form re-initialises if the profile is refetched after a save
  return <CompanyProfileForm key={profile.id} profile={profile} />
}

function CompanyProfileForm({ profile }: { profile: Profile }) {
  const supabase = createClient()
  const qc = useQueryClient()
  const { data: gstStates } = useGstStates()
  const [form, setForm] = useState<Form>(() => toForm(profile))
  const [saving, setSaving] = useState(false)

  const gstError = gstinError(form.gst_number)
  const gstState = stateCodeFromGstin(form.gst_number)
  const panError = form.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.pan) ? 'PAN is 5 letters, 4 digits, 1 letter' : null
  const ifscError = form.bank_ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.bank_ifsc) ? 'IFSC is 11 characters, e.g. HDFC0001234' : null
  const prefixError = !/^[A-Z0-9]{1,4}$/.test(form.invoice_prefix) ? '1–4 letters or digits' : null
  const pinError = form.pincode && !/^[1-9][0-9]{5}$/.test(form.pincode) ? 'PIN code is 6 digits' : null
  const panMismatch = gstState && form.pan && normalizeGstin(form.gst_number).slice(2, 12) !== form.pan

  function set<K extends keyof Form>(field: K, value: Form[K]) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'gst_number') {
        const code = stateCodeFromGstin(value)
        if (code) {
          next.state_code = code
          next.pan = normalizeGstin(value).slice(2, 12)
        }
      }
      return next
    })
  }

  async function save() {
    const firstError = gstError ?? panError ?? ifscError ?? prefixError ?? pinError
    if (firstError) {
      toast.error(firstError)
      return
    }
    if (!form.name.trim()) {
      toast.error('Company name is required')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: form.name.trim(),
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          pincode: form.pincode || null,
          state_code: form.state_code || null,
          state: gstStates?.find((s) => s.code === form.state_code)?.name ?? null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          gst_number: normalizeGstin(form.gst_number) || null,
          pan: form.pan || null,
          invoice_prefix: form.invoice_prefix,
          invoice_terms: form.invoice_terms.trim() || null,
          bank_name: form.bank_name.trim() || null,
          bank_account_no: form.bank_account_no.replace(/\s/g, '') || null,
          bank_ifsc: form.bank_ifsc || null,
          bank_branch: form.bank_branch.trim() || null,
        })
        .eq('id', profile.id)
      if (error) throw error
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['company-profile'] }),
        qc.invalidateQueries({ queryKey: ['tenant-context'] }),
      ])
      toast.success('Company details saved')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not save company details')
    } finally {
      setSaving(false)
    }
  }

  const ready = !!profile.gst_number && !!profile.state_code

  return (
    <div className="space-y-6 max-w-3xl">
      <div
        className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
          ready ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'
        }`}
      >
        {ready ? <ShieldCheck className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
        <div>
          {ready
            ? 'Ready to issue GST tax invoices. These details are printed on every invoice.'
            : 'Add your GSTIN to start issuing GST tax invoices. Every invoice must show the supplier’s GSTIN, address and state (CGST Rule 46).'}
        </div>
      </div>

      <Card>
        <CardHeader><h3 className="font-semibold text-slate-900">Company & GST registration</h3></CardHeader>
        <CardBody className="space-y-4">
          <Input label="Registered name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="GSTIN"
              value={form.gst_number}
              onChange={(e) => set('gst_number', e.target.value.toUpperCase())}
              maxLength={15}
              placeholder="24ABCDE1234F1Z5"
              error={gstError ?? undefined}
              className="font-mono uppercase"
            />
            <Input
              label="PAN"
              value={form.pan}
              onChange={(e) => set('pan', e.target.value.toUpperCase().replace(/\s/g, ''))}
              maxLength={10}
              error={panError ?? (panMismatch ? 'Does not match the PAN inside the GSTIN' : undefined)}
              hint={gstState ? 'Taken from the GSTIN' : undefined}
              className="font-mono uppercase"
            />
          </div>
          <Textarea label="Address" value={form.address} onChange={(e) => set('address', e.target.value)} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="City" value={form.city} onChange={(e) => set('city', e.target.value)} />
            <Input
              label="PIN code"
              inputMode="numeric"
              maxLength={6}
              value={form.pincode}
              onChange={(e) => set('pincode', e.target.value.replace(/\D/g, ''))}
              error={pinError ?? undefined}
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">State</label>
              <select
                value={form.state_code}
                onChange={(e) => set('state_code', e.target.value)}
                disabled={!!gstState}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
              >
                <option value="">Select state…</option>
                {gstStates?.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h3 className="font-semibold text-slate-900">Invoicing</h3></CardHeader>
        <CardBody className="space-y-4">
          <Input
            label="Invoice number prefix"
            value={form.invoice_prefix}
            onChange={(e) => set('invoice_prefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            maxLength={4}
            error={prefixError ?? undefined}
            hint={`Invoices are numbered ${form.invoice_prefix || 'INV'}/26-27/0001 — a new series each financial year (max 16 characters)`}
            className="font-mono uppercase max-w-[10rem]"
          />
          <Textarea
            label="Terms printed on invoices"
            value={form.invoice_terms}
            onChange={(e) => set('invoice_terms', e.target.value)}
            placeholder={'1. Interest @ 18% p.a. on payments after the due date.\n2. Subject to local jurisdiction.'}
            rows={4}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h3 className="font-semibold text-slate-900">Bank details (printed for payment)</h3></CardHeader>
        <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Bank name" value={form.bank_name} onChange={(e) => set('bank_name', e.target.value)} />
          <Input label="Branch" value={form.bank_branch} onChange={(e) => set('bank_branch', e.target.value)} />
          <Input
            label="Account number"
            inputMode="numeric"
            value={form.bank_account_no}
            onChange={(e) => set('bank_account_no', e.target.value.replace(/[^0-9]/g, ''))}
            className="font-mono"
          />
          <Input
            label="IFSC"
            value={form.bank_ifsc}
            onChange={(e) => set('bank_ifsc', e.target.value.toUpperCase().replace(/\s/g, ''))}
            maxLength={11}
            error={ifscError ?? undefined}
            className="font-mono uppercase"
          />
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button loading={saving} onClick={save}>
          <Save className="w-4 h-4" />
          Save company details
        </Button>
      </div>
    </div>
  )
}
