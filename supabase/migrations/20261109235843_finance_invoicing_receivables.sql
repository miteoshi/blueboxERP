-- ─────────────────────────────────────────────────────────────
-- Finance: GST tax invoices, customer receipts, receivables
--
--  • gst_states            GST state / UT codes (place of supply)
--  • is_valid_gstin()      format + check-digit validation
--  • tax identity          GSTIN / state code / bank details on the
--                          organization; state code on clients/suppliers
--  • GST 2.0 rates         40 % (and 3 % / 0.25 %) added to gst_rate
--  • sales_invoices        CGST Rule 46 tax invoices raised from delivery
--                          challans, financial-year numbering, CGST+SGST
--                          vs IGST from the place of supply
--  • customer_receipts     payments with allocation to invoices; an
--                          SO-linked receipt is an advance that is applied
--                          automatically when that SO is invoiced
--  • receivables views     ageing per invoice and per client
--  • GST report functions  HSN summary for a period
--  • credit control        sales users can't confirm an order that takes
--                          a client over its credit limit
--
-- All writes go through SECURITY DEFINER RPCs; the new tables have
-- read-only RLS for signed-in users.
-- ─────────────────────────────────────────────────────────────

-- ── 1. GST state codes ───────────────────────────────────────

create table if not exists public.gst_states (
  code       text primary key check (code ~ '^[0-9]{2}$'),
  name       text not null,
  alpha_code text not null,
  is_ut      boolean not null default false
);

insert into public.gst_states (code, name, alpha_code, is_ut) values
  ('01', 'Jammu and Kashmir', 'JK', true),
  ('02', 'Himachal Pradesh', 'HP', false),
  ('03', 'Punjab', 'PB', false),
  ('04', 'Chandigarh', 'CH', true),
  ('05', 'Uttarakhand', 'UK', false),
  ('06', 'Haryana', 'HR', false),
  ('07', 'Delhi', 'DL', true),
  ('08', 'Rajasthan', 'RJ', false),
  ('09', 'Uttar Pradesh', 'UP', false),
  ('10', 'Bihar', 'BR', false),
  ('11', 'Sikkim', 'SK', false),
  ('12', 'Arunachal Pradesh', 'AR', false),
  ('13', 'Nagaland', 'NL', false),
  ('14', 'Manipur', 'MN', false),
  ('15', 'Mizoram', 'MZ', false),
  ('16', 'Tripura', 'TR', false),
  ('17', 'Meghalaya', 'ML', false),
  ('18', 'Assam', 'AS', false),
  ('19', 'West Bengal', 'WB', false),
  ('20', 'Jharkhand', 'JH', false),
  ('21', 'Odisha', 'OD', false),
  ('22', 'Chhattisgarh', 'CG', false),
  ('23', 'Madhya Pradesh', 'MP', false),
  ('24', 'Gujarat', 'GJ', false),
  ('26', 'Dadra and Nagar Haveli and Daman and Diu', 'DN', true),
  ('27', 'Maharashtra', 'MH', false),
  ('29', 'Karnataka', 'KA', false),
  ('30', 'Goa', 'GA', false),
  ('31', 'Lakshadweep', 'LD', true),
  ('32', 'Kerala', 'KL', false),
  ('33', 'Tamil Nadu', 'TN', false),
  ('34', 'Puducherry', 'PY', true),
  ('35', 'Andaman and Nicobar Islands', 'AN', true),
  ('36', 'Telangana', 'TS', false),
  ('37', 'Andhra Pradesh', 'AP', false),
  ('38', 'Ladakh', 'LA', true),
  ('96', 'Other Countries', 'OC', false),
  ('97', 'Other Territory', 'OT', true)
on conflict (code) do update
  set name = excluded.name, alpha_code = excluded.alpha_code, is_ut = excluded.is_ut;

alter table public.gst_states enable row level security;
create policy "signed-in users read gst states" on public.gst_states
  for select to authenticated using (true);

-- ── 2. GSTIN validation ──────────────────────────────────────
-- 15 characters: 2-digit state code, 10-character PAN, entity number,
-- one more character (normally Z) and a mod-36 check character.

create or replace function public.is_valid_gstin(p_gstin text)
returns boolean
language plpgsql
immutable
set search_path to 'public'
as $function$
declare
  c constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  s int := 0;
  v int;
  p int;
begin
  if p_gstin is null or p_gstin !~ '^[0-9]{2}[A-Z0-9]{13}$' then
    return false;
  end if;
  for i in 1..14 loop
    v := position(substr(p_gstin, i, 1) in c) - 1;
    p := v * (case when i % 2 = 0 then 2 else 1 end);
    s := s + (p / 36) + (p % 36);
  end loop;
  return substr(c, ((36 - (s % 36)) % 36) + 1, 1) = substr(p_gstin, 15, 1);
end;
$function$;

-- ── 3. Tax identity on organization / clients / suppliers ────

alter table public.organizations
  add column if not exists state_code text references public.gst_states(code),
  add column if not exists pan text,
  add column if not exists invoice_prefix text not null default 'INV',
  add column if not exists invoice_terms text,
  add column if not exists bank_name text,
  add column if not exists bank_account_no text,
  add column if not exists bank_ifsc text,
  add column if not exists bank_branch text;

alter table public.clients
  add column if not exists state_code text references public.gst_states(code),
  add column if not exists pincode text;

alter table public.suppliers
  add column if not exists state_code text references public.gst_states(code);

-- Normalise GSTIN / PAN / IFSC and keep the state code in step with the
-- GSTIN (its first two digits are the registration state).
create or replace function public.normalize_tax_identity()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.gst_number := nullif(upper(regexp_replace(coalesce(new.gst_number, ''), '\s', '', 'g')), '');
  if new.gst_number is not null then
    if not public.is_valid_gstin(new.gst_number) then
      raise exception 'Invalid GSTIN %: check the 15 characters', new.gst_number
        using errcode = '22023';
    end if;
    new.state_code := left(new.gst_number, 2);
  end if;

  if tg_table_name = 'organizations' then
    new.pan := nullif(upper(regexp_replace(coalesce(new.pan, ''), '\s', '', 'g')), '');
    if new.pan is not null and new.pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then
      raise exception 'Invalid PAN %', new.pan using errcode = '22023';
    end if;
    if new.gst_number is not null and new.pan is null then
      new.pan := substr(new.gst_number, 3, 10);
    end if;
    new.bank_ifsc := nullif(upper(regexp_replace(coalesce(new.bank_ifsc, ''), '\s', '', 'g')), '');
    if new.bank_ifsc is not null and new.bank_ifsc !~ '^[A-Z]{4}0[A-Z0-9]{6}$' then
      raise exception 'Invalid IFSC %', new.bank_ifsc using errcode = '22023';
    end if;
    new.invoice_prefix := upper(coalesce(nullif(trim(new.invoice_prefix), ''), 'INV'));
    if new.invoice_prefix !~ '^[A-Z0-9]{1,4}$' then
      raise exception 'Invoice prefix must be 1-4 letters or digits' using errcode = '22023';
    end if;
  end if;

  return new;
