-- ─────────────────────────────────────────────────────────────
-- Fixed assets and depreciation.
--
-- fixed_assets            one row per asset: cost, purchase date, scrap
--                         (salvage) value and a method:
--                           slm  straight line over a useful life in years,
--                                by the day
--                           wdv  written-down value at a yearly rate, charged
--                                per financial year on the value at its start
--                                (pro rata by days in the year of purchase)
--                         numbered FA-<nnnn>; sold or scrapped assets keep
--                         their row; a mistaken one is cancelled
-- fixed_asset_value()     book value at the end of a day, worked out from
--                         those figures — no depreciation entries to keep
-- fixed_asset_register()  per asset over a period: opening value, additions,
--                         depreciation, value at disposal, closing value and
--                         the profit or loss on sale
--
-- An asset also counts in:
--   money_balances()     the purchase (if paid here) and the sale proceeds,
--                        by mode
--   v_bank_entries / set_bank_dates()   asset_purchase and asset_sale
--   profit_and_loss()    "Depreciation" and "Loss on sale of assets" as
--                        expenses, "Profit on sale of assets" as other income
--   financial_position() fixed assets at book value, owned
--
-- Read by admin, manager and viewer; written through the functions below
-- by admin and manager.
-- ─────────────────────────────────────────────────────────────

create table public.fixed_assets (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id),
  asset_no         text not null,
  name             text not null check (length(trim(name)) between 1 and 160),
  category         text,
  purchase_date    date not null,
  cost             numeric(14,2) not null check (cost > 0),
  salvage_value    numeric(14,2) not null default 0 check (salvage_value >= 0),
  method           text not null check (method in ('slm', 'wdv')),
  useful_life_years numeric(5,2) check (useful_life_years > 0 and useful_life_years <= 100),
  wdv_rate         numeric(5,2) check (wdv_rate > 0 and wdv_rate < 100),
  pay_mode         text not null check (pay_mode in ('cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other', 'none')),
  pay_reference    text,
  status           text not null default 'in_use' check (status in ('in_use', 'disposed', 'cancelled')),
  disposed_on      date,
  sale_amount      numeric(14,2) check (sale_amount >= 0),
  sale_mode        text check (sale_mode in ('cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other')),
  sale_reference   text,
  notes            text,
  cancel_reason    text,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint fixed_assets_org_no_key unique (org_id, asset_no),
  constraint fixed_assets_salvage_below_cost check (salvage_value < cost),
  constraint fixed_assets_method_params check (
    (method = 'slm' and useful_life_years is not null and wdv_rate is null)
    or (method = 'wdv' and wdv_rate is not null and useful_life_years is null)),
  constraint fixed_assets_disposal check (
    (status = 'disposed') = (disposed_on is not null)
    and (disposed_on is null or (disposed_on >= purchase_date and sale_amount is not null))
    and ((coalesce(sale_amount, 0) > 0) = (sale_mode is not null)))
);
create index fixed_assets_org_purchase_idx on public.fixed_assets (org_id, purchase_date);
create index fixed_assets_created_by_idx on public.fixed_assets (created_by);

comment on table public.fixed_assets is
  'Fixed assets with cost, purchase date, salvage value and depreciation method (slm by useful life, wdv by yearly rate). Written through save_fixed_asset(), dispose_fixed_asset(), undo_asset_disposal() and cancel_fixed_asset().';

create trigger trg_aud_fixed_assets after insert or update or delete on public.fixed_assets
  for each row execute function public.write_audit_log();

alter table public.fixed_assets enable row level security;
create policy "payables roles read fixed assets" on public.fixed_assets for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'viewer'));

do $$ begin
  execute 'revoke all on public.fixed_assets from anon';
  execute 'revoke insert, update, delete, truncate, references, trigger on public.fixed_assets from authenticated';
end $$;
grant select on public.fixed_assets to authenticated;

-- ── Book value on a day ───────────────────────────────────────
create function public.fixed_asset_value(
  p_cost numeric,
  p_salvage numeric,
  p_method text,
  p_life_years numeric,
  p_rate numeric,
  p_purchase date,
  p_day date
) returns numeric
language plpgsql
immutable
parallel safe
set search_path to 'public'
as $function$
declare
  v        numeric := p_cost;
  cur      date;
  fy_start date;
  fy_end   date;
  seg_end  date;
