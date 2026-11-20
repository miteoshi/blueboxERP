-- ─────────────────────────────────────────────────────────────
-- TDS on expenses.
--
-- Rent, professional fees, contract labour and commission are usually
-- recorded as expenses, not supplier bills, and TDS is deducted on them too.
-- An expense can now deduct TDS: the payee gets the cash (amount), TDS is
-- owed to the government, and the expense costs both together (cost).
-- Cash, bank and bank reconciliation still read amount.
--
-- expenses.payee_pan, tds_*   the payee's PAN and the TDS, as on supplier
--                             payments; cost = amount + tds_amount
-- record_expense()            takes the TDS and PAN; TDS needs a payee name
-- profit_and_loss()           expenses count at cost
-- tds_ledger()                counts TDS deducted on expenses as well
-- ─────────────────────────────────────────────────────────────

alter table public.expenses
  add column payee_pan text,
  add column tds_code text,
  add column tds_rate numeric(6,3),
  add column tds_base numeric(14,2),
  add column tds_amount numeric(14,2) not null default 0,
  add column cost numeric(14,2) generated always as (amount + tds_amount) stored;
alter table public.expenses add constraint expenses_payee_pan_check
  check (payee_pan is null or payee_pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$');
alter table public.expenses add constraint expenses_tds_check check (
  (tds_amount = 0 and tds_code is null and tds_rate is null and tds_base is null)
  or (tds_amount > 0 and tds_code ~ '^[0-9]{4}$' and tds_rate > 0 and tds_rate <= 100
      and tds_base > 0 and tds_amount <= tds_base));
create index expenses_tds_idx on public.expenses (org_id, expense_date) where tds_amount > 0;

comment on column public.expenses.amount is 'Money paid to the payee (cash, bank, UPI...).';
comment on column public.expenses.tds_amount is 'TDS deducted from the payee and owed to the government.';
comment on column public.expenses.cost is 'What the expense costs: amount + tds_amount.';
comment on column public.expenses.payee_pan is 'The payee''s Permanent Account Number, for TDS returns.';

-- The books lock also guards the TDS on an expense
do $$ begin
  execute 'drop trigger trg_books_lock on public.expenses';
end $$;
create trigger trg_books_lock before insert or update on public.expenses for each row
  execute function public._guard_books_lock('expense_date', 'expense_date', 'status', 'head_id', 'amount', 'mode', 'tds_code', 'tds_rate', 'tds_base', 'tds_amount');

do $$ begin
  execute 'drop function public.record_expense(uuid, numeric, text, date, text, text, text, uuid)';
end $$;

create function public.record_expense(
  p_head_id uuid,
  p_amount numeric,
  p_mode text,
  p_expense_date date default null,
  p_payee text default null,
  p_reference text default null,
  p_notes text default null,
  p_request_id uuid default null,
  p_payee_pan text default null,
  p_tds_code text default null,
  p_tds_rate numeric default null,
  p_tds_base numeric default null,
  p_tds_amount numeric default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org  uuid := public.my_org();
  v_date date := coalesce(p_expense_date, current_date);
  v_head public.expense_heads;
  v_tds  numeric := coalesce(p_tds_amount, 0);
  v_pan  text := nullif(upper(trim(p_payee_pan)), '');
  v_fy   text;
  v_no   text;
  v_id   uuid;
begin
  perform public.assert_my_role('admin', 'manager');
  perform public._claim_document_request(p_request_id, 'record_expense');
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;
  if round(p_amount, 2) <> p_amount then
    raise exception 'Amount can have at most 2 decimals' using errcode = '22023';
  end if;
  if p_mode is null or p_mode not in ('cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other') then
    raise exception 'Unknown payment mode %', p_mode using errcode = '22023';
  end if;
  if v_date > current_date then
    raise exception 'Expense date cannot be in the future' using errcode = '22023';
  end if;
  select * into v_head from public.expense_heads where id = p_head_id and org_id = v_org;
  if not found then
    raise exception 'Expense head not found' using errcode = 'P0002';
  end if;
  if not v_head.is_active then
    raise exception 'Expense head % is switched off', v_head.name using errcode = 'P0008';
  end if;
  if v_pan is not null and v_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then
    raise exception 'A PAN is 5 letters, 4 digits and a letter, like ABCDE1234F' using errcode = '22023';
  end if;

  -- TDS: a code, the rate, what it was worked out on, and the amount, or none of them
  if v_tds < 0 or round(v_tds, 2) <> v_tds then
    raise exception 'TDS must be zero or more, with at most 2 decimals' using errcode = '22023';
  end if;
  if v_tds = 0 then
    if p_tds_code is not null or p_tds_rate is not null or p_tds_base is not null then
      raise exception 'Give the TDS amount, or leave TDS out' using errcode = '22023';
    end if;
  else
    if nullif(trim(p_payee), '') is null then
      raise exception 'Give the payee''s name: the TDS return needs it' using errcode = '22023';
    end if;
    if p_tds_code is null or p_tds_code !~ '^[0-9]{4}$' then
      raise exception 'Choose the TDS payment code, like 1009' using errcode = '22023';
    end if;
    if p_tds_rate is null or p_tds_rate <= 0 or p_tds_rate > 100 or round(p_tds_rate, 3) <> p_tds_rate then
      raise exception 'Give the TDS rate as a percentage, like 2 or 10' using errcode = '22023';
    end if;
    if p_tds_base is null or p_tds_base <= 0 or round(p_tds_base, 2) <> p_tds_base then
      raise exception 'Give the amount TDS was worked out on' using errcode = '22023';
    end if;
    if v_tds > p_tds_base then
      raise exception 'TDS cannot be more than the amount it was worked out on' using errcode = '22023';
    end if;
    if abs(v_tds - p_tds_base * p_tds_rate / 100) > 1 then
      raise exception 'TDS at % percent of % is %, not %', p_tds_rate, p_tds_base, round(p_tds_base * p_tds_rate / 100, 2), v_tds
        using errcode = '22023';
    end if;
  end if;

  v_fy := public.financial_year(v_date);
  v_no := 'EXP/' || v_fy || '/' || lpad(public.next_org_seq(v_org, 'exp:' || v_fy)::text, 4, '0');
  insert into public.expenses (org_id, expense_no, expense_date, financial_year, head_id, payee, payee_pan, amount, mode, reference, notes,
                               tds_code, tds_rate, tds_base, tds_amount, created_by)
  values (v_org, v_no, v_date, v_fy, p_head_id, nullif(trim(p_payee), ''), v_pan, p_amount, p_mode,
          nullif(trim(p_reference), ''), nullif(trim(p_notes), ''),
          case when v_tds > 0 then p_tds_code end, case when v_tds > 0 then p_tds_rate end,
          case when v_tds > 0 then p_tds_base end, v_tds, auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'expense_no', v_no, 'amount', p_amount, 'tds', v_tds, 'cost', p_amount + v_tds);
end;
$function$;

comment on function public.record_expense(uuid, numeric, text, date, text, text, text, uuid, text, text, numeric, numeric, numeric) is
  'Records an expense, numbered EXP/<fy>/<nnnn>, optionally deducting TDS (code, rate, the amount it was worked out on, and TDS; the payee''s name is then required). The expense costs the money paid plus the TDS. Admin and manager. p_request_id makes a retried submission safe.';

-- ── Profit and loss: an expense costs cash + TDS ──────────────
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
  v_inc      jsonb;
  v_inc_tot  numeric;
  v_fa       jsonb;
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

  -- Depreciation and the profit or loss on assets sold, asset by asset
  v_fa := public.fixed_asset_register(p_from, p_to);

  select coalesce(jsonb_agg(jsonb_build_object('head', head, 'amount', amount, 'entries', entries)
                            order by amount desc, head), '[]'::jsonb),
         coalesce(sum(amount), 0)
  into v_exp, v_exp_tot
  from (
    select head, round(sum(amount), 2) as amount, count(*) as entries
    from (
      -- An expense costs the money paid plus any TDS deducted from it
      select h.name as head, e.cost as amount
      from public.expenses e
      join public.expense_heads h on h.id = e.head_id
      where e.org_id = v_org and e.status = 'active' and e.expense_date between p_from and p_to
      union all
      -- Interest and late fee paid with GST are a cost; the tax itself is not
      select 'GST interest and late fee', g.interest + g.late_fee
      from public.gst_payments g
      where g.org_id = v_org and g.status = 'active' and g.payment_date between p_from and p_to
        and g.interest + g.late_fee > 0
      union all
      -- Interest and late fee on TDS paid late are a cost; the TDS itself is not
      select 'TDS interest and late fee', d.interest + d.late_fee
      from public.tds_deposits d
      where d.org_id = v_org and d.status = 'active' and d.deposit_date between p_from and p_to
        and d.interest + d.late_fee > 0
      union all
      -- Interest on loans is a cost; the principal is not
      select 'Interest on loans', f.interest
      from public.funding_entries f
      where f.org_id = v_org and f.status = 'active' and f.entry_date between p_from and p_to
        and f.interest > 0
      union all
      select 'Depreciation', (x ->> 'depreciation')::numeric
      from jsonb_array_elements(v_fa -> 'assets') x
      where (x ->> 'depreciation')::numeric > 0
      union all
      select 'Loss on sale of assets', -(x ->> 'gain')::numeric
      from jsonb_array_elements(v_fa -> 'assets') x
      where (x ->> 'gain')::numeric < 0
    ) e
    group by head
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object('head', head, 'amount', amount, 'entries', entries)
                            order by amount desc, head), '[]'::jsonb),
         coalesce(sum(amount), 0)
  into v_inc, v_inc_tot
  from (
    select head, round(sum(amount), 2) as amount, count(*) as entries
    from (
      select h.name as head, i.amount
      from public.other_income i
      join public.income_heads h on h.id = i.head_id
      where i.org_id = v_org and i.status = 'active' and i.income_date between p_from and p_to
      union all
      select 'Profit on sale of assets', (x ->> 'gain')::numeric
      from jsonb_array_elements(v_fa -> 'assets') x
      where (x ->> 'gain')::numeric > 0
    ) i
    group by head
  ) y;

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
    'other_income', v_inc,
    'other_income_total', round(v_inc_tot, 2),
    'net_profit', round(v_net - v_cogs - v_exp_tot + v_inc_tot, 2)
  );
