-- ─────────────────────────────────────────────────────────────
-- TDS on supplier payments, and TDS deposited with the government.
--
-- A supplier payment can now deduct TDS: the supplier gets the cash
-- (amount) and the TDS (tds_amount) is paid to the government on their
-- behalf, so the bills are settled by both together (gross_amount).
-- Everything about money in the bank or in cash still reads amount.
--
-- suppliers.pan                 the supplier's PAN, for the TDS return; the
--                               PAN inside a GSTIN is used when it is empty
-- supplier_payments.tds_*       payment code (Income-tax Act 2025, e.g. 1031
--                               purchase of goods, 1024 contractor), rate,
--                               the amount TDS was worked out on, and TDS;
--                               gross_amount = amount + tds_amount
-- tds_openings                  TDS deducted but not yet deposited on a
--                               starting day (one row per organisation)
-- tds_deposits                  challans: TDS deposited for a month, plus
--                               interest and late fee, TDSD/<fy>/<nnnn>
-- tds_ledger()                  on a day: opening + deducted - deposited,
--                               month by month with due dates, and by code
--
-- TDS also counts in:
--   record_supplier_payment()   takes the TDS; allocation uses cash + TDS
--   allocate_supplier_payment(), _allocate_payment_fifo()   cash + TDS
--   v_supplier_payables         advance from cash + TDS; new column tds
--   supplier_statement()        a TDS line after each payment that has it
--   money_balances(), v_bank_entries, set_bank_dates()   deposits go out
--   profit_and_loss()           "TDS interest and late fee" as an expense
--   financial_position()        suppliers settled by cash + TDS, and TDS
--                               still to deposit owed to the government
--
-- Read by admin, manager and viewer; written by admin and manager.
-- ─────────────────────────────────────────────────────────────

-- ── Supplier PAN ──────────────────────────────────────────────
alter table public.suppliers add column pan text;
alter table public.suppliers add constraint suppliers_pan_check
  check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$');
comment on column public.suppliers.pan is
  'Permanent Account Number, for TDS returns. When empty, the PAN inside the GSTIN (characters 3 to 12) is used.';

-- ── TDS on supplier payments ──────────────────────────────────
alter table public.supplier_payments
  add column tds_code text,
  add column tds_rate numeric(6,3),
  add column tds_base numeric(14,2),
  add column tds_amount numeric(14,2) not null default 0,
  add column gross_amount numeric(14,2) generated always as (amount + tds_amount) stored;
alter table public.supplier_payments add constraint supplier_payments_tds_check check (
  (tds_amount = 0 and tds_code is null and tds_rate is null and tds_base is null)
  or (tds_amount > 0 and tds_code ~ '^[0-9]{4}$' and tds_rate > 0 and tds_rate <= 100
      and tds_base > 0 and tds_amount <= tds_base));
create index supplier_payments_tds_idx on public.supplier_payments (org_id, payment_date) where tds_amount > 0;
-- A payment can settle up to the money paid plus the TDS
do $$ begin
  execute 'alter table public.supplier_payments drop constraint supplier_payments_allocated_within_amount';
end $$;
alter table public.supplier_payments add constraint supplier_payments_allocated_within_amount
  check (amount_allocated >= 0 and amount_allocated <= amount + tds_amount);

comment on column public.supplier_payments.amount is 'Money paid to the supplier (cash, bank, UPI...).';
comment on column public.supplier_payments.tds_amount is 'TDS deducted from the supplier and owed to the government.';
comment on column public.supplier_payments.gross_amount is 'What the payment settles: amount + tds_amount.';
comment on column public.supplier_payments.tds_code is 'TDS payment code under the Income-tax Act 2025, e.g. 1031 purchase of goods, 1024 contractor (not individual).';
comment on column public.supplier_payments.tds_base is 'The amount TDS was worked out on (usually the value before GST).';

-- The books lock also guards the TDS on a payment
do $$ begin
  execute 'drop trigger trg_books_lock on public.supplier_payments';
end $$;
create trigger trg_books_lock before insert or update on public.supplier_payments for each row
  execute function public._guard_books_lock('payment_date', 'payment_date', 'status', 'supplier_id', 'amount', 'mode', 'tds_code', 'tds_rate', 'tds_base', 'tds_amount');

