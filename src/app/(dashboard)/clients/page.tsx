'use client'

import type { Tables } from '@/lib/types/database'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input, Textarea } from '@/components/ui/input'
import { TableLoader } from '@/components/ui/spinner'
import { formatCurrency } from '@/lib/utils/format'
import { toast } from 'sonner'
import { Plus, Search, X } from 'lucide-react'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { useCan } from '@/lib/hooks/use-profile'
import { useGstStates } from '@/lib/hooks/use-finance'
import { gstinError, normalizeGstin, stateCodeFromGstin } from '@/lib/gst'
import { ilikeAny } from '@/lib/utils/search'
import { allRows } from "@/lib/utils/all-rows"

function useClients(search: string, orgId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["clients", orgId, search],

    queryFn: async () => {
      if (!orgId) {
        throw new Error("Organization context is not available");
      }

      let query = supabase
        .from("clients")
        .select(
          `
          id,
          name,
          contact_person,
          phone,
          email,
          address,
          city,
          state,
          state_code,
          pincode,
          gst_number,
          credit_limit,
          credit_days,
          notes,
          is_active
          `
        )
        .order("name");

      if (search) {
        query = query.or(ilikeAny(['name', 'email', 'phone'], search));
      }

      const { data, error } = await allRows(query.order("id"));

      if (error) {
        throw error;
      }

      return data;
    },

    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  });
}

interface ClientForm {
  name:           string
  contact_person: string
  phone:          string
  email:          string
  address:        string
  city:           string
  state_code:     string
  pincode:        string
  gst_number:     string
  credit_limit:   string
  credit_days:    string
  notes:          string
}

const EMPTY_FORM: ClientForm = {
  name: '', contact_person: '', phone: '', email: '',
  address: '', city: '', state_code: '', pincode: '',
  gst_number: '', credit_limit: '0', credit_days: '0', notes: '',
}

export default function ClientsPage() {
  const supabase = createClient()
  const qc       = useQueryClient()
  const orgId    = useOrgId()
  const canEdit  = useCan('manageClients')

  const [search,     setSearch]     = useState('')
  const [showForm,   setShowForm]   = useState(false)
  const [editId,     setEditId]     = useState<string | null>(null)
  const [form,       setForm]       = useState<ClientForm>(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)

  const { data: clients, isLoading } = useClients(search, orgId)
  const { data: gstStates } = useGstStates()
  const gstError = gstinError(form.gst_number)

  function setField(field: keyof ClientForm, value: string) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      // A valid GSTIN fixes the state: its first two digits are the state code
      if (field === 'gst_number') {
        const code = stateCodeFromGstin(value)
        if (code) next.state_code = code
      }
      return next
    })
  }

  function openNew() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setShowForm(true)
  }

  function openEdit(client: Omit<Tables<'clients'>, 'org_id' | 'created_at' | 'updated_at'>) {
    // Older clients only have the free-text state; map it to a code if it matches
    const codeFromName = gstStates?.find(
      st => st.name.toLowerCase() === (client.state ?? '').trim().toLowerCase()
    )?.code
    setForm({
      name:           client.name           ?? '',
      contact_person: client.contact_person ?? '',
      phone:          client.phone          ?? '',
      email:          client.email          ?? '',
      address:        client.address        ?? '',
      city:           client.city           ?? '',
      state_code:     client.state_code     ?? codeFromName ?? '',
      pincode:        client.pincode        ?? '',
      gst_number:     client.gst_number     ?? '',
      credit_limit:   String(client.credit_limit ?? 0),
      credit_days:    String(client.credit_days  ?? 0),
      notes:          client.notes          ?? '',
    })
    setEditId(client.id)
    setShowForm(true)
  }