end;
$function$;

revoke execute on function public.normalize_tax_identity() from public, anon, authenticated;

create trigger trg_normalize_tax_identity before insert or update on public.organizations
  for each row execute function public.normalize_tax_identity();
create trigger trg_normalize_tax_identity before insert or update on public.clients
  for each row execute function public.normalize_tax_identity();
create trigger trg_normalize_tax_identity before insert or update on public.suppliers
  for each row execute function public.normalize_tax_identity();

-- Backfill state codes from the free-text state name where it matches
update public.clients c set state_code = s.code
from public.gst_states s
where c.state_code is null and lower(trim(c.state)) = lower(s.name);

update public.suppliers c set state_code = s.code
from public.gst_states s
where c.state_code is null and lower(trim(c.state)) = lower(s.name);

update public.organizations c set state_code = s.code
from public.gst_states s
where c.state_code is null and lower(trim(c.state)) = lower(s.name);

-- ── 4. GST 2.0 rates ─────────────────────────────────────────
-- From 22 Sep 2025 the main slabs are 0 / 5 / 18 / 40 %, plus special
-- rates of 3 % and 0.25 %. 12 % and 28 % stay for older documents.
alter type public.gst_rate add value if not exists '40';
alter type public.gst_rate add value if not exists '3';
alter type public.gst_rate add value if not exists '0.25';

-- ── 5. Helpers ───────────────────────────────────────────────

-- Indian financial year label for a date, e.g. 2026-11-09 → '26-27'
create or replace function public.financial_year(p_date date)
returns text
language sql
immutable
as $function$
  select lpad((y % 100)::text, 2, '0') || '-' || lpad(((y + 1) % 100)::text, 2, '0')
  from (
    select case when extract(month from p_date) >= 4
                then extract(year from p_date)::int
                else extract(year from p_date)::int - 1 end as y
  ) fy
$function$;

-- ── 6. Sales invoices ────────────────────────────────────────

create table if not exists public.sales_invoices (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id),
  invoice_no          text not null check (length(invoice_no) <= 16),
  invoice_date        date not null,
  financial_year      text not null,
  so_id               uuid references public.sales_orders(id),
  client_id           uuid not null references public.clients(id),
  status              text not null default 'issued' check (status in ('issued', 'cancelled')),

  -- Party snapshot: an issued invoice must not change when masters change
  supplier_name       text not null,
  supplier_gstin      text not null,
  supplier_address    text,
  supplier_state_code text not null references public.gst_states(code),
  buyer_name          text not null,
  buyer_gstin         text,
  buyer_address       text,
  buyer_state_code    text references public.gst_states(code),
  place_of_supply     text not null references public.gst_states(code),
  is_interstate       boolean not null,
  reverse_charge      boolean not null default false,

  taxable_value       numeric(14,2) not null,
  cgst_amount         numeric(14,2) not null default 0,
  sgst_amount         numeric(14,2) not null default 0,
  igst_amount         numeric(14,2) not null default 0,
  round_off           numeric(8,2)  not null default 0,
  total_amount        numeric(14,2) not null,
  amount_paid         numeric(14,2) not null default 0 check (amount_paid >= 0),
  amount_credited     numeric(14,2) not null default 0 check (amount_credited >= 0),
  balance_due         numeric(14,2) generated always as (total_amount - amount_paid - amount_credited) stored,
  due_date            date not null,

  notes               text,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now(),
  cancelled_by        uuid references public.profiles(id),
  cancelled_at        timestamptz,
  cancel_reason       text,

  constraint sales_invoices_org_invoice_no_key unique (org_id, invoice_no),
  constraint sales_invoices_paid_le_total check (amount_paid + amount_credited <= total_amount)
);

create index if not exists sales_invoices_org_date_idx on public.sales_invoices (org_id, invoice_date desc);
create index if not exists sales_invoices_client_idx on public.sales_invoices (client_id);
create index if not exists sales_invoices_so_idx on public.sales_invoices (so_id);

create table if not exists public.sales_invoice_lines (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id),
  invoice_id      uuid not null references public.sales_invoices(id) on delete cascade,
  sort_order      integer not null,
  challan_id      uuid references public.delivery_challans(id),
  challan_line_id uuid references public.delivery_challan_lines(id),
  so_line_id      uuid references public.sales_order_lines(id),
  item_id         uuid not null references public.items(id),
  description     text not null,
  hsn_code        text,
  qty             numeric(14,4) not null check (qty > 0),
  unit_id         uuid references public.units(id),
  unit_name       text,
  rate            numeric(14,4) not null check (rate >= 0),
  taxable_value   numeric(14,2) not null,
  gst_rate        numeric(5,2)  not null check (gst_rate >= 0),
  cgst_amount     numeric(14,2) not null default 0,
  sgst_amount     numeric(14,2) not null default 0,
  igst_amount     numeric(14,2) not null default 0,
  line_total      numeric(14,2) not null
);

create index if not exists sales_invoice_lines_invoice_idx on public.sales_invoice_lines (invoice_id);

alter table public.delivery_challans
  add column if not exists invoice_id uuid references public.sales_invoices(id);
create index if not exists delivery_challans_invoice_idx on public.delivery_challans (invoice_id);

-- ── 7. Customer receipts ─────────────────────────────────────

create table if not exists public.customer_receipts (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id),
  receipt_no        text not null,
  receipt_date      date not null,
  financial_year    text not null,
  client_id         uuid not null references public.clients(id),
  so_id             uuid references public.sales_orders(id),
  amount            numeric(14,2) not null check (amount > 0),
  amount_allocated  numeric(14,2) not null default 0,
  mode              text not null check (mode in ('cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other')),
  reference         text,
  notes             text,
  status            text not null default 'active' check (status in ('active', 'cancelled')),
  created_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  cancelled_by      uuid references public.profiles(id),
  cancelled_at      timestamptz,
  cancel_reason     text,
  constraint customer_receipts_org_receipt_no_key unique (org_id, receipt_no),
  constraint customer_receipts_allocated_range check (amount_allocated >= 0 and amount_allocated <= amount)
);

