import { createHash } from 'node:crypto'

// ─────────────────────────────────────────────────────────────
// Escape-by-default HTML templating for the printable documents.
//
// Every value interpolated into html`…` is HTML-escaped unless it is
// itself an html`…` fragment (or wrapped with raw()). Document data —
// client names, addresses, notes — is user-entered, so it must never be
// written into the page unescaped.
// ─────────────────────────────────────────────────────────────

export class SafeHtml {
  readonly value: string
  constructor(value: string) {
    this.value = value
  }
  toString() {
    return this.value
  }
}

export const raw = (value: string) => new SafeHtml(value)

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function render(value: unknown): string {
  if (value === null || value === undefined || value === false) return ''
  if (value instanceof SafeHtml) return value.value
  if (Array.isArray(value)) return value.map(render).join('')
  return escapeHtml(String(value))
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  let out = strings[0]
  values.forEach((v, i) => {
    out += render(v) + strings[i + 1]
  })
  return new SafeHtml(out)
}

// The only script a printable page runs. Its hash goes into the CSP so
// nothing else (including anything injected into the data) can execute.
const PRINT_SCRIPT = 'window.onload = () => window.print()'
const PRINT_SCRIPT_HASH = createHash('sha256').update(PRINT_SCRIPT).digest('base64')

export const printScript = raw(`<script>${PRINT_SCRIPT}</script>`)

export function printableResponse(page: SafeHtml): Response {
  return new Response(page.value, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': [
        "default-src 'none'",
        "style-src 'unsafe-inline'",
        `script-src 'sha256-${PRINT_SCRIPT_HASH}'`,
        'img-src data:',
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'self'",
      ].join('; '),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
}