end;
$function$;

-- ── The TDS ledger counts TDS on expenses ─────────────────────
create or replace function public.tds_ledger(p_as_of date)
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'public'
as $function$
declare
  v_org     uuid := public.my_org();
  v_role    public.user_role := public.my_role();
  v_open    public.tds_openings;
  v_after   date;
  v_opening numeric := 0;
  v_ded     numeric;
  v_dep     numeric;
  v_charges numeric;
  v_months  jsonb;
  v_codes   jsonb;
begin
  if v_role is null or v_role not in ('admin', 'manager', 'viewer') then
    raise exception 'Unauthorized: your role (%) cannot see TDS', coalesce(v_role::text, 'none')
      using errcode = 'P0005';
  end if;
  if p_as_of is null then
    raise exception 'Choose the day' using errcode = '22023';
  end if;

  select * into v_open from public.tds_openings where org_id = v_org;
  if found then
    if p_as_of < v_open.as_of then
      -- Before the opening day nothing is known for certain
      return jsonb_build_object('set', false, 'as_of', p_as_of, 'opening_as_of', v_open.as_of);
    end if;
    v_after := v_open.as_of;
    v_opening := v_open.amount;
  end if;

  -- TDS is deducted on supplier payments and on expenses
  select coalesce(sum(t), 0) into v_ded
  from (
    select tds_amount as t from public.supplier_payments
    where org_id = v_org and status = 'active' and tds_amount > 0
      and (v_after is null or payment_date > v_after) and payment_date <= p_as_of
    union all
    select tds_amount from public.expenses
    where org_id = v_org and status = 'active' and tds_amount > 0
      and (v_after is null or expense_date > v_after) and expense_date <= p_as_of
  ) d;

  select coalesce(sum(tax), 0), coalesce(sum(interest + late_fee), 0) into v_dep, v_charges
  from public.tds_deposits
  where org_id = v_org and status = 'active'
    and (v_after is null or deposit_date > v_after) and deposit_date <= p_as_of;

  -- Month by month: deducted in the month, deposited for it, and when it is due
  select coalesce(jsonb_agg(jsonb_build_object(
           'period', period, 'deducted', deducted, 'deposited', deposited,
           'outstanding', round(deducted - deposited, 2), 'due_date', public.tds_due_date(period),
           'overdue', deducted - deposited >= 0.005 and public.tds_due_date(period) < p_as_of)
           order by period desc), '[]'::jsonb)
  into v_months
  from (
    select period, round(sum(ded), 2) as deducted, round(sum(dep), 2) as deposited
    from (
      select to_char(payment_date, 'YYYY-MM') as period, tds_amount as ded, 0::numeric as dep
      from public.supplier_payments
      where org_id = v_org and status = 'active' and tds_amount > 0
        and (v_after is null or payment_date > v_after) and payment_date <= p_as_of
      union all
      select to_char(expense_date, 'YYYY-MM'), tds_amount, 0
      from public.expenses
      where org_id = v_org and status = 'active' and tds_amount > 0
        and (v_after is null or expense_date > v_after) and expense_date <= p_as_of
      union all
      select period, 0, tax
      from public.tds_deposits
      where org_id = v_org and status = 'active' and tax > 0
        and (v_after is null or deposit_date > v_after) and deposit_date <= p_as_of
    ) x
    group by period
  ) m;

  select coalesce(jsonb_agg(jsonb_build_object('code', tds_code, 'deducted', deducted, 'base', base, 'payments', payments)
                            order by tds_code), '[]'::jsonb)
  into v_codes
  from (
    select tds_code, round(sum(tds_amount), 2) as deducted, round(sum(tds_base), 2) as base, count(*) as payments
    from (
      select tds_code, tds_amount, tds_base from public.supplier_payments
      where org_id = v_org and status = 'active' and tds_amount > 0
        and (v_after is null or payment_date > v_after) and payment_date <= p_as_of
      union all
      select tds_code, tds_amount, tds_base from public.expenses
      where org_id = v_org and status = 'active' and tds_amount > 0
        and (v_after is null or expense_date > v_after) and expense_date <= p_as_of
    ) t
    group by tds_code
  ) c;

  return jsonb_build_object(
    'set', true,
    'as_of', p_as_of,
    'opening_as_of', v_open.as_of,
    'opening', round(v_opening, 2),
    'deducted', round(v_ded, 2),
    'deposited', round(v_dep, 2),
    'interest_and_late_fee', round(v_charges, 2),
    'balance', round(v_opening + v_ded - v_dep, 2),
    'months', v_months,
    'codes', v_codes);
end;
$function$;

do $$ begin
  execute 'revoke all on function public.record_expense(uuid, numeric, text, date, text, text, text, uuid, text, text, numeric, numeric, numeric) from public, anon';
end $$;
grant execute on function public.record_expense(uuid, numeric, text, date, text, text, text, uuid, text, text, numeric, numeric, numeric) to authenticated;