create index if not exists customer_receipts_client_idx on public.customer_receipts (client_id);
create index if not exists customer_receipts_so_idx on public.customer_receipts (so_id);

create table if not exists public.receipt_allocations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id),
  receipt_id  uuid not null references public.customer_receipts(id) on delete cascade,
  invoice_id  uuid not null references public.sales_invoices(id),
  amount      numeric(14,2) not null check (amount > 0),
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  constraint receipt_allocations_receipt_invoice_key unique (receipt_id, invoice_id)
);

create index if not exists receipt_allocations_invoice_idx on public.receipt_allocations (invoice_id);

-- ── 8. RLS: read-only for the finance roles, writes via RPCs ─

alter table public.sales_invoices enable row level security;
alter table public.sales_invoice_lines enable row level security;
alter table public.customer_receipts enable row level security;
alter table public.receipt_allocations enable row level security;

create policy "finance roles read invoices" on public.sales_invoices for select to authenticated
  using (org_id = public.my_org() and public.my_role() in ('admin', 'manager', 'sales', 'store', 'viewer'));
create policy "finance roles read invoice lines" on public.sales_invoice_lines for select to authenticated
  using (org_id = public.my_org() and public.my_role() in ('admin', 'manager', 'sales', 'store', 'viewer'));
create policy "finance roles read receipts" on public.customer_receipts for select to authenticated
  using (org_id = public.my_org() and public.my_role() in ('admin', 'manager', 'sales', 'viewer'));
create policy "finance roles read allocations" on public.receipt_allocations for select to authenticated
  using (org_id = public.my_org() and public.my_role() in ('admin', 'manager', 'sales', 'viewer'));

revoke all on public.sales_invoices, public.sales_invoice_lines, public.customer_receipts,
  public.receipt_allocations, public.gst_states from anon;
revoke insert, update, delete, truncate on public.sales_invoices, public.sales_invoice_lines,
  public.customer_receipts, public.receipt_allocations, public.gst_states from authenticated;

create trigger trg_aud_sales_invoices after insert or update or delete on public.sales_invoices
  for each row execute function public.write_audit_log();
create trigger trg_aud_customer_receipts after insert or update or delete on public.customer_receipts
  for each row execute function public.write_audit_log();

-- ── 9. Internal recalculation helpers ────────────────────────

