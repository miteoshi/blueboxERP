'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { StatCard } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/page-header'
import { OrderStatusBadge } from '@/components/ui/badge'
import { formatCurrency, formatDate, formatQty } from '@/lib/utils/format'
import { ShoppingCart, FileText, Factory, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useOrgId } from '@/lib/hooks/use-tenant'
import { useRole } from '@/lib/hooks/use-profile'
import { FinanceSummary } from '@/components/finance/finance-summary'

// ── Data hooks ────────────────────────────────────────────────

function useDashboardStats(orgId: string | null) {



  const supabase = createClient();
  return useQuery({
    queryKey: ["dashboard-stats", orgId],
    queryFn: async () => {
      if (!orgId) {
        return {
          pendingApprovals: 0,
          activeOrders: 0,
          inProduction: 0,
          lowStock: 0,
        };
      }
      const results = await Promise.all([
        supabase
          .from("quotations")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending_approval"),
        supabase
          .from("sales_orders")
          .select("id", { count: "exact", head: true })
          .in("status", ["confirmed", "in_production", "ready"]),
        supabase
          .from("production_orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "in_progress"),
        supabase
          .from("v_reorder_alerts")
          .select("item_id", { count: "exact", head: true }),
      ]);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
      const [pendingApprovals, activeOrders, inProduction, lowStock] = results.map((r) => r.count ?? 0);
      return { pendingApprovals, activeOrders, inProduction, lowStock };
    },
    enabled: !!orgId,
    staleTime: 30 * 1000,
  });
}

function useReorderAlerts(orgId: string | null) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["reorder-alerts", orgId, "top5"],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("v_reorder_alerts")
        .select("*")
        .order("qty_available", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,
  });
}

function useRecentOrders(orgId: string | null) {
  const supabase = createClient()
  return useQuery({
    queryKey: ["recent-orders", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("v_so_pipeline")
        .select("*")
        .order("order_date", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
    staleTime: 30 * 1000,
  });
}

// ── Component ─────────────────────────────────────────────────

export default function DashboardPage() {
  const supabase = createClient()
  const qc       = useQueryClient()
  const orgId    = useOrgId()

  const { data: stats }        = useDashboardStats(orgId)
  const { data: alerts }       = useReorderAlerts(orgId)
  const { data: recentOrders } = useRecentOrders(orgId)

  const alertCount = stats?.lowStock ?? 0
  const role = useRole()

  // ── Realtime subscriptions ─────────────────────────────────
  useEffect(() => {
    if (!orgId) return

    const channel = supabase
      .channel(`dashboard-realtime-${orgId}`)

      // Inventory balance changes → refresh reorder alerts + stats
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'inventory_balance',
        filter: `org_id=eq.${orgId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['reorder-alerts'] })
        qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      })

      // Sales order changes → refresh recent orders + stats
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'sales_orders',
        filter: `org_id=eq.${orgId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['recent-orders'] })
        qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      })

      // Quotation changes → refresh pending approval count
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'quotations',
        filter: `org_id=eq.${orgId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      })

      // Production order changes → refresh in-production count
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'production_orders',
        filter: `org_id=eq.${orgId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      })

      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orgId, supabase, qc])

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Good ${getGreeting()} — here's what's happening today`}
      />

      {/* ── Finance (roles that can read invoices and receipts) ── */}
      {role && ['admin', 'manager', 'sales', 'viewer'].includes(role) && <FinanceSummary />}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Low Stock Alerts"
          value={alertCount}
          sub="items below reorder level"
          icon={<AlertTriangle className="w-5 h-5" />}
          className={alertCount > 0 ? 'border-amber-200' : ''}
        />
        <StatCard
          label="Pending Approvals"
          value={stats?.pendingApprovals ?? 0}
          sub="quotations awaiting sign-off"
          icon={<FileText className="w-5 h-5" />}
        />
        <StatCard
          label="Active Orders"
          value={stats?.activeOrders ?? 0}
          sub="confirmed, production, ready"
          icon={<ShoppingCart className="w-5 h-5" />}
        />
        <StatCard
          label="In Production"
          value={stats?.inProduction ?? 0}
          sub="orders on shop floor"
          icon={<Factory className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Recent Sales Orders ── */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 text-sm">Recent Sales Orders</h3>
            <Link href="/sales-orders" className="text-xs text-blue-600 hover:underline">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {!recentOrders?.length && (
              <p className="text-sm text-slate-400 text-center py-8">No orders yet</p>
            )}
            {recentOrders?.map((order) => (
              <Link
                key={order.id}
                href={`/sales-orders/${order.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    {order.so_number}
                  </div>
                  <div className="text-xs text-slate-500">
                    {order.client_name} · {formatDate(order.order_date)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-900">
                      {formatCurrency(order.total_amount)}
                    </div>
                    {(order.balance_due ?? 0) > 0 && (
                      <div className="text-xs text-amber-600">
                        {formatCurrency(order.balance_due)} due
                      </div>
                    )}
                  </div>
                  <OrderStatusBadge status={order.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Low Stock Alerts ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Reorder Alerts
            </h3>
            <Link href="/inventory" className="text-xs text-blue-600 hover:underline">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {alerts?.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">
                All stock levels healthy ✓
              </p>
            )}
            {alerts?.map((item) => (
              <div key={item.item_id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-mono text-slate-400">
                      {item.item_code}
                    </div>
                    <div className="text-sm font-medium text-slate-800 leading-tight">
                      {item.name}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-amber-600">
                      {formatQty(item.qty_available, item.unit)}
                    </div>
                    <div className="text-xs text-slate-400">
                      min {formatQty(item.reorder_level)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

// Indian business hours on both server and browser, so the rendered text
// doesn't change on hydration (the server runs in UTC).
function getGreeting() {
  const h = Number(
    new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(new Date())
  )
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}