-- ─────────────────────────────────────────────────────────────
-- Same-moment ordering in the profit and loss and the statements.
--
-- Documents saved in one transaction share a created_at. Until now ties
-- were broken by random id (stock) or by document number (statements):
--
-- * profit_and_loss() could take a sale before the receipt that brought
--   the goods in; stock cannot go below nil, so that sale's cost was lost.
--   Stock coming in is now taken first on a tie.
-- * client_statement() / supplier_statement() could list a credit note
--   before its invoice. On a tie the order is now invoice or bill, then
--   credit or debit note, then receipt or payment.
--
-- Found by an end-to-end run on real documents created in one transaction.
-- In normal use each save is its own transaction, so earlier figures are
-- unaffected unless several movements of one item were saved together.
-- ─────────────────────────────────────────────────────────────

create or replace function public.profit_and_loss(p_from date, p_to date)
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
    select m.item_id, m.movement_type::text as kind, m.qty, m.rate_at_time, m.movement_date, m.created_at, m.id,
           case when m.movement_type in ('inbound', 'produced', 'adjustment_in', 'returned_client') then 0 else 1 end as out_first
    from public.stock_movements m
    where m.org_id = v_org and m.movement_date <= p_to
    union all
    select null, null, null, null, null, null, null, null
    -- Movements saved in the same transaction share a timestamp: stock coming
    -- in is then taken before stock going out, so nothing leaves before it arrived
    order by 1 nulls last, 5, 6, 8, 7
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

create or replace function public.client_statement(
  p_client_id uuid,
  p_from date,
  p_to date
) returns table (
  seq integer,
  entry_date date,
  kind text,
  doc_id uuid,
  doc_no text,
  detail text,
  debit numeric,
  credit numeric,
  balance numeric
)
language plpgsql
stable
security invoker
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
  v_role public.user_role := public.my_role();
begin
  -- assert_my_role() is for the definer-rights workflow functions and is
  -- not callable from here, so the same check is written out
  if v_role is null or v_role not in ('admin', 'manager', 'sales', 'viewer') then
    raise exception 'Unauthorized: your role (%) cannot see a customer statement', coalesce(v_role::text, 'none')
      using errcode = 'P0005';
  end if;

  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Choose a period that starts on or before the day it ends' using errcode = '22023';
  end if;
  if not exists (select 1 from public.clients c where c.id = p_client_id and c.org_id = v_org) then
    raise exception 'Client not found' using errcode = 'P0002';
  end if;

  return query
  with entries as (
    select i.invoice_date as d, i.created_at as at, 'invoice'::text as k, i.id, i.invoice_no as no,
           null::text as detail, i.total_amount as dr, 0::numeric as cr, 0 as tie
    from public.sales_invoices i
    where i.org_id = v_org and i.client_id = p_client_id and i.status = 'issued' and i.invoice_date <= p_to
    union all
    select r.receipt_date, r.created_at, 'receipt', r.id, r.receipt_no,
           nullif(concat_ws(' · ', nullif(r.mode, ''), nullif(r.reference, '')), ''), 0, r.amount, 2
    from public.customer_receipts r
    where r.org_id = v_org and r.client_id = p_client_id and r.status = 'active' and r.receipt_date <= p_to
    union all
    select n.note_date, n.created_at, 'credit_note', n.id, n.credit_note_no, n.reason, 0, n.total_amount, 1
    from public.credit_notes n
    where n.org_id = v_org and n.client_id = p_client_id and n.status = 'issued' and n.note_date <= p_to
  ),
  opening as (
    select coalesce(sum(e.dr - e.cr), 0) as amount from entries e where e.d < p_from
  ),
  period as (
    select e.*, (row_number() over (order by e.d, e.at, e.tie, e.no))::integer as rn
    from entries e where e.d >= p_from
  )
  select 0, p_from, 'opening'::text, null::uuid, null::text, null::text,
         greatest(o.amount, 0), greatest(-o.amount, 0), o.amount
  from opening o
  union all
  select p.rn, p.d, p.k, p.id, p.no, p.detail, p.dr, p.cr,
         o.amount + sum(p.dr - p.cr) over (order by p.rn)
  from period p cross join opening o
  order by 1;
