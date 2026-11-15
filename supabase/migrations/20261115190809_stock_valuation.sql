-- ─────────────────────────────────────────────────────────────
-- Stock valuation
--
-- There was no way to value closing stock, which the business needs for
-- its balance sheet and for knowing what is tied up in the godown.
--
-- Each item gets a unit cost from the first of these that applies:
--   purchases  weighted average rate of every priced goods receipt
--   bom        for a manufactured item, its components rolled up
--   price list the current purchase rate on the item
--   none       nothing to go on; the item is listed with no value
--
-- An item that is bought as well as made is costed from what it was
-- actually bought for, so the roll-up stops at any component that has a
-- cost of its own. Nested bills of material are followed 8 levels deep;
-- anything deeper, or a bill that refers back to itself, is reported
-- rather than quietly valued short.
--
-- Everything here is read-only: views only, no change to how stock moves.
-- ─────────────────────────────────────────────────────────────

-- What an item costs, before any bill of material is considered
create view public.v_item_direct_cost with (security_invoker = true) as
  with purchased as (
    select m.item_id,
           round(sum(m.qty * m.rate_at_time) / sum(m.qty), 4) as cost
    from public.stock_movements m
    where m.movement_type = 'inbound' and m.rate_at_time > 0 and m.qty > 0
    group by m.item_id
    having sum(m.qty) > 0
  )
  select i.id as item_id,
         i.org_id,
         coalesce(p.cost, nullif(pr.purchase_rate, 0)) as unit_cost,
         case
           when p.cost is not null then 'purchases'
           when nullif(pr.purchase_rate, 0) is not null then 'price list'
         end as cost_basis
  from public.items i
  left join purchased p on p.item_id = i.id
  left join public.v_current_prices pr on pr.item_id = i.id;

comment on view public.v_item_direct_cost is
  'Unit cost from goods actually received (weighted average of priced GRN lines), else the current price-list purchase rate. Null when there is nothing to go on.';

-- A manufactured item's cost, rolled up from its components. The walk stops
-- at any component that already has a direct cost of its own.
create view public.v_item_bom_cost with (security_invoker = true) as
  with recursive explode as (
    -- Direct components of every bill of material
    select b.finished_item_id as root_item_id,
           b.org_id,
           b.component_id,
           b.qty_per_unit::numeric as qty,
           1 as depth
    from public.bom b
    where b.is_active
    union all
    -- Keep going only through components that have no cost of their own
    select e.root_item_id,
           e.org_id,
           b.component_id,
           e.qty * b.qty_per_unit,
           e.depth + 1
    from explode e
    join public.v_item_direct_cost dc on dc.item_id = e.component_id
    join public.bom b on b.finished_item_id = e.component_id and b.is_active
    where dc.unit_cost is null and e.depth < 8
  ),
  -- Only the parts that actually carry the cost: a component with a direct
  -- cost, or one with no bill of material to explode into
  leaves as (
    select e.root_item_id, e.org_id, e.qty, dc.unit_cost
    from explode e
    left join public.v_item_direct_cost dc on dc.item_id = e.component_id
    where dc.unit_cost is not null
       or not exists (select 1 from public.bom b where b.finished_item_id = e.component_id and b.is_active)
  ),
  rolled as (
    select root_item_id, org_id,
           round(sum(qty * coalesce(unit_cost, 0)), 4) as unit_cost,
           count(*) filter (where unit_cost is null) as components_without_cost
    from leaves
    group by root_item_id, org_id
  ),
  -- Still had somewhere to go at the depth limit: either a bill that refers
  -- back to itself, or one nested deeper than we follow
  capped as (
    select distinct e.root_item_id
    from explode e
    left join public.v_item_direct_cost dc on dc.item_id = e.component_id
    where e.depth >= 8
      and dc.unit_cost is null
      and exists (select 1 from public.bom b where b.finished_item_id = e.component_id and b.is_active)
  ),
  -- Every item that has a bill of material, so one with no costable parts at
  -- all is still reported rather than missing
  parents as (
    select distinct finished_item_id as item_id, org_id from public.bom where is_active
  )
  select p.item_id,
         p.org_id,
         r.unit_cost,
         coalesce(r.components_without_cost, 0) as components_without_cost,
         (c.root_item_id is not null) as bom_unresolved
  from parents p
  left join rolled r on r.root_item_id = p.item_id
  left join capped c on c.root_item_id = p.item_id;

comment on view public.v_item_bom_cost is
  'A manufactured item''s cost rolled up from its components, stopping at any component that has a cost of its own. components_without_cost > 0 means the roll-up is short of some parts; bom_unresolved means the bill is circular or nested deeper than 8 levels.';

-- What the stock on hand is worth, item by item
create view public.v_stock_valuation with (security_invoker = true) as
  select i.id as item_id,
         i.org_id,
         i.item_code,
         i.name,
         i.category_id,
         ic.name as category,
         u.name as unit,
         i.is_manufactured,
         coalesce(ib.current_qty, 0) as qty_on_hand,
         coalesce(ib.reserved_qty, 0) as qty_reserved,
         coalesce(dc.unit_cost, bc.unit_cost) as unit_cost,
         coalesce(dc.cost_basis, case when bc.unit_cost is not null then 'bom' end, 'none') as cost_basis,
         round(coalesce(ib.current_qty, 0) * coalesce(dc.unit_cost, bc.unit_cost, 0), 2) as stock_value,
         case
           when dc.unit_cost is not null then null
           when coalesce(bc.bom_unresolved, false) then 'Bill of material is circular or nested deeper than 8 levels'
           when coalesce(bc.components_without_cost, 0) > 0
             then bc.components_without_cost || ' component(s) have no cost, so this is understated'
         end as cost_warning
  from public.items i
  left join public.item_categories ic on ic.id = i.category_id and ic.org_id = i.org_id
  left join public.units u on u.id = i.unit_id and u.org_id = i.org_id
  left join public.inventory_balance ib on ib.item_id = i.id and ib.org_id = i.org_id
  left join public.v_item_direct_cost dc on dc.item_id = i.id
  left join public.v_item_bom_cost bc on bc.item_id = i.id
  where i.is_active;

comment on view public.v_stock_valuation is
  'Closing stock value per item. cost_basis says where the unit cost came from (purchases, bom, price list, none); cost_warning explains anything the reader should distrust.';

do $$ begin
  execute 'revoke all on public.v_item_direct_cost, public.v_item_bom_cost, public.v_stock_valuation from anon, public';
  execute 'revoke insert, update, delete, truncate, references, trigger on public.v_item_direct_cost, public.v_item_bom_cost, public.v_stock_valuation from authenticated';
end $$;
grant select on public.v_item_direct_cost, public.v_item_bom_cost, public.v_stock_valuation to authenticated;
