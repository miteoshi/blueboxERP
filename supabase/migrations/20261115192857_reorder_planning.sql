-- ─────────────────────────────────────────────────────────────
-- Make the low-stock alert mean something
--
-- Two faults in v_stock_levels made the alert useless in practice:
--
--  1. below_reorder was `available <= reorder_level`, and 211 of 309 active
--     items have a reorder level of 0 — the value you leave when an item has
--     no minimum worth tracking. 0 <= 0 is true, so the alert flagged 308 of
--     309 items. The dashboard tile, the inventory alert tab and the "order
--     low stock" button were all telling the user that everything is urgent.
--
--  2. Nothing already on order was netted off, so once purchasing went live
--     the alert would keep asking the buyer to re-order goods that were
--     already on their way.
--
-- Now a reorder level of 0 means "not tracked" and is never alerted on,
-- running out of stock is reported separately from breaching a minimum, and
-- the buying decision is made on projected stock: on hand, less what is
-- committed, plus what is already on order.
-- ─────────────────────────────────────────────────────────────

do $$ begin
  execute 'drop view if exists public.v_reorder_alerts';
  execute 'drop view if exists public.v_stock_levels';
end $$;

create view public.v_stock_levels with (security_invoker = true) as
  with incoming as (
    -- Ordered and not yet received, on purchase orders that are still live
    select l.item_id, l.org_id, sum(greatest(l.qty - coalesce(l.qty_received, 0), 0)) as qty
    from public.purchase_order_lines l
    join public.purchase_orders o on o.id = l.po_id
    where o.status in ('issued', 'partial')
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
  where i.is_active;

comment on view public.v_stock_levels is
  'Live stock per item. qty_projected nets what is on order against what is committed. A reorder_level of 0 means the item has no minimum to hold, so tracks_reorder is false and it is never alerted on; out_of_stock is reported separately.';

-- What the buyer should act on
create view public.v_reorder_alerts with (security_invoker = true) as
  select * from public.v_stock_levels where needs_ordering;

comment on view public.v_reorder_alerts is
  'Items with a tracked minimum that are still short after counting goods already on order. suggested_order_qty is the shortfall, or the item''s reorder quantity if that is larger.';

do $$ begin
  execute 'revoke all on public.v_stock_levels, public.v_reorder_alerts from anon, public';
  execute 'revoke insert, update, delete, truncate, references, trigger on public.v_stock_levels, public.v_reorder_alerts from authenticated';
end $$;
grant select on public.v_stock_levels, public.v_reorder_alerts to authenticated;
