// ─────────────────────────────────────────────────────────────
// CSV export for reports. Cells starting with = + - @ (or a tab / CR)
// are prefixed with ' so spreadsheet apps don't evaluate user-entered
// text such as a client name as a formula (CSV injection). Numbers are
// written as plain numbers so they stay numeric in Excel.
// ─────────────────────────────────────────────────────────────

export type CsvColumn<T> = {
  header: string
  value: (row: T) => string | number | boolean | null | undefined
}

function cell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  let text = String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [
    columns.map((c) => cell(c.header)).join(','),
    ...rows.map((row) => columns.map((c) => cell(c.value(row))).join(',')),
  ]
  return lines.join('\r\n')
}

export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  // BOM so Excel opens UTF-8 (₹, names in Indian scripts) correctly
  const blob = new Blob(['﻿' + toCsv(rows, columns)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
