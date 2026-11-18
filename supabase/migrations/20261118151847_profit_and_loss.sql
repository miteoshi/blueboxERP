-- ─────────────────────────────────────────────────────────────
-- Profit and loss for a period, from the books the app keeps.
--
--   Net sales            issued invoices less issued credit notes,
--                        taxable value (GST is not income)
-- − Cost of goods sold   opening stock + goods received
--                        − goods returned to suppliers − closing stock
-- = Gross profit
-- − Expenses             active expenses by head (as recorded, GST included)
-- = Net profit
--
-- Stock is costed at a running (moving) average per item, walked through
-- the stock ledger in date order: goods received at their rate update the
-- average; everything that leaves goes out at the average of the moment;
-- other stock coming in (production, sales returns, corrections) comes in
-- at the current average. An item that has never been received with a
-- rate starts from its price-list purchase rate or, if manufactured, from
-- today's bill-of-material cost; an item with none of these is counted at
-- nil and reported. So a period with no sales and no wastage shows no cost
-- of goods sold, whatever happened to purchase prices.
--
-- Depreciation, interest, tax and anything not recorded in the app are not
-- included.
--
-- SECURITY INVOKER: every table is read under the caller's own row level
-- security. Admin, manager and viewer only — the roles that can read
-- invoices, credit notes and expenses alike.
-- ─────────────────────────────────────────────────────────────