begin
  if p_day is null or p_purchase is null or p_day < p_purchase then
    return null;
  end if;
  if p_method = 'slm' then
    -- The purchase day counts as a day in use
    v := p_cost - (p_cost - p_salvage) * (p_day - p_purchase + 1) / (p_life_years * 365);
  else
    -- Year by year: the rate applies to the value at the start of each
    -- financial year, or at purchase in the first year, pro rata by days
    cur := p_purchase - 1;
    while cur < p_day and v > p_salvage loop
      fy_start := make_date(extract(year from cur + 1)::int - case when extract(month from cur + 1) < 4 then 1 else 0 end, 4, 1);
      fy_end := (fy_start + interval '1 year')::date - 1;
      seg_end := least(fy_end, p_day);
      v := v - v * p_rate / 100 * (seg_end - cur) / (fy_end - fy_start + 1);
      cur := seg_end;
    end loop;
  end if;
  return round(greatest(p_salvage, v), 2);
end;
$function$;

comment on function public.fixed_asset_value(numeric, numeric, text, numeric, numeric, date, date) is
  'Book value of an asset at the end of a day: straight line (slm) over the useful life by the day, or written-down value (wdv) at a yearly rate per financial year, pro rata by days; never below the salvage value. Null before the purchase date.';

-- ── The register for a period ─────────────────────────────────
create function public.fixed_asset_register(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'public'
as $function$
declare
  v_org  uuid := public.my_org();
  v_role public.user_role := public.my_role();
  v_out  jsonb;
begin
  if v_role is null or v_role not in ('admin', 'manager', 'viewer') then
    raise exception 'Unauthorized: your role (%) cannot see fixed assets', coalesce(v_role::text, 'none')
      using errcode = 'P0005';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Choose a period that starts on or before the day it ends' using errcode = '22023';
  end if;

  with a as (
    select f.*,
           case when f.purchase_date < p_from
                then public.fixed_asset_value(f.cost, f.salvage_value, f.method, f.useful_life_years, f.wdv_rate, f.purchase_date, p_from - 1)
                else 0 end as opening,
           case when f.purchase_date >= p_from then f.cost else 0 end as addition,
           case when f.status = 'disposed' and f.disposed_on <= p_to
                then public.fixed_asset_value(f.cost, f.salvage_value, f.method, f.useful_life_years, f.wdv_rate, f.purchase_date, f.disposed_on)
                else 0 end as disposal_value,
           case when f.status = 'disposed' and f.disposed_on <= p_to then 0
                else public.fixed_asset_value(f.cost, f.salvage_value, f.method, f.useful_life_years, f.wdv_rate, f.purchase_date, p_to) end as closing
    from public.fixed_assets f
    where f.org_id = v_org and f.status <> 'cancelled'
      and f.purchase_date <= p_to
      and (f.disposed_on is null or f.disposed_on >= p_from)
  ), r as (
    select a.*,
           opening + addition - disposal_value - closing as depreciation,
           case when status = 'disposed' and disposed_on <= p_to then sale_amount - disposal_value else 0 end as gain
    from a
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'assets', coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'asset_no', asset_no, 'name', name, 'category', category, 'method', method,
        'useful_life_years', useful_life_years, 'wdv_rate', wdv_rate,
        'purchase_date', purchase_date, 'cost', cost, 'salvage_value', salvage_value, 'status', status,
        'disposed_on', disposed_on, 'sale_amount', sale_amount,
        'opening', opening, 'addition', addition, 'depreciation', depreciation,
        'disposal_value', disposal_value, 'closing', closing, 'gain', gain)
      order by purchase_date, asset_no), '[]'::jsonb),
    'totals', jsonb_build_object(
      'opening', coalesce(sum(opening), 0),
      'additions', coalesce(sum(addition), 0),
      'depreciation', coalesce(sum(depreciation), 0),
      'disposals', coalesce(sum(disposal_value), 0),
      'closing', coalesce(sum(closing), 0),
      'gain', coalesce(sum(gain), 0),
      'in_use', count(*) filter (where not (status = 'disposed' and disposed_on <= p_to))))
  into v_out
  from r;
  return v_out;