-- ── Opening and deposits ──────────────────────────────────────
create table public.tds_openings (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null unique references public.organizations(id),
  as_of       date not null,
  amount      numeric(14,2) not null check (amount >= 0),
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now()
);
create index tds_openings_updated_by_idx on public.tds_openings (updated_by);

comment on table public.tds_openings is
  'TDS deducted but not yet deposited on a starting day. One row per organisation, written through set_tds_opening().';

create table public.tds_deposits (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id),
  deposit_no     text not null,
  deposit_date   date not null,
  financial_year text not null,
  period         text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  tds_code       text check (tds_code ~ '^[0-9]{4}$'),
  tax            numeric(14,2) not null default 0 check (tax >= 0),
  interest       numeric(14,2) not null default 0 check (interest >= 0),
  late_fee       numeric(14,2) not null default 0 check (late_fee >= 0),
  amount         numeric(14,2) generated always as (tax + interest + late_fee) stored,
  mode           text not null check (mode in ('cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other')),
  reference      text,
  notes          text,
  status         text not null default 'active' check (status in ('active', 'cancelled')),
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  cancelled_by   uuid references public.profiles(id),
  cancelled_at   timestamptz,
  cancel_reason  text,
  constraint tds_deposits_org_no_key unique (org_id, deposit_no),
  constraint tds_deposits_some_amount check (tax + interest + late_fee > 0)
);
create index tds_deposits_org_date_idx on public.tds_deposits (org_id, deposit_date);
create index tds_deposits_created_by_idx on public.tds_deposits (created_by);
create index tds_deposits_cancelled_by_idx on public.tds_deposits (cancelled_by);

comment on table public.tds_deposits is
  'TDS challans: tax deposited for a month of deduction, plus interest and late fee. Written through record_tds_deposit() and cancel_tds_deposit(); rows are cancelled, never deleted.';

create trigger trg_aud_tds_openings after insert or update or delete on public.tds_openings
  for each row execute function public.write_audit_log();
create trigger trg_aud_tds_deposits after insert or update or delete on public.tds_deposits
  for each row execute function public.write_audit_log();
create trigger trg_books_lock before insert or update on public.tds_openings for each row
  execute function public._guard_books_lock('as_of', 'as_of', 'amount');
create trigger trg_books_lock before insert or update on public.tds_deposits for each row
  execute function public._guard_books_lock('deposit_date', 'deposit_date', 'status', 'period', 'tds_code', 'tax', 'interest', 'late_fee', 'mode');

alter table public.tds_openings enable row level security;
alter table public.tds_deposits enable row level security;

create policy "payables roles read tds openings" on public.tds_openings for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'viewer'));
create policy "payables roles read tds deposits" on public.tds_deposits for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'viewer'));

do $$ begin
  execute 'revoke all on public.tds_openings, public.tds_deposits from anon';
  execute 'revoke insert, update, delete, truncate, references, trigger on public.tds_openings, public.tds_deposits from authenticated';
end $$;
grant select on public.tds_openings, public.tds_deposits to authenticated;

