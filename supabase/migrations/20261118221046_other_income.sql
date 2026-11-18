-- ─────────────────────────────────────────────────────────────
-- Other income: money received that is not a customer receipt —
-- interest from the bank, discounts received, scrap sales, commission.
--
-- income_heads    the categories an organisation files it under
-- other_income    one row per amount received, numbered INC/<fy>/<nnnn>
--
-- The mirror of expenses: read by admin, manager and viewer; written only
-- through the functions below (admin and manager); never deleted, only
-- cancelled with a reason. The amount is what was received in full; GST is
-- not split out, so a taxable scrap sale still needs its tax accounted for
-- separately.
--
-- Other income now counts in:
--   profit_and_loss()   net profit = gross profit - expenses + other income
--   money_balances()    cash or bank, by mode
--   v_bank_entries / set_bank_dates()   bank reconciliation (doc_type income)
-- ─────────────────────────────────────────────────────────────

create table public.income_heads (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id),
  name       text not null check (length(trim(name)) between 1 and 60),
  is_active  boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create unique index income_heads_org_name_key on public.income_heads (org_id, lower(name));
create index income_heads_created_by_idx on public.income_heads (created_by);

comment on table public.income_heads is
  'Categories for other income (Interest received, Discount received…). Written through save_income_head().';

create table public.other_income (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id),
  income_no      text not null,
  income_date    date not null,
  financial_year text not null,
  head_id        uuid not null references public.income_heads(id),
  received_from  text,
  amount         numeric(14,2) not null check (amount > 0),
  mode           text not null check (mode in ('cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other')),
  reference      text,
  notes          text,
  status         text not null default 'active' check (status in ('active', 'cancelled')),
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  cancelled_by   uuid references public.profiles(id),
  cancelled_at   timestamptz,
  cancel_reason  text,
  constraint other_income_org_no_key unique (org_id, income_no)
);
create index other_income_org_date_idx on public.other_income (org_id, income_date);
create index other_income_head_idx on public.other_income (head_id);
create index other_income_created_by_idx on public.other_income (created_by);
create index other_income_cancelled_by_idx on public.other_income (cancelled_by);

comment on table public.other_income is
  'Money received that is not a customer receipt. Written through record_other_income() and cancel_other_income(); rows are cancelled, never deleted.';

create trigger trg_aud_income_heads after insert or update or delete on public.income_heads
  for each row execute function public.write_audit_log();
create trigger trg_aud_other_income after insert or update or delete on public.other_income
  for each row execute function public.write_audit_log();

alter table public.income_heads enable row level security;
alter table public.other_income enable row level security;

create policy "payables roles read income heads" on public.income_heads for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'viewer'));
create policy "payables roles read other income" on public.other_income for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'viewer'));

do $$ begin
  execute 'revoke all on public.income_heads, public.other_income from anon';
  execute 'revoke insert, update, delete, truncate, references, trigger on public.income_heads, public.other_income from authenticated';
end $$;
grant select on public.income_heads, public.other_income to authenticated;