async function handleSave() {
  if (!form.name.trim()) {
    toast.error("Client name is required");
    return;
  }

  if (!orgId) {
    toast.error("Organization context is not available");
    return;
  }

  if (gstError) {
    toast.error(gstError);
    return;
  }

  if (form.pincode && !/^[1-9][0-9]{5}$/.test(form.pincode.trim())) {
    toast.error("PIN code must be 6 digits");
    return;
  }

  setSaving(true);

  try {
    const payload = {
      name: form.name.trim(),
      contact_person: form.contact_person || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      city: form.city || null,
      state_code: form.state_code || null,
      state: gstStates?.find(st => st.code === form.state_code)?.name ?? null,
      pincode: form.pincode.trim() || null,
      gst_number: normalizeGstin(form.gst_number) || null,
      credit_limit: Number(form.credit_limit) || 0,
      credit_days: Number(form.credit_days) || 0,
      notes: form.notes || null,
    };

    if (editId) {
      const { error } = await supabase
        .from("clients")
        .update(payload)
        .eq("id", editId);

      if (error) throw error;

      toast.success("Client updated");
    } else {
      const { error } = await supabase.from("clients").insert({
        ...payload,
        org_id: orgId,
      });

      if (error) throw error;

      toast.success("Client added");
    }

    await qc.invalidateQueries({ queryKey: ["clients"] });
    setShowForm(false);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to save client";

    toast.error(message);
  } finally {
    setSaving(false);
  }
}

  async function handleToggleActive(id: string, current: boolean) {
    const { error } = await supabase
      .from('clients')
      .update({ is_active: !current })
      .eq('id', id)
    if (error) { toast.error(error.message); return }
    qc.invalidateQueries({ queryKey: ['clients'] })
    toast.success(current ? 'Client deactivated' : 'Client activated')
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Customer master — all companies and individuals you sell to"
      >
        {canEdit && (
          <Button size="sm" onClick={openNew}>
            <Plus className="w-4 h-4" />
            New Client
          </Button>
        )}
      </PageHeader>

      {/* Slide-in form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-md bg-white shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">
                {editId ? 'Edit Client' : 'New Client'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <Input
                label="Company / Client Name"
                required
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                placeholder="e.g. Gujarat State Electricity Corp."
              />
              <Input
                label="Contact Person"
                value={form.contact_person}
                onChange={e => setField('contact_person', e.target.value)}
                placeholder="Primary contact name"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Phone"
                  value={form.phone}
                  onChange={e => setField('phone', e.target.value)}
                  placeholder="Mobile number"
                />
                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={e => setField('email', e.target.value)}
                />
              </div>
              <Input
                label="GSTIN"
                value={form.gst_number}
                onChange={e => setField('gst_number', e.target.value.toUpperCase())}
                placeholder="24ABCDE1234F1Z5"
                maxLength={15}
                error={gstError ?? undefined}
                hint="Leave empty for unregistered (B2C) customers"
                className="font-mono uppercase"
              />
              <Textarea
                label="Address"
                value={form.address}
                onChange={e => setField('address', e.target.value)}
                placeholder="Street address"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="City"
                  value={form.city}
                  onChange={e => setField('city', e.target.value)}
                />
                <Input
                  label="PIN Code"
                  inputMode="numeric"
                  maxLength={6}
                  value={form.pincode}
                  onChange={e => setField('pincode', e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">
                  State <span className="text-xs font-normal text-slate-400">(place of supply)</span>
                </label>
                <select
                  value={form.state_code}
                  onChange={e => setField('state_code', e.target.value)}
                  disabled={!!stateCodeFromGstin(form.gst_number)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                >
                  <option value="">Select state…</option>
                  {gstStates?.map(st => (
                    <option key={st.code} value={st.code}>{st.code} — {st.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400">
                  {stateCodeFromGstin(form.gst_number)
                    ? 'Set from the GSTIN'
                    : 'Decides CGST + SGST (same state) or IGST (other state) on invoices'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Credit Limit (₹)"
                  type="number"
                  min="0"
                  value={form.credit_limit}
                  onChange={e => setField('credit_limit', e.target.value)}
                  hint="0 = no credit"
                />
                <Input
                  label="Credit Days"
                  type="number"
                  min="0"
                  value={form.credit_days}
                  onChange={e => setField('credit_days', e.target.value)}
                  hint="Days to pay invoice"
                />
              </div>
              <Textarea
                label="Notes"
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                placeholder="Internal notes about this client…"
              />
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button className="flex-1" loading={saving} onClick={handleSave}>
                {editId ? 'Save Changes' : 'Add Client'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="px-5 py-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <span className="text-xs text-slate-400 ml-auto">
            {clients?.length ?? 0} clients
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? <TableLoader /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Contact</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Location</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">GST No.</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Credit Limit</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Credit Days</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {clients?.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">No clients found</td></tr>
                )}
                {clients?.map((client) => (
                  <tr key={client.id} className={`hover:bg-slate-50 transition-colors ${!client.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{client.name}</div>
                      {client.contact_person && (
                        <div className="text-xs text-slate-400">{client.contact_person}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700">{client.phone ?? '—'}</div>
                      {client.email && (
                        <div className="text-xs text-slate-400">{client.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {[client.city, client.state].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {client.gst_number
                        ? <span className="font-mono text-xs text-slate-600">{client.gst_number}</span>
                        : <span className="text-slate-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {(client.credit_limit ?? 0) > 0
                        ? <span className="font-medium text-slate-900">{formatCurrency(client.credit_limit)}</span>
                        : <span className="text-slate-300 text-xs">No credit</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">
                      {(client.credit_days ?? 0) > 0
                        ? `${client.credit_days} days`
                        : <span className="text-slate-300 text-xs">Advance</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={client.is_active ? 'success' : 'default'}>
                        {client.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {canEdit && <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(client)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(client.id, client.is_active)}
                          className={client.is_active ? 'text-red-500 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}
                        >
                          {client.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}