create function public.set_tds_opening(p_as_of date, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
begin
  perform public.assert_my_role('admin', 'manager');
  if p_as_of is null then
    raise exception 'Choose the day the opening is for' using errcode = '22023';
  end if;
  if p_as_of > current_date then
    raise exception 'The opening day cannot be in the future' using errcode = '22023';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'The amount cannot be negative' using errcode = '22023';
  end if;
  if round(p_amount, 2) <> p_amount then
    raise exception 'The amount can have at most 2 decimals' using errcode = '22023';
  end if;
  if p_amount >= 1000000000000 then
    raise exception 'Amount is too large' using errcode = '22023';
  end if;

  insert into public.tds_openings (org_id, as_of, amount, updated_by)
  values (v_org, p_as_of, p_amount, auth.uid())
  on conflict (org_id) do update
  set as_of = excluded.as_of, amount = excluded.amount, updated_by = excluded.updated_by, updated_at = now();
  return jsonb_build_object('as_of', p_as_of, 'amount', p_amount);
end;
$function$;

comment on function public.set_tds_opening(date, numeric) is
  'Sets the TDS deducted but not yet deposited on a day. Deductions and deposits on or before that day are then part of the opening. Replaces any earlier opening. Admin and manager.';

create function public.record_tds_deposit(
  p_deposit_date date,
  p_period text,
  p_tax numeric default 0,
  p_interest numeric default 0,
  p_late_fee numeric default 0,
  p_mode text default 'bank_transfer',
  p_tds_code text default null,
  p_reference text default null,
  p_notes text default null,
  p_request_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org   uuid := public.my_org();
  v_date  date := coalesce(p_deposit_date, current_date);
  v_amt   numeric;
  v_total numeric;
  v_fy    text;
  v_no    text;
  v_id    uuid;
begin
  perform public.assert_my_role('admin', 'manager');
  perform public._claim_document_request(p_request_id, 'record_tds_deposit');
  foreach v_amt in array array[p_tax, p_interest, p_late_fee] loop
    if v_amt is null or v_amt < 0 then
      raise exception 'Amounts cannot be negative' using errcode = '22023';
    end if;
    if round(v_amt, 2) <> v_amt then
      raise exception 'Amounts can have at most 2 decimals' using errcode = '22023';
    end if;
  end loop;
  v_total := p_tax + p_interest + p_late_fee;
  if v_total <= 0 then
    raise exception 'Enter the TDS, interest or late fee deposited' using errcode = '22023';
  end if;
  if v_total >= 1000000000000 then
    raise exception 'Amount is too large' using errcode = '22023';
  end if;
  if p_mode is null or p_mode not in ('cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other') then
    raise exception 'Unknown payment mode %', p_mode using errcode = '22023';
  end if;
  if v_date > current_date then
    raise exception 'Deposit date cannot be in the future' using errcode = '22023';
  end if;
  if p_period is null or p_period !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Choose the month the TDS was deducted in, like 2026-10' using errcode = '22023';
  end if;
  if to_date(p_period || '-01', 'YYYY-MM-DD') > date_trunc('month', v_date)::date then
    raise exception 'The month of deduction cannot be after the month of deposit' using errcode = '22023';
  end if;
  if p_tds_code is not null and p_tds_code !~ '^[0-9]{4}$' then
    raise exception 'A TDS payment code has four digits, like 1031' using errcode = '22023';
  end if;

  v_fy := public.financial_year(v_date);
  v_no := 'TDSD/' || v_fy || '/' || lpad(public.next_org_seq(v_org, 'tdsd:' || v_fy)::text, 4, '0');
  insert into public.tds_deposits (org_id, deposit_no, deposit_date, financial_year, period, tds_code, tax, interest, late_fee, mode, reference, notes, created_by)
  values (v_org, v_no, v_date, v_fy, p_period, p_tds_code, p_tax, p_interest, p_late_fee, p_mode,
          nullif(trim(p_reference), ''), nullif(trim(p_notes), ''), auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'deposit_no', v_no, 'amount', v_total);
end;
$function$;

comment on function public.record_tds_deposit(date, text, numeric, numeric, numeric, text, text, text, text, uuid) is
  'Records a TDS challan for a month of deduction: tax, interest and late fee, numbered TDSD/<fy>/<nnnn>. Admin and manager. p_request_id makes a retried submission safe.';

create function public.cancel_tds_deposit(p_deposit_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
  v_dep public.tds_deposits;
begin
  perform public.assert_my_role('admin', 'manager');
  if nullif(trim(p_reason), '') is null then
    raise exception 'Give a reason for cancelling the TDS deposit' using errcode = '22023';
  end if;
  select * into v_dep from public.tds_deposits where id = p_deposit_id and org_id = v_org for update;
  if not found then
    raise exception 'TDS deposit not found' using errcode = 'P0002';
  end if;
  if v_dep.status = 'cancelled' then
    raise exception 'TDS deposit % is already cancelled', v_dep.deposit_no using errcode = 'P0008';
  end if;
  update public.tds_deposits
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), cancel_reason = trim(p_reason)
  where id = p_deposit_id;
  return jsonb_build_object('id', p_deposit_id, 'deposit_no', v_dep.deposit_no, 'status', 'cancelled');
end;
$function$;

comment on function public.cancel_tds_deposit(uuid, text) is
  'Cancels a TDS challan with a reason; the row is kept. Admin and manager.';

-- ── The ledger ────────────────────────────────────────────────
-- TDS for a month is due by the 7th of the next month; March's by 30 April.
create function public.tds_due_date(p_period text)
returns date
language sql
immutable
set search_path to 'public'
as $function$
  select case when substr(p_period, 6, 2) = '03'
              then make_date(substr(p_period, 1, 4)::integer, 4, 30)
              else (make_date(substr(p_period, 1, 4)::integer, substr(p_period, 6, 2)::integer, 1) + interval '1 month')::date + 6 end;
$function$;

comment on function public.tds_due_date(text) is
  'The day TDS deducted in a month (YYYY-MM) must be deposited by: the 7th of the next month, or 30 April for March.';

create function public.tds_ledger(p_as_of date)
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

  select coalesce(sum(tds_amount), 0) into v_ded
  from public.supplier_payments
  where org_id = v_org and status = 'active' and tds_amount > 0
    and (v_after is null or payment_date > v_after) and payment_date <= p_as_of;

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
    from public.supplier_payments
    where org_id = v_org and status = 'active' and tds_amount > 0
      and (v_after is null or payment_date > v_after) and payment_date <= p_as_of
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

comment on function public.tds_ledger(date) is
  'TDS on a day: opening + deducted from suppliers - deposited = still to deposit (negative when more was deposited). With months (deducted, deposited for it, due date, overdue) and totals per payment code. Before the opening day, set is false. Reads with the caller''s rights.';

-- The closed-books message names a TDS deposit by its number
create or replace function public._guard_books_lock()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_new  jsonb := to_jsonb(NEW);
  v_old  jsonb;
  v_lock date;
  v_dnew date;
  v_dold date;
  i      integer;
begin
  select locked_until into v_lock from public.books_lock where org_id = (v_new ->> 'org_id')::uuid;
  if v_lock is null then
    return NEW;
  end if;
  v_dnew := (v_new ->> TG_ARGV[0])::date;
  if TG_OP = 'INSERT' then
    if v_dnew <= v_lock then
      raise exception 'The books are closed up to %: nothing dated on or before then can be added', to_char(v_lock, 'DD Mon YYYY')
        using errcode = 'P0013';
    end if;
    return NEW;
  end if;

  v_old := to_jsonb(OLD);
  v_dold := (v_old ->> TG_ARGV[0])::date;
  if coalesce(v_dold > v_lock, true) and coalesce(v_dnew > v_lock, true) then
    return NEW;
  end if;
  for i in 1 .. TG_NARGS - 1 loop
    if (v_old -> TG_ARGV[i]) is distinct from (v_new -> TG_ARGV[i]) then
      raise exception 'The books are closed up to %: % dated % cannot be changed or cancelled', to_char(v_lock, 'DD Mon YYYY'),
        coalesce(v_new ->> 'invoice_no', v_new ->> 'credit_note_no', v_new ->> 'receipt_no', v_new ->> 'bill_no', v_new ->> 'payment_no',
                 v_new ->> 'debit_note_no', v_new ->> 'expense_no', v_new ->> 'income_no', v_new ->> 'transfer_no', v_new ->> 'entry_no',
                 v_new ->> 'asset_no', v_new ->> 'deposit_no', v_new ->> 'name', 'an entry'),
        to_char(least(v_dold, v_dnew), 'DD Mon YYYY')
        using errcode = 'P0013';
    end if;
  end loop;
  return NEW;
end;
$function$;

-- ── Supplier payments take TDS ────────────────────────────────
do $$ begin
  execute 'drop function public.record_supplier_payment(uuid, numeric, text, date, text, text, jsonb, boolean, uuid)';
end $$;

create function public.record_supplier_payment(
  p_supplier_id uuid,
  p_amount numeric,
  p_mode text,
  p_payment_date date default null,
  p_reference text default null,
  p_notes text default null,
  p_allocations jsonb default null,
  p_auto_allocate boolean default true,
  p_request_id uuid default null,
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
  v_org     uuid := public.my_org();
  v_date    date := coalesce(p_payment_date, current_date);
  v_tds     numeric := coalesce(p_tds_amount, 0);
  v_fy      text;
  v_no      text;
  v_id      uuid;
  v_applied numeric := 0;
begin
  perform public.assert_my_role('admin', 'manager');
  perform public._claim_document_request(p_request_id, 'record_supplier_payment');
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
    raise exception 'Payment date cannot be in the future' using errcode = '22023';
  end if;
  if not exists (select 1 from public.suppliers where id = p_supplier_id and org_id = v_org) then
    raise exception 'Supplier not found' using errcode = 'P0002';
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
    if p_tds_code is null or p_tds_code !~ '^[0-9]{4}$' then
      raise exception 'Choose the TDS payment code, like 1031' using errcode = '22023';
    end if;
    if p_tds_rate is null or p_tds_rate <= 0 or p_tds_rate > 100 or round(p_tds_rate, 3) <> p_tds_rate then
      raise exception 'Give the TDS rate as a percentage, like 0.1 or 2' using errcode = '22023';
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
  v_no := 'PAY/' || v_fy || '/' || lpad(public.next_org_seq(v_org, 'pay:' || v_fy)::text, 4, '0');
  insert into public.supplier_payments (org_id, payment_no, payment_date, financial_year, supplier_id, amount, mode, reference, notes,
                                        tds_code, tds_rate, tds_base, tds_amount, created_by)
  values (v_org, v_no, v_date, v_fy, p_supplier_id, p_amount, p_mode, nullif(trim(p_reference), ''), nullif(trim(p_notes), ''),
          case when v_tds > 0 then p_tds_code end, case when v_tds > 0 then p_tds_rate end,
          case when v_tds > 0 then p_tds_base end, v_tds, auth.uid())
  returning id into v_id;
  -- The bills are settled by the money paid and the TDS together
  if p_allocations is not null and jsonb_typeof(p_allocations) = 'array' and jsonb_array_length(p_allocations) > 0 then
    v_applied := public._allocate_payment_explicit(v_id, p_allocations, p_amount + v_tds);
  elsif p_auto_allocate then
    v_applied := public._allocate_payment_fifo(v_id);
  end if;
  return jsonb_build_object('id', v_id, 'payment_no', v_no, 'amount', p_amount, 'tds', v_tds, 'settles', p_amount + v_tds,
                            'allocated', v_applied, 'unallocated', p_amount + v_tds - v_applied);
end;
$function$;

comment on function public.record_supplier_payment(uuid, numeric, text, date, text, text, jsonb, boolean, uuid, text, numeric, numeric, numeric) is
  'Records a payment to a supplier, numbered PAY/<fy>/<nnnn>, optionally deducting TDS (code, rate, the amount it was worked out on, and TDS). The money paid plus TDS settles bills: the ones given in p_allocations, or else the oldest due first. Admin and manager. p_request_id makes a retried submission safe.';

-- Cash and TDS together settle bills
create or replace function public._allocate_payment_fifo(p_payment_id uuid)
returns numeric language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_pay   public.supplier_payments;
  v_left  numeric;
  v_bill  record;
  v_take  numeric;
  v_total numeric := 0;
begin
  select * into v_pay from public.supplier_payments where id = p_payment_id for update;
  if not found or v_pay.status <> 'active' then
    return 0;
  end if;
  v_left := v_pay.gross_amount - v_pay.amount_allocated;
  for v_bill in
    select id, balance_due from public.supplier_bills
    where org_id = v_pay.org_id and supplier_id = v_pay.supplier_id and status = 'posted' and balance_due > 0
    order by due_date, bill_date, bill_no
    for update
  loop
    exit when v_left <= 0;
    v_take := least(v_left, v_bill.balance_due);
    insert into public.supplier_payment_allocations (org_id, payment_id, bill_id, amount, created_by)
    values (v_pay.org_id, p_payment_id, v_bill.id, v_take, auth.uid())
    on conflict (payment_id, bill_id) do update set amount = public.supplier_payment_allocations.amount + excluded.amount;
    perform public._recalc_bill_paid(v_bill.id);
    v_left := v_left - v_take;
    v_total := v_total + v_take;
  end loop;
  perform public._recalc_payment_allocated(p_payment_id);
  return v_total;
end;
$function$;

create or replace function public.allocate_supplier_payment(p_payment_id uuid, p_allocations jsonb default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
  v_pay public.supplier_payments;
  v_sum numeric;
begin
  perform public.assert_my_role('admin', 'manager');
  select * into v_pay from public.supplier_payments where id = p_payment_id and org_id = v_org for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  if v_pay.status <> 'active' then
    raise exception 'Payment % is cancelled', v_pay.payment_no using errcode = 'P0008';
  end if;
  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) = 0 then
    v_sum := public._allocate_payment_fifo(p_payment_id);
  else
    v_sum := public._allocate_payment_explicit(p_payment_id, p_allocations, v_pay.gross_amount - v_pay.amount_allocated);
  end if;
  return jsonb_build_object('id', p_payment_id, 'allocated', v_sum);
end;
$function$;

-- Payables: paid is money paid; TDS shown beside it; advance counts both
create or replace view public.v_supplier_payables with (security_invoker = true) as
  with bill as (
    select supplier_id,
           sum(total_amount) as billed,
           sum(amount_debited) as debited,
           sum(balance_due) as outstanding,
           sum(balance_due) filter (where due_date >= current_date) as not_due,
           sum(balance_due) filter (where current_date - due_date between 1 and 30) as d1_30,
           sum(balance_due) filter (where current_date - due_date between 31 and 60) as d31_60,
           sum(balance_due) filter (where current_date - due_date between 61 and 90) as d61_90,
           sum(balance_due) filter (where current_date - due_date > 90) as d90_plus,
           min(due_date) filter (where balance_due > 0) as next_due
    from public.supplier_bills where status = 'posted' group by supplier_id
  ), pay as (
    select supplier_id, sum(amount) as paid, sum(gross_amount - amount_allocated) as advance, sum(tds_amount) as tds
    from public.supplier_payments where status = 'active' group by supplier_id
  )
  select s.id as supplier_id, s.org_id, s.name as supplier_name, s.credit_days,
         coalesce(bill.billed, 0) as billed,
         coalesce(bill.debited, 0) as debited,
         coalesce(pay.paid, 0) as paid,
         coalesce(bill.outstanding, 0) as outstanding,
         coalesce(bill.not_due, 0) as not_due,
         coalesce(bill.d1_30, 0) as overdue_1_30,
         coalesce(bill.d31_60, 0) as overdue_31_60,
         coalesce(bill.d61_90, 0) as overdue_61_90,
         coalesce(bill.d90_plus, 0) as overdue_90_plus,
         coalesce(bill.d1_30, 0) + coalesce(bill.d31_60, 0) + coalesce(bill.d61_90, 0) + coalesce(bill.d90_plus, 0) as overdue,
         coalesce(pay.advance, 0) as advance,
         bill.next_due,
         coalesce(pay.tds, 0) as tds
  from public.suppliers s
  left join bill on bill.supplier_id = s.id
  left join pay on pay.supplier_id = s.id
  where bill.supplier_id is not null or pay.supplier_id is not null;


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
    -- TDS deducted on a payment settles the supplier's account like money paid
    select y.payment_date, y.created_at, 'tds', y.id, y.payment_no,
           'Code ' || y.tds_code || ' at ' || rtrim(rtrim(y.tds_rate::text, '0'), '.') || '% of ' || y.tds_base::text,
           y.tds_amount, 0, 2
    from public.supplier_payments y
    where y.org_id = v_org and y.supplier_id = p_supplier_id and y.status = 'active' and y.tds_amount > 0 and y.payment_date <= p_to
    union all
    select n.note_date, n.created_at, 'debit_note', n.id, n.debit_note_no, n.reason, n.total_amount, 0, 1
    from public.debit_notes n
    where n.org_id = v_org and n.supplier_id = p_supplier_id and n.status = 'issued' and n.note_date <= p_to
  ),
  opening as (
    select coalesce(sum(e.cr - e.dr), 0) as amount from entries e where e.d < p_from
  ),
  period as (
    select e.*, (row_number() over (order by e.d, e.at, e.tie, e.no, e.k))::integer as rn
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

-- ── TDS deposits are money out ─────────────────────────────────
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
      select deposit_date, -amount from public.tds_deposits
      where org_id = v_org and status = 'active' and (mode = 'cash') = (v_acc = 'cash')
        and deposit_date > v_open.as_of and deposit_date <= p_to
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

do $$ begin
  execute 'alter table public.bank_clearings drop constraint bank_clearings_doc_type_check';
end $$;
alter table public.bank_clearings add constraint bank_clearings_doc_type_check
  check (doc_type in ('receipt', 'supplier_payment', 'expense', 'income', 'gst_payment', 'tds_deposit', 'funding', 'asset_purchase', 'asset_sale', 'transfer'));

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
select d.org_id, 'tds_deposit', d.id, d.deposit_no, d.deposit_date, d.created_at,
       'TDS deposit', 'For ' || to_char(to_date(d.period || '-01', 'YYYY-MM-DD'), 'Mon YYYY'),
       d.mode, d.reference,
       0, d.amount, bc.bank_date
from public.tds_deposits d
left join public.bank_clearings bc on bc.org_id = d.org_id and bc.doc_type = 'tds_deposit' and bc.doc_id = d.id
where d.status = 'active' and d.mode <> 'cash'
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
    if e.doc_type is null or e.doc_type not in ('receipt', 'supplier_payment', 'expense', 'income', 'gst_payment', 'tds_deposit', 'funding', 'asset_purchase', 'asset_sale', 'transfer') then
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
      when 'tds_deposit' then
        select deposit_date, status, mode, deposit_no into v_date, v_status, v_mode, v_no
        from public.tds_deposits where id = e.doc_id and org_id = v_org;
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

-- ── Profit and loss: TDS interest and late fee are an expense ─
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

-- ── Financial position: TDS still to deposit ──────────────────
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
  v_tds     jsonb;
  v_tds_bal numeric;
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

  -- Suppliers: bills less payments (money paid plus TDS) and debit notes, per supplier
  select coalesce(sum(bal) filter (where bal >= 0.005), 0), count(*) filter (where bal >= 0.005),
         coalesce(-sum(bal) filter (where bal <= -0.005), 0), count(*) filter (where bal <= -0.005)
  into v_pay, v_pay_n, v_sadv, v_sadv_n
  from (
    select supplier_id, sum(amt) as bal
    from (
      select supplier_id, total_amount as amt from public.supplier_bills
      where org_id = v_org and status = 'posted' and bill_date <= p_as_of
      union all
      select supplier_id, -gross_amount from public.supplier_payments
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

  -- TDS deducted and not yet deposited is owed to the government; null before
  -- a TDS opening day
  v_tds := public.tds_ledger(p_as_of);
  v_tds_bal := case when (v_tds ->> 'set')::boolean then (v_tds ->> 'balance')::numeric end;

  v_assets := coalesce(v_cash, 0) + coalesce(v_bank, 0) + v_recv + v_sadv + v_stock + greatest(-coalesce(v_gst_bal, 0), 0) + greatest(-coalesce(v_tds_bal, 0), 0) + v_fa_val;
  v_owed := v_pay + v_cadv + greatest(coalesce(v_gst_bal, 0), 0) + greatest(coalesce(v_tds_bal, 0), 0) + v_loans;

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
    'tds', jsonb_build_object('set', v_tds_bal is not null, 'balance', round(v_tds_bal, 2), 'opening_as_of', v_tds -> 'opening_as_of'),
    'loans', v_fund -> 'loans',
    'capital', v_fund -> 'capital',
    'fixed_assets', jsonb_build_object('amount', round(v_fa_val, 2), 'assets', (v_fa -> 'totals' ->> 'in_use')::integer),
    'total_owned', round(v_assets, 2),
    'total_owed', round(v_owed, 2),
    'net_worth', round(v_assets - v_owed, 2)
  );
end;
$function$;

do $$ begin
  execute 'revoke all on function public.set_tds_opening(date, numeric) from public, anon';
  execute 'revoke all on function public.record_tds_deposit(date, text, numeric, numeric, numeric, text, text, text, text, uuid) from public, anon';
  execute 'revoke all on function public.cancel_tds_deposit(uuid, text) from public, anon';
  execute 'revoke all on function public.tds_ledger(date) from public, anon';
  execute 'revoke all on function public.tds_due_date(text) from public, anon';
  execute 'revoke all on function public.record_supplier_payment(uuid, numeric, text, date, text, text, jsonb, boolean, uuid, text, numeric, numeric, numeric) from public, anon';
  execute 'revoke all on public.v_supplier_payables, public.v_bank_entries from anon';
end $$;
grant execute on function public.set_tds_opening(date, numeric) to authenticated;
grant execute on function public.record_tds_deposit(date, text, numeric, numeric, numeric, text, text, text, text, uuid) to authenticated;
grant execute on function public.cancel_tds_deposit(uuid, text) to authenticated;
grant execute on function public.tds_ledger(date) to authenticated;
grant execute on function public.tds_due_date(text) to authenticated;
grant execute on function public.record_supplier_payment(uuid, numeric, text, date, text, text, jsonb, boolean, uuid, text, numeric, numeric, numeric) to authenticated;