create function public.profit_and_loss(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'public'
as $function$
declare
  v_org  uuid := public.my_org();
  v_role public.user_role := public.my_role();

  r          record;
  v_item     uuid;
  v_name     text;
  v_qty      numeric;   -- on hand
  v_avg      numeric;   -- running average cost; null until the item has one
  v_fallback numeric;   -- price list, else bill-of-material cost
  v_fb_basis text;      -- where the fallback came from
  v_basis    text;      -- 'purchases' | 'price_list' | 'bom' | null
  v_opened   boolean;   -- opening position already taken for this item
  v_open_q   numeric;
  v_open_avg numeric;
  v_rate     numeric;

  v_opening  numeric := 0;
  v_closing  numeric := 0;
  v_received numeric := 0;
  v_returned numeric := 0;
  v_on_list  integer := 0;
  v_on_bom   integer := 0;
  v_no_cost  text[]  := '{}';

  v_invoiced numeric;
  v_invoices integer;
  v_credited numeric;
  v_notes    integer;
  v_net      numeric;
  v_cogs     numeric;
  v_exp      jsonb;
  v_exp_tot  numeric;
begin
  if v_role is null or v_role not in ('admin', 'manager', 'viewer') then
    raise exception 'Unauthorized: your role (%) cannot see the profit and loss', coalesce(v_role::text, 'none')
      using errcode = 'P0005';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Choose a period that starts on or before the day it ends' using errcode = '22023';
  end if;

  -- One pass through the ledger, item by item, oldest first. A sentinel row
  -- with a null item closes the last item.
  for r in
    select m.item_id, m.movement_type::text as kind, m.qty, m.rate_at_time, m.movement_date, m.created_at, m.id
    from public.stock_movements m
    where m.org_id = v_org and m.movement_date <= p_to
    union all
    select null, null, null, null, null, null, null
    order by 1 nulls last, 5, 6, 7
  loop
    -- Finished with the previous item: take its opening (if every movement
    -- was before the period) and closing positions
    if v_item is not null and r.item_id is distinct from v_item then
      if not v_opened then
        v_open_q := v_qty;
        v_open_avg := v_avg;
      end if;
      v_opening := v_opening + v_open_q * coalesce(v_open_avg, 0);
      v_closing := v_closing + v_qty * coalesce(v_avg, 0);
      if (v_open_q > 0 and v_open_avg is null) or (v_qty > 0 and v_avg is null) then
        v_no_cost := v_no_cost || v_name;
      elsif v_open_q > 0 or v_qty > 0 then
        if v_basis = 'price_list' then v_on_list := v_on_list + 1;
        elsif v_basis = 'bom' then v_on_bom := v_on_bom + 1;
        end if;
      end if;
    end if;
    exit when r.item_id is null;

    -- Starting a new item
    if r.item_id is distinct from v_item then
      v_item := r.item_id;
      v_qty := 0;
      v_avg := null;
      v_basis := null;
      v_opened := false;
      v_open_q := 0;
      v_open_avg := null;
      select i.name,
             coalesce(nullif(pr.purchase_rate, 0), nullif(bc.unit_cost, 0)),
             case when nullif(pr.purchase_rate, 0) is not null then 'price_list'
                  when nullif(bc.unit_cost, 0) is not null then 'bom' end
      into v_name, v_fallback, v_fb_basis
      from public.items i
      left join public.v_current_prices pr on pr.item_id = i.id
      left join public.v_item_bom_cost bc on bc.item_id = i.id
      where i.id = r.item_id;
      -- Until a priced receipt arrives, the item is valued from its fallback
      v_basis := v_fb_basis;
    end if;

    -- The first movement inside the period: what was on hand before it is the opening stock
    if not v_opened and r.movement_date >= p_from then
      v_open_q := v_qty;
      v_open_avg := v_avg;
      v_opened := true;
    end if;

    if r.kind in ('inbound', 'produced', 'adjustment_in', 'returned_client') then
      -- Priced receipts set the cost; anything else comes in at the current average
      if r.kind = 'inbound' and r.rate_at_time > 0 then
        v_rate := r.rate_at_time;
        v_basis := 'purchases';
      else
        v_rate := coalesce(v_avg, v_fallback);
      end if;
      if v_rate is not null then
        v_avg := case when v_qty + r.qty > 0
                      then (v_qty * coalesce(v_avg, v_rate) + r.qty * v_rate) / (v_qty + r.qty)
                      else v_rate end;
      end if;
      v_qty := v_qty + r.qty;
      if r.kind = 'inbound' and r.movement_date >= p_from then
        v_received := v_received + r.qty * coalesce(v_rate, 0);
      end if;
    else
      -- consumed, sold, adjustment_out, returned_supplier: out at the average of the moment
      if r.kind = 'returned_supplier' and r.movement_date >= p_from then
        v_returned := v_returned + least(r.qty, v_qty) * coalesce(v_avg, 0);
      end if;
      v_qty := greatest(0, v_qty - r.qty);
    end if;
  end loop;

  select coalesce(sum(taxable_value), 0), count(*)
  into v_invoiced, v_invoices
  from public.sales_invoices
  where org_id = v_org and status = 'issued' and invoice_date between p_from and p_to;

  select coalesce(sum(taxable_value), 0), count(*)
  into v_credited, v_notes
  from public.credit_notes
  where org_id = v_org and status = 'issued' and note_date between p_from and p_to;

  select coalesce(jsonb_agg(jsonb_build_object('head', head, 'amount', amount, 'entries', entries)
                            order by amount desc, head), '[]'::jsonb),
         coalesce(sum(amount), 0)
  into v_exp, v_exp_tot
  from (
    select h.name as head, round(sum(e.amount), 2) as amount, count(*) as entries
    from public.expenses e
    join public.expense_heads h on h.id = e.head_id
    where e.org_id = v_org and e.status = 'active' and e.expense_date between p_from and p_to
    group by h.name
  ) x;

  v_net := round(v_invoiced - v_credited, 2);
  v_cogs := round(v_opening + v_received - v_returned - v_closing, 2);

  return jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'sales', jsonb_build_object(
      'invoiced', round(v_invoiced, 2), 'invoices', v_invoices,
      'credit_notes', round(v_credited, 2), 'notes', v_notes,
      'net', v_net),
    'stock', jsonb_build_object(
      'opening', round(v_opening, 2),
      'received', round(v_received, 2),
      'returned_to_suppliers', round(v_returned, 2),
      'closing', round(v_closing, 2),
      'cost_of_goods_sold', v_cogs,
      'items_on_price_list', v_on_list,
      'items_on_bom', v_on_bom,
      'items_without_cost', coalesce(array_length(v_no_cost, 1), 0),
      'items_without_cost_sample', coalesce(to_jsonb((select array_agg(n order by n) from unnest(v_no_cost) n)[1:5]), '[]'::jsonb)),
    'gross_profit', round(v_net - v_cogs, 2),
    'expenses', v_exp,
    'expenses_total', round(v_exp_tot, 2),
    'net_profit', round(v_net - v_cogs - v_exp_tot, 2)
  );
end;
$function$;

comment on function public.profit_and_loss(date, date) is
  'Profit and loss for a period: net sales (taxable), cost of goods sold as opening stock + goods received - returns to suppliers - closing stock at a running average cost per item, expenses by head, gross and net profit. Admin, manager and viewer.';

do $$ begin
  execute 'revoke all on function public.profit_and_loss(date, date) from public, anon';
end $$;
grant execute on function public.profit_and_loss(date, date) to authenticated;