end;
$function$;

comment on function public.fixed_asset_register(date, date) is
  'Fixed assets over a period, per asset: book value at the start, additions (cost of assets bought in it), depreciation, book value at disposal, book value at the end, and profit or loss on sale. Cancelled assets are left out. Admin, manager and viewer.';

-- ── Writing ───────────────────────────────────────────────────
create function public.save_fixed_asset(
  p_name text,
  p_purchase_date date,
  p_cost numeric,
  p_method text,
  p_useful_life_years numeric default null,
  p_wdv_rate numeric default null,
  p_salvage_value numeric default 0,
  p_pay_mode text default 'none',
  p_pay_reference text default null,
  p_category text default null,
  p_notes text default null,
  p_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org  uuid := public.my_org();
  v_name text := nullif(trim(p_name), '');
  v_a    public.fixed_assets;
  v_no   text;
  v_id   uuid;
begin
  perform public.assert_my_role('admin', 'manager');
  if v_name is null then
    raise exception 'Give the asset a name' using errcode = '22023';
  end if;
  if length(v_name) > 160 then
    raise exception 'The name can be at most 160 characters' using errcode = '22023';
  end if;
  if p_purchase_date is null then
    raise exception 'Choose the purchase date' using errcode = '22023';
  end if;
  if p_purchase_date > current_date then
    raise exception 'The purchase date cannot be in the future' using errcode = '22023';
  end if;
  if p_cost is null or p_cost <= 0 then
    raise exception 'Enter the cost' using errcode = '22023';
  end if;
  if p_salvage_value is null or p_salvage_value < 0 then
    raise exception 'The salvage value cannot be negative' using errcode = '22023';
  end if;
  if round(p_cost, 2) <> p_cost or round(p_salvage_value, 2) <> p_salvage_value then
    raise exception 'Amounts can have at most 2 decimals' using errcode = '22023';
  end if;
  if p_cost >= 1000000000000 then
    raise exception 'Amount is too large' using errcode = '22023';
  end if;
  if p_salvage_value >= p_cost then
    raise exception 'The salvage value must be less than the cost' using errcode = '22023';
  end if;
  if p_method is null or p_method not in ('slm', 'wdv') then
    raise exception 'Unknown depreciation method %', coalesce(p_method, 'none') using errcode = '22023';
  end if;
  if p_method = 'slm' and (p_useful_life_years is null or p_useful_life_years <= 0 or p_useful_life_years > 100
                           or round(p_useful_life_years, 2) <> p_useful_life_years) then
    raise exception 'Give a useful life of more than 0 and up to 100 years' using errcode = '22023';
  end if;
  if p_method = 'wdv' and (p_wdv_rate is null or p_wdv_rate <= 0 or p_wdv_rate >= 100
                           or round(p_wdv_rate, 2) <> p_wdv_rate) then
    raise exception 'Give a yearly rate of more than 0 and less than 100 percent' using errcode = '22023';
  end if;
  if p_pay_mode is null or p_pay_mode not in ('cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other', 'none') then
    raise exception 'Unknown payment mode %', coalesce(p_pay_mode, 'none') using errcode = '22023';
  end if;

  if p_id is null then
    v_no := 'FA-' || lpad(public.next_org_seq(v_org, 'fa')::text, 4, '0');
    insert into public.fixed_assets (org_id, asset_no, name, category, purchase_date, cost, salvage_value, method,
                                     useful_life_years, wdv_rate, pay_mode, pay_reference, notes, created_by)
    values (v_org, v_no, v_name, nullif(trim(p_category), ''), p_purchase_date, p_cost, p_salvage_value, p_method,
            case when p_method = 'slm' then p_useful_life_years end, case when p_method = 'wdv' then p_wdv_rate end,
            p_pay_mode, nullif(trim(p_pay_reference), ''), nullif(trim(p_notes), ''), auth.uid())
    returning id into v_id;
  else
    select * into v_a from public.fixed_assets where id = p_id and org_id = v_org for update;
    if not found then
      raise exception 'Asset not found' using errcode = 'P0002';
    end if;
    if v_a.status <> 'in_use' then
      raise exception '% is %; undo that first to change it', v_a.asset_no,
        case v_a.status when 'disposed' then 'sold or scrapped' else 'cancelled' end using errcode = 'P0008';
    end if;
    update public.fixed_assets
    set name = v_name, category = nullif(trim(p_category), ''), purchase_date = p_purchase_date, cost = p_cost,
        salvage_value = p_salvage_value, method = p_method,
        useful_life_years = case when p_method = 'slm' then p_useful_life_years end,
        wdv_rate = case when p_method = 'wdv' then p_wdv_rate end,
        pay_mode = p_pay_mode, pay_reference = nullif(trim(p_pay_reference), ''), notes = nullif(trim(p_notes), ''),
        updated_at = now()
    where id = p_id;
    v_id := p_id;
    v_no := v_a.asset_no;
  end if;
  return jsonb_build_object('id', v_id, 'asset_no', v_no);
end;
$function$;

comment on function public.save_fixed_asset(text, date, numeric, text, numeric, numeric, numeric, text, text, text, text, uuid) is
  'Adds a fixed asset (numbered FA-<nnnn>) or, with p_id, corrects one still in use. p_pay_mode none means it was not paid here (a supplier bill, or before the opening balances). Admin and manager.';

create function public.dispose_fixed_asset(
  p_id uuid,
  p_disposed_on date,
  p_sale_amount numeric default 0,
  p_sale_mode text default null,
  p_sale_reference text default null,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
  v_a   public.fixed_assets;
  v_bv  numeric;
begin
  perform public.assert_my_role('admin', 'manager');
  select * into v_a from public.fixed_assets where id = p_id and org_id = v_org for update;
  if not found then
    raise exception 'Asset not found' using errcode = 'P0002';
  end if;
  if v_a.status <> 'in_use' then
    raise exception '% is already %', v_a.asset_no,
      case v_a.status when 'disposed' then 'sold or scrapped' else 'cancelled' end using errcode = 'P0008';
  end if;
  if p_disposed_on is null then
    raise exception 'Choose the date it was sold or scrapped' using errcode = '22023';
  end if;
  if p_disposed_on > current_date then
    raise exception 'The date cannot be in the future' using errcode = '22023';
  end if;
  if p_disposed_on < v_a.purchase_date then
    raise exception 'The date cannot be before the purchase date (%)', to_char(v_a.purchase_date, 'DD Mon YYYY') using errcode = '22023';
  end if;
  if p_sale_amount is null or p_sale_amount < 0 or round(p_sale_amount, 2) <> p_sale_amount then
    raise exception 'Enter the amount received, nil or more, with at most 2 decimals' using errcode = '22023';
  end if;
  if p_sale_amount >= 1000000000000 then
    raise exception 'Amount is too large' using errcode = '22023';
  end if;
  if p_sale_amount > 0 and (p_sale_mode is null or p_sale_mode not in ('cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other')) then
    raise exception 'Choose how the sale money was received' using errcode = '22023';
  end if;

  update public.fixed_assets
  set status = 'disposed', disposed_on = p_disposed_on, sale_amount = p_sale_amount,
      sale_mode = case when p_sale_amount > 0 then p_sale_mode end,
      sale_reference = case when p_sale_amount > 0 then nullif(trim(p_sale_reference), '') end,
      notes = coalesce(nullif(trim(p_notes), ''), notes), updated_at = now()
  where id = p_id;
  v_bv := public.fixed_asset_value(v_a.cost, v_a.salvage_value, v_a.method, v_a.useful_life_years, v_a.wdv_rate, v_a.purchase_date, p_disposed_on);
  return jsonb_build_object('id', p_id, 'asset_no', v_a.asset_no, 'book_value', v_bv, 'gain', p_sale_amount - v_bv);
end;
$function$;

comment on function public.dispose_fixed_asset(uuid, date, numeric, text, text, text) is
  'Marks an asset sold (with the amount and how it was received) or scrapped (amount 0) on a day; returns its book value then and the profit (or loss, negative) on sale. Admin and manager.';

create function public.undo_asset_disposal(p_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
  v_a   public.fixed_assets;
begin
  perform public.assert_my_role('admin', 'manager');
  if nullif(trim(p_reason), '') is null then
    raise exception 'Give a reason' using errcode = '22023';
  end if;
  select * into v_a from public.fixed_assets where id = p_id and org_id = v_org for update;
  if not found then
    raise exception 'Asset not found' using errcode = 'P0002';
  end if;
  if v_a.status <> 'disposed' then
    raise exception '% is not sold or scrapped', v_a.asset_no using errcode = 'P0008';
  end if;
  update public.fixed_assets
  set status = 'in_use', disposed_on = null, sale_amount = null, sale_mode = null, sale_reference = null,
      notes = trim(concat_ws(E'\n', notes, 'Sale undone: ' || trim(p_reason))), updated_at = now()
  where id = p_id;
  return jsonb_build_object('id', p_id, 'asset_no', v_a.asset_no, 'status', 'in_use');
end;
$function$;

comment on function public.undo_asset_disposal(uuid, text) is
  'Puts a sold or scrapped asset back in use, removing the sale; the reason is added to its notes and the change is in the audit log. Admin and manager.';

create function public.cancel_fixed_asset(p_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
  v_a   public.fixed_assets;
begin
  perform public.assert_my_role('admin', 'manager');
  if nullif(trim(p_reason), '') is null then
    raise exception 'Give a reason for cancelling the asset' using errcode = '22023';
  end if;
  select * into v_a from public.fixed_assets where id = p_id and org_id = v_org for update;
  if not found then
    raise exception 'Asset not found' using errcode = 'P0002';
  end if;
  if v_a.status <> 'in_use' then
    raise exception '% is %', v_a.asset_no,
      case v_a.status when 'disposed' then 'sold or scrapped; undo that first' else 'already cancelled' end using errcode = 'P0008';
  end if;
  update public.fixed_assets set status = 'cancelled', cancel_reason = trim(p_reason), updated_at = now() where id = p_id;
  return jsonb_build_object('id', p_id, 'asset_no', v_a.asset_no, 'status', 'cancelled');
end;
$function$;

comment on function public.cancel_fixed_asset(uuid, text) is
  'Cancels an asset entered by mistake; it drops out of every report and the row is kept. Admin and manager.';

-- ── Bank reconciliation takes asset purchases and sales ───────
alter table public.bank_clearings drop constraint bank_clearings_doc_type_check;
alter table public.bank_clearings add constraint bank_clearings_doc_type_check
  check (doc_type in ('receipt', 'supplier_payment', 'expense', 'income', 'gst_payment', 'funding', 'asset_purchase', 'asset_sale', 'transfer'));
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
select g.org_id, 'gst_payment', g.id, g.payment_no, g.payment_date, g.created_at,
       'GST payment', case when g.period is not null then 'For ' || to_char(to_date(g.period || '-01', 'YYYY-MM-DD'), 'Mon YYYY') end,
       g.mode, g.reference,
       0, g.amount, bc.bank_date
from public.gst_payments g
left join public.bank_clearings bc on bc.org_id = g.org_id and bc.doc_type = 'gst_payment' and bc.doc_id = g.id
where g.status = 'active' and g.mode <> 'cash'
union all
select f.org_id, 'funding', f.id, f.entry_no, f.entry_date, f.created_at,
       a.name,
       case when a.kind = 'capital' then case f.direction when 'in' then 'Capital introduced' else 'Drawings' end
            else case f.direction when 'in' then 'Loan received' else 'Loan repayment' end end,
       f.mode, f.reference,
       case f.direction when 'in' then f.total else 0 end,
       case f.direction when 'out' then f.total else 0 end,
       bc.bank_date
from public.funding_entries f
join public.funding_accounts a on a.org_id = f.org_id and a.id = f.account_id
left join public.bank_clearings bc on bc.org_id = f.org_id and bc.doc_type = 'funding' and bc.doc_id = f.id
where f.status = 'active' and f.mode <> 'cash'
union all
select x.org_id, 'asset_purchase', x.id, x.asset_no, x.purchase_date, x.created_at,
       x.name, 'Asset bought', x.pay_mode, x.pay_reference,
       0, x.cost, bc.bank_date
from public.fixed_assets x
left join public.bank_clearings bc on bc.org_id = x.org_id and bc.doc_type = 'asset_purchase' and bc.doc_id = x.id
where x.status <> 'cancelled' and x.pay_mode not in ('cash', 'none')
union all
select x.org_id, 'asset_sale', x.id, x.asset_no, x.disposed_on, x.updated_at,
       x.name, 'Asset sold', x.sale_mode, x.sale_reference,
       x.sale_amount, 0, bc.bank_date
from public.fixed_assets x
left join public.bank_clearings bc on bc.org_id = x.org_id and bc.doc_type = 'asset_sale' and bc.doc_id = x.id
where x.status = 'disposed' and x.sale_amount > 0 and x.sale_mode <> 'cash'
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
  'Active receipts, supplier payments, expenses, other income, GST challans, capital and loan entries, asset purchases and sales not in cash, and cash/bank transfers, with the bank date if one is set. Reads with the caller''s rights.';

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
    if e.doc_type is null or e.doc_type not in ('receipt', 'supplier_payment', 'expense', 'income', 'gst_payment', 'funding', 'asset_purchase', 'asset_sale', 'transfer') then
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
      when 'gst_payment' then
        select payment_date, status, mode, payment_no into v_date, v_status, v_mode, v_no
        from public.gst_payments where id = e.doc_id and org_id = v_org;
      when 'funding' then
        select entry_date, status, mode, entry_no into v_date, v_status, v_mode, v_no
        from public.funding_entries where id = e.doc_id and org_id = v_org;
      when 'asset_purchase' then
        select purchase_date, case when status = 'cancelled' then 'cancelled' else 'active' end,
               nullif(pay_mode, 'none'), asset_no
        into v_date, v_status, v_mode, v_no
        from public.fixed_assets where id = e.doc_id and org_id = v_org;
      when 'asset_sale' then
        select disposed_on, case when status = 'disposed' then 'active' else 'cancelled' end,
               case when sale_amount > 0 then sale_mode end, asset_no || ' sale'
        into v_date, v_status, v_mode, v_no
        from public.fixed_assets where id = e.doc_id and org_id = v_org;
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
    if v_mode is null then
      raise exception '% was not paid or received here, so it does not go through the bank', v_no using errcode = '22023';
    end if;
    if v_mode = 'cash' then
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
  'Sets the bank date of bank-side entries, or clears it when bank_date is null: [{doc_type, doc_id, bank_date}], doc_type receipt | supplier_payment | expense | income | gst_payment | funding | asset_purchase | asset_sale | transfer. All or nothing, up to 500. Admin and manager.';

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
      select payment_date, -amount from public.gst_payments
      where org_id = v_org and status = 'active' and (mode = 'cash') = (v_acc = 'cash')
        and payment_date > v_open.as_of and payment_date <= p_to
      union all
      -- Capital introduced and loans received come in; drawings and repayments go out
      select entry_date, case direction when 'in' then total else -total end from public.funding_entries
      where org_id = v_org and status = 'active' and (mode = 'cash') = (v_acc = 'cash')
        and entry_date > v_open.as_of and entry_date <= p_to
      union all
      -- Assets paid for here go out on the purchase date; sale money comes in
      select purchase_date, -cost from public.fixed_assets
      where org_id = v_org and status <> 'cancelled' and pay_mode <> 'none' and (pay_mode = 'cash') = (v_acc = 'cash')
        and purchase_date > v_open.as_of and purchase_date <= p_to
      union all
      select disposed_on, sale_amount from public.fixed_assets
      where org_id = v_org and status = 'disposed' and sale_amount > 0 and (sale_mode = 'cash') = (v_acc = 'cash')
        and disposed_on > v_open.as_of and disposed_on <= p_to
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
  'Cash and bank balance at the start of a period (end of the day before p_from) and at the end of p_to, from the opening balance and the receipts, other income, supplier payments, expenses, GST challans, capital and loan entries, fixed assets bought and sold, and cash/bank transfers recorded since. Null where the day is before the opening date. Admin, manager and viewer.';

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
      select h.name as head, e.amount
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

comment on function public.profit_and_loss(date, date) is
  'Profit and loss for a period: net sales (taxable), cost of goods sold as opening stock + goods received - returns to suppliers - closing stock at a running average cost per item, expenses (including GST interest and late fee, interest on loans, depreciation and losses on assets sold) and other income by head (including profit on assets sold), gross and net profit. Admin, manager and viewer.';

create or replace function public.financial_position(p_as_of date)
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'public'
as $function$
declare
  v_org     uuid := public.my_org();
  v_role    public.user_role := public.my_role();
  v_money   jsonb;
  v_pl      jsonb;
  v_cash    numeric;
  v_bank    numeric;
  v_recv    numeric;
  v_recv_n  integer;
  v_cadv    numeric;
  v_cadv_n  integer;
  v_pay     numeric;
  v_pay_n   integer;
  v_sadv    numeric;
  v_sadv_n  integer;
  v_stock   numeric;
  v_assets  numeric;
  v_owed    numeric;
  v_gst     jsonb;
  v_gst_bal numeric;
  v_fund    jsonb;
  v_loans   numeric;
  v_fa      jsonb;
  v_fa_val  numeric;
begin
  if v_role is null or v_role not in ('admin', 'manager', 'viewer') then
    raise exception 'Unauthorized: your role (%) cannot see the financial position', coalesce(v_role::text, 'none')
      using errcode = 'P0005';
  end if;
  if p_as_of is null then
    raise exception 'Choose the day' using errcode = '22023';
  end if;

  -- Cash and bank: null when no opening balance is set, or the day is before it
  v_money := public.money_balances(p_as_of, p_as_of);
  v_cash := (v_money -> 'cash' ->> 'end')::numeric;
  v_bank := (v_money -> 'bank' ->> 'end')::numeric;

  -- Customers: invoices less receipts and credit notes, per customer
  select coalesce(sum(bal) filter (where bal >= 0.005), 0), count(*) filter (where bal >= 0.005),
         coalesce(-sum(bal) filter (where bal <= -0.005), 0), count(*) filter (where bal <= -0.005)
  into v_recv, v_recv_n, v_cadv, v_cadv_n
  from (
    select client_id, sum(amt) as bal
    from (
      select client_id, total_amount as amt from public.sales_invoices
      where org_id = v_org and status = 'issued' and invoice_date <= p_as_of
      union all
      select client_id, -amount from public.customer_receipts
      where org_id = v_org and status = 'active' and receipt_date <= p_as_of
      union all
      select client_id, -total_amount from public.credit_notes
      where org_id = v_org and status = 'issued' and note_date <= p_as_of
    ) x
    group by client_id
  ) c;

  -- Suppliers: bills less payments and debit notes, per supplier
  select coalesce(sum(bal) filter (where bal >= 0.005), 0), count(*) filter (where bal >= 0.005),
         coalesce(-sum(bal) filter (where bal <= -0.005), 0), count(*) filter (where bal <= -0.005)
  into v_pay, v_pay_n, v_sadv, v_sadv_n
  from (
    select supplier_id, sum(amt) as bal
    from (
      select supplier_id, total_amount as amt from public.supplier_bills
      where org_id = v_org and status = 'posted' and bill_date <= p_as_of
      union all
      select supplier_id, -amount from public.supplier_payments
      where org_id = v_org and status = 'active' and payment_date <= p_as_of
      union all
      select supplier_id, -total_amount from public.debit_notes
      where org_id = v_org and status = 'issued' and note_date <= p_as_of
    ) x
    group by supplier_id
  ) s;

  -- Stock at the end of the day, valued as in the profit and loss
  v_pl := public.profit_and_loss(p_as_of, p_as_of);
  v_stock := (v_pl -> 'stock' ->> 'closing')::numeric;

  -- GST: payable when tax due exceeds credit and payments, otherwise credit in hand.
  -- Left out (null) until a GST opening position is set on or before the day.
  v_gst := public.gst_ledger(p_as_of);
  v_gst_bal := case when (v_gst ->> 'set')::boolean then (v_gst ->> 'balance')::numeric end;

  -- Loans still owed; capital accounts are reported, not counted as owed
  v_fund := public.funding_balances(p_as_of);
  v_loans := (v_fund -> 'loans' ->> 'amount')::numeric;

  -- Fixed assets at book value at the end of the day
  v_fa := public.fixed_asset_register(p_as_of, p_as_of);
  v_fa_val := (v_fa -> 'totals' ->> 'closing')::numeric;

  v_assets := coalesce(v_cash, 0) + coalesce(v_bank, 0) + v_recv + v_sadv + v_stock + greatest(-coalesce(v_gst_bal, 0), 0) + v_fa_val;
  v_owed := v_pay + v_cadv + greatest(coalesce(v_gst_bal, 0), 0) + v_loans;

  return jsonb_build_object(
    'as_of', p_as_of,
    'cash', jsonb_build_object('set', v_cash is not null, 'amount', round(v_cash, 2), 'opening_as_of', v_money -> 'cash' -> 'as_of'),
    'bank', jsonb_build_object('set', v_bank is not null, 'amount', round(v_bank, 2), 'opening_as_of', v_money -> 'bank' -> 'as_of'),
    'receivables', jsonb_build_object('amount', round(v_recv, 2), 'parties', v_recv_n),
    'supplier_advances', jsonb_build_object('amount', round(v_sadv, 2), 'parties', v_sadv_n),
    'stock', jsonb_build_object(
      'amount', round(v_stock, 2),
      'items_without_cost', (v_pl -> 'stock' ->> 'items_without_cost')::integer,
      'items_on_price_list', (v_pl -> 'stock' ->> 'items_on_price_list')::integer,
      'items_on_bom', (v_pl -> 'stock' ->> 'items_on_bom')::integer),
    'payables', jsonb_build_object('amount', round(v_pay, 2), 'parties', v_pay_n),
    'customer_advances', jsonb_build_object('amount', round(v_cadv, 2), 'parties', v_cadv_n),
    'gst', jsonb_build_object('set', v_gst_bal is not null, 'balance', round(v_gst_bal, 2), 'opening_as_of', v_gst -> 'opening_as_of'),
    'loans', v_fund -> 'loans',
    'capital', v_fund -> 'capital',
    'fixed_assets', jsonb_build_object('amount', round(v_fa_val, 2), 'assets', (v_fa -> 'totals' ->> 'in_use')::integer),
    'total_owned', round(v_assets, 2),
    'total_owed', round(v_owed, 2),
    'net_worth', round(v_assets - v_owed, 2)
  );
end;
$function$;

comment on function public.financial_position(date) is
  'What the business owns (cash, bank, money owed by customers, advances paid to suppliers, stock at running average cost, GST credit, fixed assets at book value) and owes (money owed to suppliers, advances from customers, GST payable, loans) with the capital accounts alongside at the end of a day, from what is recorded in the app. Cash, bank and GST are null until their opening position is set. Admin, manager and viewer.';

do $$ begin
  execute 'revoke all on function public.fixed_asset_value(numeric, numeric, text, numeric, numeric, date, date) from public, anon';
  execute 'revoke all on function public.fixed_asset_register(date, date) from public, anon';
  execute 'revoke all on function public.save_fixed_asset(text, date, numeric, text, numeric, numeric, numeric, text, text, text, text, uuid) from public, anon';
  execute 'revoke all on function public.dispose_fixed_asset(uuid, date, numeric, text, text, text) from public, anon';
  execute 'revoke all on function public.undo_asset_disposal(uuid, text) from public, anon';
  execute 'revoke all on function public.cancel_fixed_asset(uuid, text) from public, anon';
  execute 'revoke all on function public.set_bank_dates(jsonb) from public, anon';
  execute 'revoke all on function public.money_balances(date, date) from public, anon';
  execute 'revoke all on function public.profit_and_loss(date, date) from public, anon';
  execute 'revoke all on function public.financial_position(date) from public, anon';
end $$;
grant execute on function public.fixed_asset_value(numeric, numeric, text, numeric, numeric, date, date) to authenticated;
grant execute on function public.fixed_asset_register(date, date) to authenticated;
grant execute on function public.save_fixed_asset(text, date, numeric, text, numeric, numeric, numeric, text, text, text, text, uuid) to authenticated;
grant execute on function public.dispose_fixed_asset(uuid, date, numeric, text, text, text) to authenticated;
grant execute on function public.undo_asset_disposal(uuid, text) to authenticated;
grant execute on function public.cancel_fixed_asset(uuid, text) to authenticated;
grant execute on function public.set_bank_dates(jsonb) to authenticated;
grant execute on function public.money_balances(date, date) to authenticated;
grant execute on function public.profit_and_loss(date, date) to authenticated;
grant execute on function public.financial_position(date) to authenticated;
