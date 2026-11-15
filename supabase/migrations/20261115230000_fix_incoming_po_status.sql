-- ─────────────────────────────────────────────────────────────
-- Count a partly received purchase order as still incoming
--
-- 20261115192857_reorder_planning.sql matched purchase orders with
-- `status in ('issued', 'partial')`. There is no 'partial' status on a
-- purchase order — the statuses are draft, issued, partially_received,
-- received, closed, cancelled. 'partial' belongs to inbound_receipts.
--
-- So the moment any part of an order was received, the rest of it stopped
-- counting as incoming: qty_incoming fell to zero, needs_ordering turned
-- true again, and the buyer was told to re-order goods already on their way.
-- That is the exact fault that migration set out to remove, left in place for
-- the partly received case. Found by running a purchase end to end: ordered
-- 100, received 60, and the view reported 0 incoming instead of 40.
--
-- The app had it right all along (OPEN_PO_STATUSES in use-purchasing.ts), so
-- the view and the app disagreed about the same question.
--
-- The guard below fails the migration if these status names ever stop being
-- the real ones, rather than silently matching nothing again.
-- ─────────────────────────────────────────────────────────────

do $$
declare v_def text;
begin
  select pg_get_constraintdef(c.oid) into v_def
  from pg_constraint c
  where c.conrelid = 'public.purchase_orders'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%status%'
  limit 1;

  if v_def is null or v_def not like '%issued%' or v_def not like '%partially_received%' then
    raise exception 'purchase_orders no longer allows the statuses this view matches on: %', coalesce(v_def, '(no check constraint)');
  end if;
end $$;

do $$ begin
execute 'drop view if exists public.v_reorder_alerts';
execute 'drop view if exists public.v_stock_levels';

execute $v$
create view public.v_stock_levels with (security_invoker = true) as
  with incoming as (
    -- Ordered and not yet received, on purchase orders that are still live
    select l.item_id, l.org_id, sum(greatest(l.qty - coalesce(l.qty_received, 0), 0)) as qty
    from public.purchase_order_lines l
    join public.purchase_orders o on o.id = l.po_id
    where o.status in ('issued', 'partially_received')
    group by l.item_id, l.org_id
  )
  select i.id as item_id,
         i.org_id,
         i.item_code,
         i.name,
         i.category_id,
         ic.name as category,
         i.unit_id,
         u.name as unit,
         i.reorder_level,
         i.reorder_qty,
         coalesce(ib.current_qty, 0) as qty_on_hand,
         coalesce(ib.reserved_qty, 0) as qty_reserved,
         coalesce(ib.available_qty, 0) as qty_available,
         coalesce(inc.qty, 0) as qty_incoming,
         coalesce(ib.available_qty, 0) + coalesce(inc.qty, 0) as qty_projected,
         -- A level of 0 (or none) means this item has no minimum to hold
         (coalesce(i.reorder_level, 0) > 0) as tracks_reorder,
         -- Physically at or below the minimum being held
         (coalesce(i.reorder_level, 0) > 0
          and coalesce(ib.available_qty, 0) <= i.reorder_level) as below_reorder,
         -- Still short once goods already on order are counted: this is the
         -- one worth acting on
         (coalesce(i.reorder_level, 0) > 0
          and coalesce(ib.available_qty, 0) + coalesce(inc.qty, 0) <= i.reorder_level) as needs_ordering,
         -- Nothing free to give out, whether or not a minimum is tracked
         (coalesce(ib.available_qty, 0) <= 0) as out_of_stock,
         case
           when coalesce(i.reorder_level, 0) > 0
            and coalesce(ib.available_qty, 0) + coalesce(inc.qty, 0) <= i.reorder_level
           then greatest(
                  coalesce(nullif(i.reorder_qty, 0), 0),
                  i.reorder_level - (coalesce(ib.available_qty, 0) + coalesce(inc.qty, 0))
                )
         end as suggested_order_qty,
         ib.updated_at as balance_updated_at
  from public.items i
  left join public.item_categories ic on ic.id = i.category_id and ic.org_id = i.org_id
  left join public.units u on u.id = i.unit_id and u.org_id = i.org_id
  left join public.inventory_balance ib on ib.item_id = i.id and ib.org_id = i.org_id
  left join incoming inc on inc.item_id = i.id and inc.org_id = i.org_id
  where i.is_active
$v$;

execute $c$comment on view public.v_stock_levels is
  'Live stock per item. qty_projected nets what is on order (issued and partially_received purchase orders) against what is committed. A reorder_level of 0 means the item has no minimum to hold, so tracks_reorder is false and it is never alerted on; out_of_stock is reported separately.'$c$;

execute 'create view public.v_reorder_alerts with (security_invoker = true) as select * from public.v_stock_levels where needs_ordering';

execute $c$comment on view public.v_reorder_alerts is
  'Items with a tracked minimum that are still short after counting goods already on order. suggested_order_qty is the shortfall, or the item''''s order quantity if that is larger.'$c$;

execute 'revoke all on public.v_stock_levels, public.v_reorder_alerts from anon, public';
execute 'revoke insert, update, delete, truncate, references, trigger on public.v_stock_levels, public.v_reorder_alerts from authenticated';
execute 'grant select on public.v_stock_levels, public.v_reorder_alerts to authenticated';
end $$;
