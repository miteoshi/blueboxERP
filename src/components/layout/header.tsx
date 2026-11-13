'use client'

import { usePathname } from 'next/navigation'
import { useReorderAlerts } from '@/lib/hooks/use-stock'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'

// Maps route to a readable page title
const pageTitles: Record<string, string> = {
  '/':             'Dashboard',
  '/inventory':    'Inventory',
  '/items':        'Items',
  '/quotations':   'Quotations',
  '/sales-orders': 'Sales Orders',
  '/production':   'Production',
  '/inbound':      'Inbound (GRN)',
  '/purchase-orders': 'Purchase Orders',
  '/supplier-bills': 'Supplier Bills',
  '/payables':     'Payables',
  '/dispatch':     'Dispatch',
  '/clients':      'Clients',
  '/suppliers':    'Suppliers',
  '/workers':      'Workers',
  '/invoices':     'Invoices',
  '/credit-notes': 'Credit Notes',
  '/payments':     'Payments',
  '/receivables':  'Receivables',
  '/reports':      'GST Reports',
  '/reports/purchases': 'Purchase Register',
  '/settings':     'Settings',
}

function getTitle(pathname: string): string {
  // Exact match first
  if (pageTitles[pathname]) return pageTitles[pathname]
  // Match by prefix (e.g. /quotations/new → Quotations)
  const base = '/' + pathname.split('/')[1]
  return pageTitles[base] ?? 'Blue Box ERP'
}

export function Header() {
  const pathname = usePathname()
  const { data: alerts } = useReorderAlerts()
  const alertCount = alerts?.length ?? 0

  return (
    <header className="
      h-14 flex items-center justify-between
      px-6 border-b border-slate-100 bg-white
      sticky top-0 z-20
    ">
      {/* Page title */}
      <h1 className="text-lg font-semibold text-slate-900">
        {getTitle(pathname)}
      </h1>

      {/* Right side actions */}
      <div className="flex items-center gap-3">

        {/* Reorder alert bell */}
        {alertCount > 0 && (
          <Link
            href="/inventory"
            className="
              relative flex items-center gap-1.5
              text-amber-600 bg-amber-50 hover:bg-amber-100
              px-3 py-1.5 rounded-lg text-sm font-medium
              transition-colors
            "
          >
            <AlertTriangle className="w-4 h-4" />
            {alertCount} low stock
          </Link>
        )}

      </div>
    </header>
  )
}