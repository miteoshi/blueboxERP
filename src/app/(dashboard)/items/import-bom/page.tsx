'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { parseSpreadsheet, type RowResult } from '@/lib/utils/spreadsheet-import'
import { validateBomRow, type BomImportRow } from '@/lib/utils/bom-import'
import { toast } from 'sonner'
import { Upload, CheckCircle2, XCircle, Save } from 'lucide-react'

export default function ImportBomPage() {
  const router = useRouter()
  const supabase = createClient()
  const orgId = useOrgId()

  const [rows, setRows] = useState<RowResult<BomImportRow>[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)

  const validRows = rows.filter((r) => r.errors.length === 0)
  const invalidRows = rows.filter((r) => r.errors.length > 0)

  async function handleFile(file: File) {
    if (!orgId) {
      toast.error('Organization not loaded yet — try again in a moment')
      return
    }

    setParsing(true)
    setFileName(file.name)
    try {
      // Pull every item code for this org once, so codes in the sheet can be
      // resolved to UUIDs without a round trip per row.
      const { data: items, error } = await supabase
        .from('items')
        .select('id, item_code')
      if (error) throw error

      const itemsByCode = new Map(
        (items ?? []).map((i) => [i.item_code.toUpperCase(), i.id])
      )


      const { data: units, error: unitsError } = await supabase
        .from("units")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (unitsError) throw unitsError;

      const unitsByName = new Map(
        (units ?? []).map((u) => [u.name.toLowerCase(), u.id])
      );

      const parsed = await parseSpreadsheet(file)
      if (parsed.length === 0) {
        toast.error('No rows found in that file')
        setRows([])
        return
      }
      const results = parsed.map((raw, i) =>
        validateBomRow(raw, i + 2, itemsByCode, unitsByName)
      );
      setRows(results)
    } catch (err) {
      toast.error('Could not read that file — is it a valid .xlsx or .csv?')
      console.error(err)
    } finally {
      setParsing(false)
    }
  }

  async function handleImport() {
    if (!orgId) {
      toast.error('Organization not loaded')
      return
    }
    if (validRows.length === 0) {
      toast.error('No valid rows to import')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

    const payload = validRows.map((r) => ({
      finished_item_id: r.data!.finished_item_id,
      component_id: r.data!.component_id,
      qty_per_unit: r.data!.qty_per_unit,
      unit_id: r.data!.unit_id,
      notes: r.data!.notes,
      org_id: orgId,
      created_by: user?.id ?? null,
    }));

        const { error } = await supabase
            .from('bom')
            .upsert(payload, {
            onConflict: 'finished_item_id,component_id',
            })

      if (error) throw error

      toast.success(`Imported ${validRows.length} BOM line${validRows.length !== 1 ? 's' : ''}`)
      router.push('/items')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Import Bill of Materials"
        description="Bulk-add BOM lines by referencing items by their item code"
      >
        <a
          href="/templates/bom-import-template.xlsx"
          download
          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Download Template
        </a>
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          Cancel
        </Button>
        {validRows.length > 0 && (
          <Button size="sm" loading={saving} onClick={handleImport}>
            <Save className="w-4 h-4" />
            Import {validRows.length} line{validRows.length !== 1 ? "s" : ""}
          </Button>
        )}
      </PageHeader>

      <Card className="mb-6">
        <CardBody>
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-lg py-10 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors">
            <Upload className="w-6 h-6 text-slate-400" />
            <span className="text-sm text-slate-600">
              {fileName ?? "Click to choose a .xlsx, .xls, or .csv file"}
            </span>
            <span className="text-xs text-slate-400">
              Columns: finished_item_code, component_item_code, qty_per_unit,
              unit, notes — codes must already exist in Items
            </span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
        </CardBody>
      </Card>

      {parsing && (
        <p className="text-sm text-slate-500">
          Reading file and matching item codes…
        </p>
      )}

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-green-600 font-medium">
                <CheckCircle2 className="w-4 h-4" /> {validRows.length} valid
              </span>
              {invalidRows.length > 0 && (
                <span className="flex items-center gap-1.5 text-red-600 font-medium">
                  <XCircle className="w-4 h-4" /> {invalidRows.length} with
                  errors
                </span>
              )}
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-3 py-2 font-semibold text-slate-500">
                      Row
                    </th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500">
                      Finished Item
                    </th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500">
                      Component
                    </th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500">
                      Qty/Unit
                    </th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500">
                      Issues
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((r) => (
                    <tr
                      key={r.rowNumber}
                      className={r.errors.length > 0 ? "bg-red-50/50" : ""}
                    >
                      <td className="px-3 py-2 text-slate-400">
                        {r.rowNumber}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-700">
                        {String(r.raw.finished_item_code ?? "—")}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {String(r.raw.component_item_code ?? "—")}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {String(r.raw.qty_per_unit ?? "—")}
                      </td>
                      <td className="px-3 py-2 text-red-600">
                        {r.errors.length > 0 ? (
                          r.errors.join("; ")
                        ) : (
                          <span className="text-green-600">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}