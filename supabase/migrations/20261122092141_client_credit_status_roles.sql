-- ─────────────────────────────────────────────────────────────
-- client_credit_status() runs with the definer's rights, so it bypassed the
-- read policies on invoices and receipts: store and production users could
-- see a customer's outstanding, overdue and credit position. It now allows
-- the roles that may read receipts (admin, manager, sales, viewer); quotation
-- conversion, which calls it, is limited to admin, manager and sales. Each
-- query is also scoped to the organisation explicitly.
-- ─────────────────────────────────────────────────────────────

create or replace function public.client_credit_status(p_client_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org(); v_client public.clients; v_outstanding numeric; v_overdue numeric;
  v_open_orders numeric; v_unalloc numeric; v_exposure numeric;
begin
  perform public.assert_my_role('admin', 'manager', 'sales', 'viewer');
  select * into v_client from public.clients where id = p_client_id and org_id = v_org;
  if not found then
    raise exception 'Client not found' using errcode = 'P0002';
  end if;
  select coalesce(sum(balance_due), 0), coalesce(sum(balance_due) filter (where due_date < current_date), 0)
    into v_outstanding, v_overdue from public.sales_invoices where org_id = v_org and client_id = p_client_id and status = 'issued';
  select coalesce(sum(greatest(s.total_amount - coalesce(inv.invoiced, 0), 0)), 0) into v_open_orders
  from public.sales_orders s
  left join (select so_id, sum(total_amount) as invoiced from public.sales_invoices
             where org_id = v_org and status = 'issued' and so_id is not null group by so_id) inv on inv.so_id = s.id
  where s.org_id = v_org and s.client_id = p_client_id and s.status in ('confirmed', 'in_production', 'ready', 'dispatched', 'delivered');
  select coalesce(sum(amount - amount_allocated), 0) into v_unalloc
  from public.customer_receipts where org_id = v_org and client_id = p_client_id and status = 'active';
  v_exposure := v_outstanding + v_open_orders - v_unalloc;
  return jsonb_build_object('client_id', p_client_id, 'credit_limit', coalesce(v_client.credit_limit, 0), 'credit_days', coalesce(v_client.credit_days, 0),
    'outstanding', v_outstanding, 'overdue', v_overdue, 'open_orders', v_open_orders, 'unallocated_credit', v_unalloc, 'exposure', v_exposure,
    'available', case when coalesce(v_client.credit_limit, 0) > 0 then v_client.credit_limit - v_exposure end);
end;
$function$;

comment on function public.client_credit_status(uuid) is
  'A customer''s credit position: outstanding and overdue invoices, open orders not yet invoiced, unapplied receipts, exposure and credit left. Admin, manager, sales and viewer.';