-- ── Starting heads ────────────────────────────────────────────
create function public._seed_income_heads(p_org_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  insert into public.income_heads (org_id, name)
  select p_org_id, h.name
  from (values
    ('Interest received'), ('Discount received'), ('Scrap sales'),
    ('Commission received'), ('Rent received'), ('Other')
  ) as h(name)
  on conflict do nothing;
$function$;

create function public._seed_income_heads_for_new_org()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public._seed_income_heads(new.id);
  return new;
end;
$function$;

create trigger trg_seed_income_heads after insert on public.organizations
  for each row execute function public._seed_income_heads_for_new_org();

-- Organisations that already exist get the same starting list
select public._seed_income_heads(o.id) from public.organizations o;

-- ── Heads ─────────────────────────────────────────────────────
create function public.save_income_head(
  p_name text,
  p_id uuid default null,
  p_is_active boolean default true
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org  uuid := public.my_org();
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_id   uuid;
begin
  perform public.assert_my_role('admin', 'manager');
  if v_name = '' then
    raise exception 'Give the income head a name' using errcode = '22023';
  end if;
  if length(v_name) > 60 then
    raise exception 'An income head name can be at most 60 characters' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.income_heads
    where org_id = v_org and lower(name) = lower(v_name) and id is distinct from p_id
  ) then
    raise exception 'There is already an income head called %', v_name using errcode = 'P0008';
  end if;

  if p_id is null then
    insert into public.income_heads (org_id, name, is_active, created_by)
    values (v_org, v_name, coalesce(p_is_active, true), auth.uid())
    returning id into v_id;
  else
    update public.income_heads
    set name = v_name, is_active = coalesce(p_is_active, true)
    where id = p_id and org_id = v_org
    returning id into v_id;
    if v_id is null then
      raise exception 'Income head not found' using errcode = 'P0002';
    end if;
  end if;
  return jsonb_build_object('id', v_id, 'name', v_name, 'is_active', coalesce(p_is_active, true));
end;
$function$;

comment on function public.save_income_head(text, uuid, boolean) is
  'Adds an income head, or renames / switches one on or off when p_id is given. Admin and manager.';

-- ── Other income ──────────────────────────────────────────────
create function public.record_other_income(
  p_head_id uuid,
  p_amount numeric,
  p_mode text,
  p_income_date date default null,
  p_received_from text default null,
  p_reference text default null,
  p_notes text default null,
  p_request_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org  uuid := public.my_org();
  v_date date := coalesce(p_income_date, current_date);
  v_head public.income_heads;
  v_fy   text;
  v_no   text;
  v_id   uuid;
begin
  perform public.assert_my_role('admin', 'manager');
  perform public._claim_document_request(p_request_id, 'record_other_income');
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;
  if round(p_amount, 2) <> p_amount then
    raise exception 'Amount can have at most 2 decimals' using errcode = '22023';
  end if;
  if p_amount >= 1000000000000 then
    raise exception 'Amount is too large' using errcode = '22023';
  end if;
  if p_mode is null or p_mode not in ('cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other') then
    raise exception 'Unknown payment mode %', p_mode using errcode = '22023';
  end if;
  if v_date > current_date then
    raise exception 'Income date cannot be in the future' using errcode = '22023';
  end if;
  select * into v_head from public.income_heads where id = p_head_id and org_id = v_org;
  if not found then
    raise exception 'Income head not found' using errcode = 'P0002';
  end if;
  if not v_head.is_active then
    raise exception 'Income head % is switched off', v_head.name using errcode = 'P0008';
  end if;

  v_fy := public.financial_year(v_date);
  v_no := 'INC/' || v_fy || '/' || lpad(public.next_org_seq(v_org, 'inc:' || v_fy)::text, 4, '0');
  insert into public.other_income (org_id, income_no, income_date, financial_year, head_id, received_from, amount, mode, reference, notes, created_by)
  values (v_org, v_no, v_date, v_fy, p_head_id, nullif(trim(p_received_from), ''), p_amount, p_mode,
          nullif(trim(p_reference), ''), nullif(trim(p_notes), ''), auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'income_no', v_no, 'amount', p_amount);
end;
$function$;

comment on function public.record_other_income(uuid, numeric, text, date, text, text, text, uuid) is
  'Records money received that is not a customer receipt, under a head, numbered INC/<fy>/<nnnn>. Admin and manager. p_request_id makes a retried submission safe.';

create function public.cancel_other_income(p_income_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
  v_inc public.other_income;
begin
  perform public.assert_my_role('admin', 'manager');
  if nullif(trim(p_reason), '') is null then
    raise exception 'Give a reason for cancelling the income entry' using errcode = '22023';
  end if;
  select * into v_inc from public.other_income where id = p_income_id and org_id = v_org for update;
  if not found then
    raise exception 'Income entry not found' using errcode = 'P0002';
  end if;
  if v_inc.status = 'cancelled' then
    raise exception 'Income entry % is already cancelled', v_inc.income_no using errcode = 'P0008';
  end if;
  update public.other_income
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), cancel_reason = trim(p_reason)
  where id = p_income_id;
  return jsonb_build_object('id', p_income_id, 'income_no', v_inc.income_no, 'status', 'cancelled');
end;
$function$;

comment on function public.cancel_other_income(uuid, text) is
  'Cancels an other-income entry with a reason; the row is kept. Admin and manager.';

-- ── Bank reconciliation takes income entries too ──────────────
alter table public.bank_clearings drop constraint bank_clearings_doc_type_check;
alter table public.bank_clearings add constraint bank_clearings_doc_type_check
  check (doc_type in ('receipt', 'supplier_payment', 'expense', 'income', 'transfer'));

create or replace view public.v_bank_entries with (security_invoker = true) as
select r.org_id, 'receipt'::text as kind, r.id as doc_id, r.receipt_no as doc_no, r.receipt_date as doc_date, r.created_at,
       c.name as party, null::text as detail, r.mode, r.reference,
       r.amount as deposit, 0::numeric as withdrawal, bc.bank_date
from public.customer_receipts r
join public.clients c on c.id = r.client_id
left join public.bank_clearings bc on bc.org_id = r.org_id and bc.doc_type = 'receipt' and bc.doc_id = r.id
where r.status = 'active' and r.mode <> 'cash'
union all
select p.org_id, 'supplier_payment', p.id, p.payment_no, p.payment_date, p.created_at,
       s.name, null, p.mode, p.reference,
       0, p.amount, bc.bank_date
from public.supplier_payments p
join public.suppliers s on s.id = p.supplier_id
left join public.bank_clearings bc on bc.org_id = p.org_id and bc.doc_type = 'supplier_payment' and bc.doc_id = p.id
where p.status = 'active' and p.mode <> 'cash'
union all
select e.org_id, 'expense', e.id, e.expense_no, e.expense_date, e.created_at,
       coalesce(nullif(e.payee, ''), h.name), h.name, e.mode, e.reference,
       0, e.amount, bc.bank_date
from public.expenses e
join public.expense_heads h on h.id = e.head_id
left join public.bank_clearings bc on bc.org_id = e.org_id and bc.doc_type = 'expense' and bc.doc_id = e.id
where e.status = 'active' and e.mode <> 'cash'
union all
select i.org_id, 'income', i.id, i.income_no, i.income_date, i.created_at,
       coalesce(nullif(i.received_from, ''), h.name), h.name, i.mode, i.reference,
       i.amount, 0, bc.bank_date
from public.other_income i
join public.income_heads h on h.id = i.head_id
left join public.bank_clearings bc on bc.org_id = i.org_id and bc.doc_type = 'income' and bc.doc_id = i.id
where i.status = 'active' and i.mode <> 'cash'
union all
select t.org_id, 'transfer', t.id, t.transfer_no, t.transfer_date, t.created_at,
       case t.direction when 'cash_to_bank' then 'Cash deposited in bank' else 'Cash drawn from bank' end, null, 'transfer', t.reference,
       case t.direction when 'cash_to_bank' then t.amount else 0 end,
       case t.direction when 'bank_to_cash' then t.amount else 0 end,
       bc.bank_date
from public.money_transfers t
left join public.bank_clearings bc on bc.org_id = t.org_id and bc.doc_type = 'transfer' and bc.doc_id = t.id
where t.status = 'active';

comment on view public.v_bank_entries is
  'Active receipts, supplier payments, expenses and other income not in cash, and cash/bank transfers, with the bank date if one is set. Reads with the caller''s rights.';

create or replace function public.set_bank_dates(p_entries jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org     uuid := public.my_org();
  e         record;
  v_date    date;
  v_status  text;
  v_mode    text;
  v_no      text;
  v_set     integer := 0;
  v_cleared integer := 0;
begin
  perform public.assert_my_role('admin', 'manager');
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    raise exception 'Choose at least one entry' using errcode = '22023';
  end if;
  if jsonb_array_length(p_entries) > 500 then
    raise exception 'Up to 500 entries at a time' using errcode = 'P0009';
  end if;

  for e in select * from jsonb_to_recordset(p_entries) as x(doc_type text, doc_id uuid, bank_date date) loop
    if e.doc_type is null or e.doc_type not in ('receipt', 'supplier_payment', 'expense', 'income', 'transfer') then
      raise exception 'Unknown entry type %', coalesce(e.doc_type, 'none') using errcode = '22023';
    end if;

    case e.doc_type
      when 'receipt' then
        select receipt_date, status, mode, receipt_no into v_date, v_status, v_mode, v_no
        from public.customer_receipts where id = e.doc_id and org_id = v_org;
      when 'supplier_payment' then
        select payment_date, status, mode, payment_no into v_date, v_status, v_mode, v_no
        from public.supplier_payments where id = e.doc_id and org_id = v_org;
      when 'expense' then
        select expense_date, status, mode, expense_no into v_date, v_status, v_mode, v_no
        from public.expenses where id = e.doc_id and org_id = v_org;
      when 'income' then
        select income_date, status, mode, income_no into v_date, v_status, v_mode, v_no
        from public.other_income where id = e.doc_id and org_id = v_org;
      else
        select transfer_date, status, 'transfer', transfer_no into v_date, v_status, v_mode, v_no
        from public.money_transfers where id = e.doc_id and org_id = v_org;
    end case;
    if not found then
      raise exception 'Entry not found' using errcode = 'P0002';
    end if;
    if v_status <> 'active' then
      raise exception '% is cancelled', v_no using errcode = 'P0008';
    end if;
    if v_mode is null or v_mode = 'cash' then
      raise exception '% was in cash, so it does not go through the bank', v_no using errcode = '22023';
    end if;

    if e.bank_date is null then
      delete from public.bank_clearings where org_id = v_org and doc_type = e.doc_type and doc_id = e.doc_id;
      v_cleared := v_cleared + 1;
      continue;
    end if;
    if e.bank_date < v_date then
      raise exception 'Bank date for % cannot be before its date (%)', v_no, to_char(v_date, 'DD Mon YYYY') using errcode = '22023';
    end if;
    if e.bank_date > current_date then
      raise exception 'Bank date for % cannot be in the future', v_no using errcode = '22023';
    end if;

    insert into public.bank_clearings (org_id, doc_type, doc_id, bank_date, updated_by)
    values (v_org, e.doc_type, e.doc_id, e.bank_date, auth.uid())
    on conflict (org_id, doc_type, doc_id)
    do update set bank_date = excluded.bank_date, updated_by = excluded.updated_by, updated_at = now()
    where bank_clearings.bank_date is distinct from excluded.bank_date;
    v_set := v_set + 1;
  end loop;

  return jsonb_build_object('set', v_set, 'cleared', v_cleared);
end;
$function$;

comment on function public.set_bank_dates(jsonb) is
  'Sets the bank date of bank-side entries, or clears it when bank_date is null: [{doc_type, doc_id, bank_date}], doc_type receipt | supplier_payment | expense | income | transfer. All or nothing, up to 500. Admin and manager.';

-- ── Cash and bank balances count other income ─────────────────
create or replace function public.money_balances(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'public'
as $function$
declare
  v_org    uuid := public.my_org();
  v_role   public.user_role := public.my_role();
  v_out    jsonb := '{}'::jsonb;
  v_acc    text;
  v_open   public.money_openings;
  v_start  numeric;
  v_end    numeric;
begin
  if v_role is null or v_role not in ('admin', 'manager', 'viewer') then
    raise exception 'Unauthorized: your role (%) cannot see cash and bank balances', coalesce(v_role::text, 'none')
      using errcode = 'P0005';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Choose a period that starts on or before the day it ends' using errcode = '22023';
  end if;

  foreach v_acc in array array['cash', 'bank'] loop
    select * into v_open from public.money_openings where org_id = v_org and account = v_acc;
    if not found then
      v_out := v_out || jsonb_build_object(v_acc, jsonb_build_object('set', false));
      continue;
    end if;

    -- Net money in for this account after the opening date, up to a day
    with flows as (
      select receipt_date as d, amount as amt from public.customer_receipts
      where org_id = v_org and status = 'active' and (mode = 'cash') = (v_acc = 'cash')
        and receipt_date > v_open.as_of and receipt_date <= p_to
      union all
      select payment_date, -amount from public.supplier_payments
      where org_id = v_org and status = 'active' and (mode = 'cash') = (v_acc = 'cash')
        and payment_date > v_open.as_of and payment_date <= p_to
      union all
      select expense_date, -amount from public.expenses
      where org_id = v_org and status = 'active' and (mode = 'cash') = (v_acc = 'cash')
        and expense_date > v_open.as_of and expense_date <= p_to
      union all
      select income_date, amount from public.other_income
      where org_id = v_org and status = 'active' and (mode = 'cash') = (v_acc = 'cash')
        and income_date > v_open.as_of and income_date <= p_to
      union all
      -- Cash drawn from the bank comes into cash; cash deposited goes into the bank
      select transfer_date, case when (direction = 'bank_to_cash') = (v_acc = 'cash') then amount else -amount end
      from public.money_transfers
      where org_id = v_org and status = 'active'
        and transfer_date > v_open.as_of and transfer_date <= p_to
    )
    select
      case when p_from - 1 >= v_open.as_of
           then v_open.amount + coalesce(sum(amt) filter (where d <= p_from - 1), 0) end,
      case when p_to >= v_open.as_of
           then v_open.amount + coalesce(sum(amt), 0) end
    into v_start, v_end
    from flows;

    v_out := v_out || jsonb_build_object(v_acc, jsonb_build_object(
      'set', true,
      'as_of', v_open.as_of,
      'opening_amount', v_open.amount,
      'start', v_start,
      'end', v_end));
  end loop;

  return v_out;
end;
$function$;

comment on function public.money_balances(date, date) is
  'Cash and bank balance at the start of a period (end of the day before p_from) and at the end of p_to, from the opening balance and the receipts, other income, supplier payments, expenses and cash/bank transfers recorded since. Null where the day is before the opening date. Admin, manager and viewer.';

-- ── Profit and loss adds other income below expenses ──────────
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

  select coalesce(jsonb_agg(jsonb_build_object('head', head, 'amount', amount, 'entries', entries)
                            order by amount desc, head), '[]'::jsonb),
         coalesce(sum(amount), 0)
  into v_inc, v_inc_tot
  from (
    select h.name as head, round(sum(i.amount), 2) as amount, count(*) as entries
    from public.other_income i
    join public.income_heads h on h.id = i.head_id
    where i.org_id = v_org and i.status = 'active' and i.income_date between p_from and p_to
    group by h.name
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

comment on function public.profit_and_loss(date, date) is
  'Profit and loss for a period: net sales (taxable), cost of goods sold as opening stock + goods received - returns to suppliers - closing stock at a running average cost per item, expenses and other income by head, gross and net profit. Admin, manager and viewer.';

do $$ begin
  execute 'revoke all on function public._seed_income_heads(uuid) from public, anon, authenticated';
  execute 'revoke all on function public._seed_income_heads_for_new_org() from public, anon, authenticated';
  execute 'revoke all on function public.save_income_head(text, uuid, boolean) from public, anon';
  execute 'revoke all on function public.record_other_income(uuid, numeric, text, date, text, text, text, uuid) from public, anon';
  execute 'revoke all on function public.cancel_other_income(uuid, text) from public, anon';
  execute 'revoke all on function public.set_bank_dates(jsonb) from public, anon';
  execute 'revoke all on function public.money_balances(date, date) from public, anon';
  execute 'revoke all on function public.profit_and_loss(date, date) from public, anon';
end $$;
grant execute on function public.save_income_head(text, uuid, boolean) to authenticated;
grant execute on function public.record_other_income(uuid, numeric, text, date, text, text, text, uuid) to authenticated;
grant execute on function public.cancel_other_income(uuid, text) to authenticated;
grant execute on function public.set_bank_dates(jsonb) to authenticated;
grant execute on function public.money_balances(date, date) to authenticated;
grant execute on function public.profit_and_loss(date, date) to authenticated;