create or replace function public._recalc_invoice_paid(p_invoice_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update public.sales_invoices i
  set amount_paid = coalesce((
    select sum(a.amount)
    from public.receipt_allocations a
    join public.customer_receipts r on r.id = a.receipt_id and r.status = 'active'
    where a.invoice_id = i.id
  ), 0)
  where i.id = p_invoice_id;
$function$;

create or replace function public._recalc_receipt_allocated(p_receipt_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update public.customer_receipts r
  set amount_allocated = coalesce((
    select sum(a.amount) from public.receipt_allocations a where a.receipt_id = r.id
  ), 0)
  where r.id = p_receipt_id;
$function$;

-- Sales order "advance paid" = active receipts recorded against the SO
create or replace function public._recalc_so_advance(p_so_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update public.sales_orders s
  set advance_paid = x.paid,
      balance_due  = s.total_amount - x.paid
  from (
    select coalesce(sum(amount), 0) as paid
    from public.customer_receipts
    where so_id = p_so_id and status = 'active'
  ) x
  where s.id = p_so_id;
$function$;

-- Apply a receipt's unallocated amount to open invoices, oldest due first.
-- p_so_id limits it to invoices of one sales order, p_invoice_id to one invoice.
create or replace function public._allocate_receipt_fifo(
  p_receipt_id uuid,
  p_so_id      uuid default null,
  p_invoice_id uuid default null
)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_rcpt  public.customer_receipts;
  v_left  numeric;
  v_inv   record;
  v_take  numeric;
  v_total numeric := 0;
begin
  select * into v_rcpt from public.customer_receipts where id = p_receipt_id for update;
  if not found or v_rcpt.status <> 'active' then
    return 0;
  end if;
  v_left := v_rcpt.amount - v_rcpt.amount_allocated;

  for v_inv in
    select id, balance_due
    from public.sales_invoices
    where org_id = v_rcpt.org_id
      and client_id = v_rcpt.client_id
      and status = 'issued'
      and balance_due > 0
      and (p_so_id is null or so_id = p_so_id)
      and (p_invoice_id is null or id = p_invoice_id)
    order by due_date, invoice_date, invoice_no
    for update
  loop
    exit when v_left <= 0;
    v_take := least(v_left, v_inv.balance_due);
    insert into public.receipt_allocations (org_id, receipt_id, invoice_id, amount, created_by)
    values (v_rcpt.org_id, p_receipt_id, v_inv.id, v_take, auth.uid())
    on conflict (receipt_id, invoice_id)
      do update set amount = public.receipt_allocations.amount + excluded.amount;
    perform public._recalc_invoice_paid(v_inv.id);
    v_left := v_left - v_take;
    v_total := v_total + v_take;
  end loop;

  perform public._recalc_receipt_allocated(p_receipt_id);
  return v_total;
end;
$function$;

revoke execute on function public._recalc_invoice_paid(uuid) from public, anon, authenticated;
revoke execute on function public._recalc_receipt_allocated(uuid) from public, anon, authenticated;
revoke execute on function public._recalc_so_advance(uuid) from public, anon, authenticated;
revoke execute on function public._allocate_receipt_fifo(uuid, uuid, uuid) from public, anon, authenticated;

-- ── 10. create_sales_invoice ─────────────────────────────────

create or replace function public.create_sales_invoice(
  p_challan_ids    uuid[],
  p_invoice_date   date default null,
  p_notes          text default null,
  p_reverse_charge boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org         uuid := public.my_org();
  v_user        uuid := auth.uid();
  v_date        date := coalesce(p_invoice_date, current_date);
  v_fy          text;
  v_orgrow      public.organizations;
  v_client      public.clients;
  v_client_id   uuid;
  v_so_ids      uuid[];
  v_pos         text;
  v_inter       boolean;
  v_last_date   date;
  v_no          text;
  v_inv_id      uuid;
  v_count       int;
  v_missing_hsn text;
  v_taxable     numeric;
  v_cgst        numeric;
  v_sgst        numeric;
  v_igst        numeric;
  v_sum         numeric;
  v_total       numeric;
  v_rcpt        record;
  v_applied     numeric := 0;
begin
  perform public.assert_my_role('admin', 'manager', 'sales');

  if p_challan_ids is null or cardinality(p_challan_ids) = 0 then
    raise exception 'Select at least one delivery challan' using errcode = '22023';
  end if;
  if v_date > current_date then
    raise exception 'Invoice date cannot be in the future' using errcode = '22023';
  end if;

  -- Seller tax identity
  select * into v_orgrow from public.organizations where id = v_org;
  if v_orgrow.gst_number is null or v_orgrow.state_code is null then
    raise exception 'Add your company GSTIN in Settings → Company before issuing tax invoices'
      using errcode = 'P0010';
  end if;

  -- Challans: same org, same client, delivered/dispatched, not yet invoiced
  perform 1 from public.delivery_challans
  where id = any(p_challan_ids) and org_id = v_org
  for update;

  select count(*), min(client_id::text)::uuid, count(distinct client_id)
    into v_count, v_client_id, v_sum
  from public.delivery_challans
  where id = any(p_challan_ids) and org_id = v_org;

  if v_count <> cardinality(array(select distinct unnest(p_challan_ids))) then
    raise exception 'One or more challans were not found' using errcode = 'P0002';
  end if;
  if v_sum > 1 then
    raise exception 'All challans on one invoice must be for the same client' using errcode = '22023';
  end if;
  if exists (select 1 from public.delivery_challans
             where id = any(p_challan_ids) and invoice_id is not null) then
    raise exception 'One or more challans are already invoiced' using errcode = 'P0008';
  end if;
  if exists (select 1 from public.delivery_challans
             where id = any(p_challan_ids) and status not in ('dispatched', 'delivered')) then
    raise exception 'Only dispatched or delivered challans can be invoiced' using errcode = 'P0008';
  end if;

  select array_agg(distinct so_id) filter (where so_id is not null) into v_so_ids
  from public.delivery_challans where id = any(p_challan_ids);

  -- Buyer and place of supply
  select * into v_client from public.clients where id = v_client_id and org_id = v_org;
  v_pos := coalesce(v_client.state_code, left(v_client.gst_number, 2));
  if v_pos is null then
    raise exception 'Set the state for client % (Clients → Edit) — it decides CGST/SGST or IGST', v_client.name
      using errcode = 'P0010';
  end if;
  v_inter := v_pos <> v_orgrow.state_code;

  -- Numbering: consecutive per financial year, dates never go backwards
  v_fy := public.financial_year(v_date);
  select max(invoice_date) into v_last_date
  from public.sales_invoices where org_id = v_org and financial_year = v_fy;
  if v_last_date is not null and v_date < v_last_date then
    raise exception 'Invoice date % is before the last invoice in this series (%)', v_date, v_last_date
      using errcode = '22023';
  end if;

  -- Lines (temp table so validation and totals use the same numbers)
  create temp table if not exists _inv_lines (
    sort_order int, challan_id uuid, challan_line_id uuid, so_line_id uuid, item_id uuid,
    description text, hsn_code text, qty numeric, unit_id uuid, unit_name text, rate numeric,
    taxable numeric, gst_rate numeric, cgst numeric, sgst numeric, igst numeric
  ) on commit drop;
  truncate _inv_lines;

  insert into _inv_lines
  select
    (row_number() over (order by dc.challan_date, dc.challan_no, sol.sort_order nulls last, dcl.id))::int,
    dc.id, dcl.id, dcl.so_line_id, dcl.item_id,
    coalesce(nullif(sol.description, ''), i.name),
    nullif(trim(i.hsn_code), ''),
    dcl.qty, dcl.unit_id, u.name, coalesce(dcl.rate, sol.unit_rate, 0),
    round(dcl.qty * coalesce(dcl.rate, sol.unit_rate, 0), 2),
    coalesce(sol.gst_percent::text, '18')::numeric,
    0, 0, 0
  from public.delivery_challans dc
  join public.delivery_challan_lines dcl on dcl.challan_id = dc.id
  join public.items i on i.id = dcl.item_id
  left join public.sales_order_lines sol on sol.id = dcl.so_line_id
  left join public.units u on u.id = dcl.unit_id
  where dc.id = any(p_challan_ids);

  if not exists (select 1 from _inv_lines) then
    raise exception 'The selected challans have no lines' using errcode = '22023';
  end if;

  -- HSN is mandatory on B2B invoices (CGST Rule 46)
  if v_client.gst_number is not null then
    select string_agg(distinct description, ', ') into v_missing_hsn
    from _inv_lines where hsn_code is null;
    if v_missing_hsn is not null then
      raise exception 'Add the HSN code for: % (Items → Edit)', v_missing_hsn using errcode = 'P0010';
    end if;
  end if;

  if v_inter then
    update _inv_lines set igst = round(taxable * gst_rate / 100, 2);
  else
    update _inv_lines set cgst = round(taxable * gst_rate / 200, 2),
                          sgst = round(taxable * gst_rate / 200, 2);
  end if;

  select sum(taxable), sum(cgst), sum(sgst), sum(igst)
    into v_taxable, v_cgst, v_sgst, v_igst
  from _inv_lines;
  v_sum := v_taxable + v_cgst + v_sgst + v_igst;
  v_total := round(v_sum, 0);

  v_no := v_orgrow.invoice_prefix || '/' || v_fy || '/'
          || lpad(public.next_org_seq(v_org, 'inv:' || v_fy)::text, 4, '0');

  insert into public.sales_invoices (
    org_id, invoice_no, invoice_date, financial_year, so_id, client_id,
    supplier_name, supplier_gstin, supplier_address, supplier_state_code,
    buyer_name, buyer_gstin, buyer_address, buyer_state_code,
    place_of_supply, is_interstate, reverse_charge,
    taxable_value, cgst_amount, sgst_amount, igst_amount, round_off, total_amount,
    due_date, notes, created_by
  ) values (
    v_org, v_no, v_date, v_fy,
    case when cardinality(v_so_ids) = 1 then v_so_ids[1] end,
    v_client.id,
    v_orgrow.name, v_orgrow.gst_number,
    nullif(concat_ws(', ', v_orgrow.address, v_orgrow.city, v_orgrow.state, v_orgrow.pincode), ''),
    v_orgrow.state_code,
    v_client.name, v_client.gst_number,
    nullif(concat_ws(', ', v_client.address, v_client.city, v_client.state, v_client.pincode), ''),
    v_client.state_code,
    v_pos, v_inter, coalesce(p_reverse_charge, false),
    v_taxable, v_cgst, v_sgst, v_igst, v_total - v_sum, v_total,
    v_date + coalesce(v_client.credit_days, 0),
    nullif(trim(p_notes), ''), v_user
  )
  returning id into v_inv_id;

  insert into public.sales_invoice_lines (
    org_id, invoice_id, sort_order, challan_id, challan_line_id, so_line_id, item_id,
    description, hsn_code, qty, unit_id, unit_name, rate, taxable_value, gst_rate,
    cgst_amount, sgst_amount, igst_amount, line_total
  )
  select v_org, v_inv_id, sort_order, challan_id, challan_line_id, so_line_id, item_id,
         description, hsn_code, qty, unit_id, unit_name, rate, taxable, gst_rate,
         cgst, sgst, igst, taxable + cgst + sgst + igst
  from _inv_lines;

  update public.delivery_challans set invoice_id = v_inv_id where id = any(p_challan_ids);

  -- Apply advances already received against these sales orders
  if v_so_ids is not null then
    for v_rcpt in
      select id from public.customer_receipts
      where org_id = v_org and client_id = v_client.id and status = 'active'
        and so_id = any(v_so_ids) and amount_allocated < amount
      order by receipt_date, receipt_no
    loop
      v_applied := v_applied + public._allocate_receipt_fifo(v_rcpt.id, null, v_inv_id);
    end loop;
  end if;

  return jsonb_build_object(
    'id', v_inv_id,
    'invoice_no', v_no,
    'total_amount', v_total,
    'advance_applied', v_applied,
    'is_interstate', v_inter
  );
end;
$function$;

-- ── 11. cancel_sales_invoice ─────────────────────────────────

create or replace function public.cancel_sales_invoice(p_invoice_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org  uuid := public.my_org();
  v_inv  public.sales_invoices;
  v_rcpt uuid;
begin
  perform public.assert_my_role('admin', 'manager');

  if nullif(trim(p_reason), '') is null then
    raise exception 'Give a reason for cancelling the invoice' using errcode = '22023';
  end if;

  select * into v_inv from public.sales_invoices
  where id = p_invoice_id and org_id = v_org for update;
  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if v_inv.status = 'cancelled' then
    raise exception 'Invoice % is already cancelled', v_inv.invoice_no using errcode = 'P0008';
  end if;
  if v_inv.amount_credited > 0 then
    raise exception 'Invoice % has credit notes against it and cannot be cancelled', v_inv.invoice_no
      using errcode = 'P0008';
  end if;

  -- Release payments back to the receipts (they become unallocated credit)
  for v_rcpt in
    delete from public.receipt_allocations where invoice_id = p_invoice_id returning receipt_id
  loop
    perform public._recalc_receipt_allocated(v_rcpt);
  end loop;

  update public.delivery_challans set invoice_id = null where invoice_id = p_invoice_id;

  update public.sales_invoices
  set status = 'cancelled', amount_paid = 0,
      cancelled_by = auth.uid(), cancelled_at = now(), cancel_reason = trim(p_reason)
  where id = p_invoice_id;

  return jsonb_build_object('id', p_invoice_id, 'invoice_no', v_inv.invoice_no, 'status', 'cancelled');
end;
$function$;

-- ── 12. Receipts ─────────────────────────────────────────────

create or replace function public.record_customer_receipt(
  p_client_id    uuid,
  p_amount       numeric,
  p_mode         text,
  p_receipt_date date default null,
  p_reference    text default null,
  p_notes        text default null,
  p_so_id        uuid default null,
  p_allocations  jsonb default null,
  p_auto_allocate boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org     uuid := public.my_org();
  v_date    date := coalesce(p_receipt_date, current_date);
  v_client  public.clients;
  v_so      public.sales_orders;
  v_fy      text;
  v_no      text;
  v_id      uuid;
  v_alloc   record;
  v_inv     public.sales_invoices;
  v_sum     numeric := 0;
  v_applied numeric := 0;
  v_so_paid numeric;
begin
  perform public.assert_my_role('admin', 'manager', 'sales');

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;
  if round(p_amount, 2) <> p_amount then
    raise exception 'Amount can have at most 2 decimals' using errcode = '22023';
  end if;
  if p_mode is null or p_mode not in ('cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other') then
    raise exception 'Unknown payment mode %', p_mode using errcode = '22023';
  end if;
  -- Income Tax Act s.269ST: no cash receipt of ₹2,00,000 or more
  if p_mode = 'cash' and p_amount >= 200000 then
    raise exception 'Cash receipts of ₹2,00,000 or more are not allowed (Income Tax Act s.269ST)'
      using errcode = '22023';
  end if;
  if v_date > current_date then
    raise exception 'Receipt date cannot be in the future' using errcode = '22023';
  end if;

  select * into v_client from public.clients where id = p_client_id and org_id = v_org;
  if not found then
    raise exception 'Client not found' using errcode = 'P0002';
  end if;

  if p_so_id is not null then
    select * into v_so from public.sales_orders
    where id = p_so_id and org_id = v_org for update;
    if not found then
      raise exception 'Sales order not found' using errcode = 'P0002';
    end if;
    if v_so.client_id <> p_client_id then
      raise exception 'Sales order % belongs to another client', v_so.so_number using errcode = '22023';
    end if;
    if v_so.status = 'cancelled' then
      raise exception 'Cannot record a payment on a cancelled order' using errcode = 'P0008';
    end if;
    select coalesce(sum(amount), 0) into v_so_paid
    from public.customer_receipts where so_id = p_so_id and status = 'active';
    if v_so_paid + p_amount > v_so.total_amount + 0.005 then
      raise exception 'Amount % exceeds the balance due on % (%)',
        p_amount, v_so.so_number, round(v_so.total_amount - v_so_paid, 2) using errcode = 'P0009';
    end if;
  end if;

  v_fy := public.financial_year(v_date);
  v_no := 'RCT/' || v_fy || '/' || lpad(public.next_org_seq(v_org, 'rct:' || v_fy)::text, 4, '0');

  insert into public.customer_receipts (
    org_id, receipt_no, receipt_date, financial_year, client_id, so_id,
    amount, mode, reference, notes, created_by
  ) values (
    v_org, v_no, v_date, v_fy, p_client_id, p_so_id,
    p_amount, p_mode, nullif(trim(p_reference), ''), nullif(trim(p_notes), ''), auth.uid()
  )
  returning id into v_id;

  if p_allocations is not null and jsonb_typeof(p_allocations) = 'array'
     and jsonb_array_length(p_allocations) > 0 then
    -- Explicit allocation chosen by the user
    for v_alloc in
      select (x->>'invoice_id')::uuid as invoice_id, (x->>'amount')::numeric as amount
      from jsonb_array_elements(p_allocations) x
    loop
      if v_alloc.amount is null or v_alloc.amount <= 0 then
        raise exception 'Allocation amounts must be greater than zero' using errcode = '22023';
      end if;
      select * into v_inv from public.sales_invoices
      where id = v_alloc.invoice_id and org_id = v_org for update;
      if not found or v_inv.client_id <> p_client_id then
        raise exception 'Invoice not found for this client' using errcode = 'P0002';
      end if;
      if v_inv.status <> 'issued' then
        raise exception 'Invoice % is cancelled', v_inv.invoice_no using errcode = 'P0008';
      end if;
      if v_alloc.amount > v_inv.balance_due + 0.005 then
        raise exception 'Amount % exceeds the balance due on % (%)',
          v_alloc.amount, v_inv.invoice_no, v_inv.balance_due using errcode = 'P0009';
      end if;
      v_sum := v_sum + v_alloc.amount;
      if v_sum > p_amount + 0.005 then
        raise exception 'Allocations add up to more than the receipt amount' using errcode = 'P0009';
      end if;
      insert into public.receipt_allocations (org_id, receipt_id, invoice_id, amount, created_by)
      values (v_org, v_id, v_inv.id, v_alloc.amount, auth.uid());
      perform public._recalc_invoice_paid(v_inv.id);
    end loop;
    perform public._recalc_receipt_allocated(v_id);
    v_applied := v_sum;
  elsif p_auto_allocate then
    -- Oldest open invoices first (only that order's invoices for an SO advance)
    v_applied := public._allocate_receipt_fifo(v_id, p_so_id);
  end if;

  if p_so_id is not null then
    perform public._recalc_so_advance(p_so_id);
  end if;

  return jsonb_build_object(
    'id', v_id,
    'receipt_no', v_no,
    'amount', p_amount,
    'allocated', v_applied,
    'unallocated', p_amount - v_applied
  );
end;
$function$;

-- Apply a receipt's unallocated balance (on-account credit) to invoices
create or replace function public.allocate_customer_receipt(p_receipt_id uuid, p_allocations jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org   uuid := public.my_org();
  v_rcpt  public.customer_receipts;
  v_alloc record;
  v_inv   public.sales_invoices;
  v_sum   numeric := 0;
begin
  perform public.assert_my_role('admin', 'manager', 'sales');

  select * into v_rcpt from public.customer_receipts
  where id = p_receipt_id and org_id = v_org for update;
  if not found then
    raise exception 'Receipt not found' using errcode = 'P0002';
  end if;
  if v_rcpt.status <> 'active' then
    raise exception 'Receipt % is cancelled', v_rcpt.receipt_no using errcode = 'P0008';
  end if;

  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array'
     or jsonb_array_length(p_allocations) = 0 then
    v_sum := public._allocate_receipt_fifo(p_receipt_id, null);
  else
    for v_alloc in
      select (x->>'invoice_id')::uuid as invoice_id, (x->>'amount')::numeric as amount
      from jsonb_array_elements(p_allocations) x
    loop
      if v_alloc.amount is null or v_alloc.amount <= 0 then
        raise exception 'Allocation amounts must be greater than zero' using errcode = '22023';
      end if;
      select * into v_inv from public.sales_invoices
      where id = v_alloc.invoice_id and org_id = v_org for update;
      if not found or v_inv.client_id <> v_rcpt.client_id then
        raise exception 'Invoice not found for this client' using errcode = 'P0002';
      end if;
      if v_inv.status <> 'issued' then
        raise exception 'Invoice % is cancelled', v_inv.invoice_no using errcode = 'P0008';
      end if;
      if v_alloc.amount > v_inv.balance_due + 0.005 then
        raise exception 'Amount % exceeds the balance due on % (%)',
          v_alloc.amount, v_inv.invoice_no, v_inv.balance_due using errcode = 'P0009';
      end if;
      v_sum := v_sum + v_alloc.amount;
      if v_sum > (v_rcpt.amount - v_rcpt.amount_allocated) + 0.005 then
        raise exception 'Allocations add up to more than the unallocated amount (%)',
          v_rcpt.amount - v_rcpt.amount_allocated using errcode = 'P0009';
      end if;
      insert into public.receipt_allocations (org_id, receipt_id, invoice_id, amount, created_by)
      values (v_org, p_receipt_id, v_inv.id, v_alloc.amount, auth.uid())
      on conflict (receipt_id, invoice_id)
        do update set amount = public.receipt_allocations.amount + excluded.amount;
      perform public._recalc_invoice_paid(v_inv.id);
    end loop;
    perform public._recalc_receipt_allocated(p_receipt_id);
  end if;

  return jsonb_build_object('id', p_receipt_id, 'allocated', v_sum);
end;
$function$;

create or replace function public.cancel_customer_receipt(p_receipt_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org  uuid := public.my_org();
  v_rcpt public.customer_receipts;
  v_inv  uuid;
begin
  perform public.assert_my_role('admin', 'manager');

  if nullif(trim(p_reason), '') is null then
    raise exception 'Give a reason for cancelling the receipt' using errcode = '22023';
  end if;

  select * into v_rcpt from public.customer_receipts
  where id = p_receipt_id and org_id = v_org for update;
  if not found then
    raise exception 'Receipt not found' using errcode = 'P0002';
  end if;
  if v_rcpt.status = 'cancelled' then
    raise exception 'Receipt % is already cancelled', v_rcpt.receipt_no using errcode = 'P0008';
  end if;

  update public.customer_receipts
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), cancel_reason = trim(p_reason)
  where id = p_receipt_id;

  for v_inv in
    delete from public.receipt_allocations where receipt_id = p_receipt_id returning invoice_id
  loop
    perform public._recalc_invoice_paid(v_inv);
  end loop;
  perform public._recalc_receipt_allocated(p_receipt_id);

  if v_rcpt.so_id is not null then
    perform public._recalc_so_advance(v_rcpt.so_id);
  end if;

  return jsonb_build_object('id', p_receipt_id, 'receipt_no', v_rcpt.receipt_no, 'status', 'cancelled');
end;
$function$;

-- Existing "record payment" on a sales order now creates a proper receipt
create or replace function public.record_so_payment(p_so_id uuid, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
  v_so  public.sales_orders;
  v_res jsonb;
begin
  perform public.assert_my_role('admin', 'manager', 'sales');
  select * into v_so from public.sales_orders where id = p_so_id and org_id = v_org;
  if not found then
    raise exception 'Sales order not found' using errcode = 'P0002';
  end if;
  v_res := public.record_customer_receipt(
    v_so.client_id, p_amount, 'other', current_date, null, null, p_so_id, null, true
  );
  select * into v_so from public.sales_orders where id = p_so_id;
  return v_res || jsonb_build_object(
    'success', true, 'so_id', p_so_id,
    'advance_paid', v_so.advance_paid, 'balance_due', v_so.balance_due
  );
end;
$function$;

-- Existing SO advances become receipts so every rupee received is in one ledger
do $backfill$
declare
  v_so record;
  v_fy text;
begin
  for v_so in
    select s.* from public.sales_orders s
    where coalesce(s.advance_paid, 0) > 0
      and not exists (select 1 from public.customer_receipts r where r.so_id = s.id)
  loop
    v_fy := public.financial_year(coalesce(v_so.order_date, current_date));
    insert into public.customer_receipts (
      org_id, receipt_no, receipt_date, financial_year, client_id, so_id,
      amount, mode, reference, notes, created_by
    ) values (
      v_so.org_id,
      'RCT/' || v_fy || '/' || lpad(public.next_org_seq(v_so.org_id, 'rct:' || v_fy)::text, 4, '0'),
      coalesce(v_so.order_date, current_date), v_fy, v_so.client_id, v_so.id,
      v_so.advance_paid, 'other', 'Opening balance',
      'Advance recorded on ' || v_so.so_number || ' before receipts were introduced',
      v_so.created_by
    );
  end loop;
end
$backfill$;

-- ── 13. Receivables views ────────────────────────────────────

create or replace view public.v_invoice_ageing
with (security_invoker = true)
as
select
  i.id, i.org_id, i.invoice_no, i.invoice_date, i.due_date, i.client_id,
  c.name as client_name, i.so_id, i.total_amount, i.amount_paid, i.amount_credited, i.balance_due,
  greatest(current_date - i.due_date, 0) as days_overdue,
  case
    when i.due_date >= current_date then 'not_due'
    when current_date - i.due_date <= 30 then '1_30'
    when current_date - i.due_date <= 60 then '31_60'
    when current_date - i.due_date <= 90 then '61_90'
    else 'over_90'
  end as bucket
from public.sales_invoices i
join public.clients c on c.id = i.client_id
where i.status = 'issued' and i.balance_due > 0;

create or replace view public.v_client_receivables
with (security_invoker = true)
as
with inv as (
  select client_id,
         sum(total_amount) as invoiced,
         sum(balance_due) as outstanding,
         sum(balance_due) filter (where due_date >= current_date) as not_due,
         sum(balance_due) filter (where current_date - due_date between 1 and 30) as d1_30,
         sum(balance_due) filter (where current_date - due_date between 31 and 60) as d31_60,
         sum(balance_due) filter (where current_date - due_date between 61 and 90) as d61_90,
         sum(balance_due) filter (where current_date - due_date > 90) as d90_plus,
         max(current_date - due_date) filter (where balance_due > 0) as max_days_overdue
  from public.sales_invoices
  where status = 'issued'
  group by client_id
), rcpt as (
  select client_id,
         sum(amount) as received,
         sum(amount - amount_allocated) as unallocated
  from public.customer_receipts
  where status = 'active'
  group by client_id
)
select
  c.id as client_id, c.org_id, c.name as client_name, c.credit_limit, c.credit_days,
  coalesce(inv.invoiced, 0) as invoiced,
  coalesce(rcpt.received, 0) as received,
  coalesce(inv.outstanding, 0) as outstanding,
  coalesce(inv.not_due, 0) as not_due,
  coalesce(inv.d1_30, 0) as overdue_1_30,
  coalesce(inv.d31_60, 0) as overdue_31_60,
  coalesce(inv.d61_90, 0) as overdue_61_90,
  coalesce(inv.d90_plus, 0) as overdue_90_plus,
  coalesce(inv.d1_30, 0) + coalesce(inv.d31_60, 0) + coalesce(inv.d61_90, 0) + coalesce(inv.d90_plus, 0) as overdue,
  coalesce(rcpt.unallocated, 0) as unallocated_credit,
  greatest(coalesce(inv.max_days_overdue, 0), 0) as max_days_overdue
from public.clients c
left join inv on inv.client_id = c.id
left join rcpt on rcpt.client_id = c.id
where inv.client_id is not null or rcpt.client_id is not null;

-- ── 14. Credit control ───────────────────────────────────────

-- Exposure = unpaid invoices + confirmed orders not yet invoiced
--          − unapplied money already received
create or replace function public.client_credit_status(p_client_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_org         uuid := public.my_org();
  v_client      public.clients;
  v_outstanding numeric;
  v_overdue     numeric;
  v_open_orders numeric;
  v_unalloc     numeric;
  v_exposure    numeric;
begin
  select * into v_client from public.clients where id = p_client_id and org_id = v_org;
  if not found then
    raise exception 'Client not found' using errcode = 'P0002';
  end if;

  select coalesce(sum(balance_due), 0),
         coalesce(sum(balance_due) filter (where due_date < current_date), 0)
    into v_outstanding, v_overdue
  from public.sales_invoices
  where client_id = p_client_id and status = 'issued';

  -- Value of open orders not yet covered by an issued invoice
  select coalesce(sum(greatest(s.total_amount - coalesce(inv.invoiced, 0), 0)), 0)
    into v_open_orders
  from public.sales_orders s
  left join (
    select so_id, sum(total_amount) as invoiced
    from public.sales_invoices where status = 'issued' and so_id is not null
    group by so_id
  ) inv on inv.so_id = s.id
  where s.client_id = p_client_id
    and s.status in ('confirmed', 'in_production', 'ready', 'dispatched', 'delivered');

  select coalesce(sum(amount - amount_allocated), 0) into v_unalloc
  from public.customer_receipts
  where client_id = p_client_id and status = 'active';

  v_exposure := v_outstanding + v_open_orders - v_unalloc;

  return jsonb_build_object(
    'client_id', p_client_id,
    'credit_limit', coalesce(v_client.credit_limit, 0),
    'credit_days', coalesce(v_client.credit_days, 0),
    'outstanding', v_outstanding,
    'overdue', v_overdue,
    'open_orders', v_open_orders,
    'unallocated_credit', v_unalloc,
    'exposure', v_exposure,
    'available', case when coalesce(v_client.credit_limit, 0) > 0
                      then v_client.credit_limit - v_exposure end
  );
end;
$function$;

create or replace function public.convert_quotation_to_sales_order(p_quotation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
  v_user uuid := auth.uid();
  v_qt public.quotations;
  v_so_id uuid;
  v_so_no text;
  v_limit numeric;
  v_credit jsonb;
begin
  perform public.assert_my_role('admin', 'manager', 'sales');
  select * into v_qt from public.quotations where id = p_quotation_id and org_id = v_org for update;
  if not found then
    raise exception 'Quotation not found' using errcode = 'P0002';
  end if;
  if v_qt.status = 'converted' then
    raise exception 'Quotation % has already been converted', v_qt.quotation_no using errcode = 'P0008';
  end if;
  if v_qt.status <> 'approved' then
    raise exception 'Only approved quotations can be converted (this one is %)', v_qt.status using errcode = 'P0008';
  end if;
  if not exists (select 1 from public.quotation_lines where quotation_id = p_quotation_id) then
    raise exception 'Quotation has no lines' using errcode = '22023';
  end if;

  -- Credit control: sales users can't push a client over its credit limit;
  -- admins and managers can (the decision is theirs to make).
  select credit_limit into v_limit from public.clients where id = v_qt.client_id;
  if coalesce(v_limit, 0) > 0 and public.my_role() = 'sales' then
    v_credit := public.client_credit_status(v_qt.client_id);
    if (v_credit->>'exposure')::numeric + v_qt.total_amount > v_limit then
      raise exception 'Credit limit exceeded: exposure would be ₹% against a limit of ₹%. Ask a manager to approve this order.',
        round((v_credit->>'exposure')::numeric + v_qt.total_amount, 2), v_limit
        using errcode = 'P0011';
    end if;
  end if;

  v_so_no := public.next_so_no(v_org);
  insert into public.sales_orders (org_id, so_number, created_by, quotation_id, client_id, order_date, status, subtotal, gst_amount, total_amount, advance_paid, balance_due, payment_terms, delivery_date, notes)
  values (v_org, v_so_no, v_user, v_qt.id, v_qt.client_id, current_date, 'confirmed', v_qt.subtotal, v_qt.gst_amount, v_qt.total_amount, 0, v_qt.total_amount, v_qt.payment_terms,
    case when v_qt.delivery_days is not null then current_date + v_qt.delivery_days end,
    nullif(concat_ws(E'\n\n', nullif(v_qt.notes, ''), case when nullif(v_qt.transport_note, '') is not null then 'Transport: ' || v_qt.transport_note end), ''))
  returning id into v_so_id;
  insert into public.sales_order_lines (so_id, item_id, description, qty, unit_id, unit_rate, gst_percent, sort_order)
  select v_so_id, ql.item_id, ql.description, ql.qty, ql.unit_id, ql.unit_rate, ql.gst_percent, (row_number() over (order by ql.sort_order nulls last, ql.id) - 1)::integer
  from public.quotation_lines ql
  where ql.quotation_id = p_quotation_id;
  update public.quotations set status = 'converted' where id = p_quotation_id;
  return jsonb_build_object('success', true, 'id', v_so_id, 'so_number', v_so_no);
end;
$function$;

-- ── 15. GST reports ──────────────────────────────────────────

-- HSN-wise summary of outward supplies (GSTR-1 Table 12) for a period
create or replace function public.gst_hsn_summary(p_from date, p_to date)
returns table (
  hsn_code       text,
  description    text,
  unit_name      text,
  gst_rate       numeric,
  total_qty      numeric,
  taxable_value  numeric,
  igst_amount    numeric,
  cgst_amount    numeric,
  sgst_amount    numeric,
  total_value    numeric,
  b2b            boolean
)
language sql
stable
security invoker
set search_path to 'public'
as $function$
  select
    coalesce(l.hsn_code, '—') as hsn_code,
    min(l.description) as description,
    l.unit_name,
    l.gst_rate,
    sum(l.qty),
    sum(l.taxable_value),
    sum(l.igst_amount),
    sum(l.cgst_amount),
    sum(l.sgst_amount),
    sum(l.line_total),
    i.buyer_gstin is not null as b2b
  from public.sales_invoice_lines l
  join public.sales_invoices i on i.id = l.invoice_id
  where i.status = 'issued'
    and i.invoice_date between p_from and p_to
  group by coalesce(l.hsn_code, '—'), l.unit_name, l.gst_rate, i.buyer_gstin is not null
  order by 1, 4;
$function$;

-- ── 16. Privileges ───────────────────────────────────────────

revoke execute on function public.create_sales_invoice(uuid[], date, text, boolean) from public, anon;
revoke execute on function public.cancel_sales_invoice(uuid, text) from public, anon;
revoke execute on function public.record_customer_receipt(uuid, numeric, text, date, text, text, uuid, jsonb, boolean) from public, anon;
revoke execute on function public.allocate_customer_receipt(uuid, jsonb) from public, anon;
revoke execute on function public.cancel_customer_receipt(uuid, text) from public, anon;
revoke execute on function public.client_credit_status(uuid) from public, anon;
revoke execute on function public.gst_hsn_summary(date, date) from public, anon;
revoke execute on function public.financial_year(date) from public, anon;
revoke execute on function public.is_valid_gstin(text) from public, anon;

grant execute on function public.create_sales_invoice(uuid[], date, text, boolean) to authenticated;
grant execute on function public.cancel_sales_invoice(uuid, text) to authenticated;
grant execute on function public.record_customer_receipt(uuid, numeric, text, date, text, text, uuid, jsonb, boolean) to authenticated;
grant execute on function public.allocate_customer_receipt(uuid, jsonb) to authenticated;
grant execute on function public.cancel_customer_receipt(uuid, text) to authenticated;
grant execute on function public.client_credit_status(uuid) to authenticated;
grant execute on function public.gst_hsn_summary(date, date) to authenticated;
grant execute on function public.financial_year(date) to authenticated;
grant execute on function public.is_valid_gstin(text) to authenticated;

revoke select on public.v_invoice_ageing, public.v_client_receivables from anon;