end;
$function$;

comment on function public.client_statement(uuid, date, date) is
  'Statement of account for a customer: opening balance, then issued invoices (debit), active receipts and issued credit notes (credit) in the period with a running balance. Positive balance = the customer owes us. Admin, manager, sales and viewer.';

create or replace function public.supplier_statement(
  p_supplier_id uuid,
  p_from date,
  p_to date
) returns table (
  seq integer,
  entry_date date,
  kind text,
  doc_id uuid,
  doc_no text,
  detail text,
  debit numeric,
  credit numeric,
  balance numeric
)
language plpgsql
stable
security invoker
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
  v_role public.user_role := public.my_role();
begin
  if v_role is null or v_role not in ('admin', 'manager', 'viewer') then
    raise exception 'Unauthorized: your role (%) cannot see a supplier statement', coalesce(v_role::text, 'none')
      using errcode = 'P0005';
  end if;

  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Choose a period that starts on or before the day it ends' using errcode = '22023';
  end if;
  if not exists (select 1 from public.suppliers s where s.id = p_supplier_id and s.org_id = v_org) then
    raise exception 'Supplier not found' using errcode = 'P0002';
  end if;

  return query
  with entries as (
    select b.bill_date as d, b.created_at as at, 'bill'::text as k, b.id, b.bill_no as no,
           nullif(b.supplier_invoice_no, '') as detail, 0::numeric as dr, b.total_amount as cr, 0 as tie
    from public.supplier_bills b
    where b.org_id = v_org and b.supplier_id = p_supplier_id and b.status = 'posted' and b.bill_date <= p_to
    union all
    select y.payment_date, y.created_at, 'payment', y.id, y.payment_no,
           nullif(concat_ws(' · ', nullif(y.mode, ''), nullif(y.reference, '')), ''), y.amount, 0, 2
    from public.supplier_payments y
    where y.org_id = v_org and y.supplier_id = p_supplier_id and y.status = 'active' and y.payment_date <= p_to
    union all
    select n.note_date, n.created_at, 'debit_note', n.id, n.debit_note_no, n.reason, n.total_amount, 0, 1
    from public.debit_notes n
    where n.org_id = v_org and n.supplier_id = p_supplier_id and n.status = 'issued' and n.note_date <= p_to
  ),
  opening as (
    select coalesce(sum(e.cr - e.dr), 0) as amount from entries e where e.d < p_from
  ),
  period as (
    select e.*, (row_number() over (order by e.d, e.at, e.tie, e.no))::integer as rn
    from entries e where e.d >= p_from
  )
  select 0, p_from, 'opening'::text, null::uuid, null::text, null::text,
         greatest(-o.amount, 0), greatest(o.amount, 0), o.amount
  from opening o
  union all
  select p.rn, p.d, p.k, p.id, p.no, p.detail, p.dr, p.cr,
         o.amount + sum(p.cr - p.dr) over (order by p.rn)
  from period p cross join opening o
  order by 1;
end;
$function$;

comment on function public.supplier_statement(uuid, date, date) is
  'Statement of account for a supplier: opening balance, then posted bills (credit), active payments and issued debit notes (debit) in the period with a running balance. Positive balance = we owe the supplier. Admin, manager and viewer.';

do $$ begin
  execute 'revoke all on function public.client_statement(uuid, date, date) from public, anon';
  execute 'revoke all on function public.supplier_statement(uuid, date, date) from public, anon';
end $$;
grant execute on function public.client_statement(uuid, date, date) to authenticated;
grant execute on function public.supplier_statement(uuid, date, date) to authenticated;
