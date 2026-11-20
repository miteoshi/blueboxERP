-- ─────────────────────────────────────────────────────────────
-- Owner's capital, drawings and loans taken.
--
-- funding_accounts   one per capital account (an owner or partner) or loan
--                    (a bank, a person), with the balance on an opening day
-- funding_entries    money in or out of such an account after that day:
--                      capital: in = capital introduced, out = drawings
--                      loan:    in = loan received, out = repayment, whose
--                               principal and interest are kept apart
--                    numbered CAP/<fy>/<nnnn> and LOAN/<fy>/<nnnn>;
--                    cancelled, never deleted
-- funding_balances() each account's balance on a day
--
-- An entry also counts in:
--   money_balances()     money in or out of bank or cash, by mode
--   v_bank_entries / set_bank_dates()   bank reconciliation (funding)
--   profit_and_loss()    loan interest as the expense line "Interest on loans";
--                        capital, drawings and loan principal are not income
--                        or expense
--   financial_position() loans still owed; capital accounts reported alongside.
--                        Net worth then moves by profit + capital introduced
--                        - drawings
--
-- Read by admin, manager and viewer; written through the functions below
-- by admin and manager.
-- ─────────────────────────────────────────────────────────────

create table public.funding_accounts (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id),
  kind             text not null check (kind in ('capital', 'loan')),
  name             text not null check (length(trim(name)) between 1 and 120),
  opening_as_of    date not null,
  opening_balance  numeric(14,2) not null default 0 check (opening_balance >= 0),
  is_active        boolean not null default true,
  notes            text,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint funding_accounts_org_id_id_key unique (org_id, id)
);
create unique index funding_accounts_org_name_key on public.funding_accounts (org_id, lower(name));
create index funding_accounts_created_by_idx on public.funding_accounts (created_by);

comment on table public.funding_accounts is
  'Capital accounts (owners, partners) and loans taken, with the balance on an opening day. Written through save_funding_account().';

create table public.funding_entries (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id),
  account_id      uuid not null,
  entry_no        text not null,
  entry_date      date not null,
  financial_year  text not null,
  direction       text not null check (direction in ('in', 'out')),
  amount          numeric(14,2) not null default 0 check (amount >= 0),
  interest        numeric(14,2) not null default 0 check (interest >= 0),
  total           numeric(14,2) generated always as (amount + interest) stored,
  mode            text not null check (mode in ('cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other')),
  reference       text,
  notes           text,
  status          text not null default 'active' check (status in ('active', 'cancelled')),
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  cancelled_by    uuid references public.profiles(id),
  cancelled_at    timestamptz,
  cancel_reason   text,
  constraint funding_entries_account_fkey foreign key (org_id, account_id) references public.funding_accounts (org_id, id),
  constraint funding_entries_org_no_key unique (org_id, entry_no),
  constraint funding_entries_some_amount check (amount + interest > 0),
  constraint funding_entries_interest_on_repayment check (interest = 0 or direction = 'out')
);
create index funding_entries_org_date_idx on public.funding_entries (org_id, entry_date);
create index funding_entries_account_idx on public.funding_entries (org_id, account_id);
create index funding_entries_created_by_idx on public.funding_entries (created_by);
create index funding_entries_cancelled_by_idx on public.funding_entries (cancelled_by);

comment on table public.funding_entries is
  'Capital introduced, drawings, loans received and repaid (principal and interest). Written through record_funding_entry() and cancel_funding_entry(); rows are cancelled, never deleted.';

create trigger trg_aud_funding_accounts after insert or update or delete on public.funding_accounts
  for each row execute function public.write_audit_log();
create trigger trg_aud_funding_entries after insert or update or delete on public.funding_entries
  for each row execute function public.write_audit_log();

alter table public.funding_accounts enable row level security;
alter table public.funding_entries enable row level security;

create policy "payables roles read funding accounts" on public.funding_accounts for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'viewer'));
create policy "payables roles read funding entries" on public.funding_entries for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'viewer'));

do $$ begin
  execute 'revoke all on public.funding_accounts, public.funding_entries from anon';
  execute 'revoke insert, update, delete, truncate, references, trigger on public.funding_accounts, public.funding_entries from authenticated';
end $$;
grant select on public.funding_accounts, public.funding_entries to authenticated;

-- What is still owed on a loan, counting every active entry (any date)
create function public._loan_outstanding(p_account_id uuid, p_skip_entry uuid default null)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $function$
  select a.opening_balance
       + coalesce(sum(case e.direction when 'in' then e.amount else -e.amount end)
                  filter (where e.status = 'active' and e.id is distinct from p_skip_entry), 0)
  from public.funding_accounts a
  left join public.funding_entries e on e.org_id = a.org_id and e.account_id = a.id
  where a.id = p_account_id
  group by a.id, a.opening_balance;
$function$;

-- ── Accounts ──────────────────────────────────────────────────
create function public.save_funding_account(
  p_kind text,
  p_name text,
  p_opening_as_of date,
  p_opening_balance numeric default 0,
  p_notes text default null,
  p_id uuid default null,
  p_is_active boolean default true
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org   uuid := public.my_org();
  v_name  text := nullif(trim(p_name), '');
  v_acc   public.funding_accounts;
  v_id    uuid;
  v_first date;
  v_kind  text;
begin
  perform public.assert_my_role('admin', 'manager');
  if v_name is null then
    raise exception 'Give the account a name' using errcode = '22023';
  end if;
  if length(v_name) > 120 then
    raise exception 'The name can be at most 120 characters' using errcode = '22023';
  end if;
  if p_opening_as_of is null then
    raise exception 'Choose the opening date' using errcode = '22023';
  end if;
  if p_opening_as_of > current_date then
    raise exception 'The opening date cannot be in the future' using errcode = '22023';
  end if;
  if p_opening_balance is null or p_opening_balance < 0 then
    raise exception 'The opening balance cannot be negative' using errcode = '22023';
  end if;
  if round(p_opening_balance, 2) <> p_opening_balance then
    raise exception 'The opening balance can have at most 2 decimals' using errcode = '22023';
  end if;
  if p_opening_balance >= 1000000000000 then
    raise exception 'Amount is too large' using errcode = '22023';
  end if;

  begin
    if p_id is null then
      if p_kind is null or p_kind not in ('capital', 'loan') then
        raise exception 'Unknown account type %', coalesce(p_kind, 'none') using errcode = '22023';
      end if;
      insert into public.funding_accounts (org_id, kind, name, opening_as_of, opening_balance, notes, is_active, created_by)
      values (v_org, p_kind, v_name, p_opening_as_of, p_opening_balance, nullif(trim(p_notes), ''), coalesce(p_is_active, true), auth.uid())
      returning id, kind into v_id, v_kind;
    else
      select * into v_acc from public.funding_accounts where id = p_id and org_id = v_org for update;
      if not found then
        raise exception 'Account not found' using errcode = 'P0002';
      end if;
      if p_kind is not null and p_kind <> v_acc.kind then
        raise exception 'The type of an account cannot be changed' using errcode = '22023';
      end if;
      -- Entries on or before the opening date would silently drop out
      select min(entry_date) into v_first
      from public.funding_entries where org_id = v_org and account_id = p_id and status = 'active';
      if v_first is not null and v_first <= p_opening_as_of then
        raise exception 'Entries from % are already recorded; the opening date must be before them', to_char(v_first, 'DD Mon YYYY')
          using errcode = '22023';
      end if;
      update public.funding_accounts
      set name = v_name, opening_as_of = p_opening_as_of, opening_balance = p_opening_balance,
          notes = nullif(trim(p_notes), ''), is_active = coalesce(p_is_active, true), updated_at = now()
      where id = p_id;
      v_id := p_id;
      v_kind := v_acc.kind;
    end if;
  exception when unique_violation then
    raise exception 'An account named % already exists', v_name using errcode = 'P0008';
  end;

  if v_kind = 'loan' and public._loan_outstanding(v_id) < 0 then
    raise exception 'The repayments recorded are more than this loan with that opening balance' using errcode = '22023';
  end if;
  return jsonb_build_object('id', v_id, 'name', v_name, 'kind', v_kind);
end;
$function$;

comment on function public.save_funding_account(text, text, date, numeric, text, uuid, boolean) is
  'Creates a capital or loan account, or (with p_id) renames it, changes its opening balance or closes it. The type cannot change. Admin and manager.';

-- ── Entries ───────────────────────────────────────────────────
create function public.record_funding_entry(
  p_account_id uuid,
  p_direction text,
  p_amount numeric,
  p_interest numeric default 0,
  p_entry_date date default null,
  p_mode text default 'bank_transfer',
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
  v_date  date := coalesce(p_entry_date, current_date);
  v_acc   public.funding_accounts;
  v_owed  numeric;
  v_fy    text;
  v_no    text;
  v_id    uuid;
begin
  perform public.assert_my_role('admin', 'manager');
  perform public._claim_document_request(p_request_id, 'record_funding_entry');
  -- Locked so two repayments cannot both pass the check below
  select * into v_acc from public.funding_accounts where id = p_account_id and org_id = v_org for update;
  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  if not v_acc.is_active then
    raise exception '% is closed', v_acc.name using errcode = 'P0008';
  end if;
  if p_direction is null or p_direction not in ('in', 'out') then
    raise exception 'Unknown direction %', coalesce(p_direction, 'none') using errcode = '22023';
  end if;
  if p_amount is null or p_amount < 0 or p_interest is null or p_interest < 0 then
    raise exception 'Amounts cannot be negative' using errcode = '22023';
  end if;
  if round(p_amount, 2) <> p_amount or round(p_interest, 2) <> p_interest then
    raise exception 'Amounts can have at most 2 decimals' using errcode = '22023';
  end if;
  if p_interest > 0 and (v_acc.kind <> 'loan' or p_direction <> 'out') then
    raise exception 'Interest goes only with a loan repayment' using errcode = '22023';
  end if;
  if p_amount + p_interest <= 0 then
    raise exception 'Enter the amount' using errcode = '22023';
  end if;
  if p_amount + p_interest >= 1000000000000 then
    raise exception 'Amount is too large' using errcode = '22023';
  end if;
  if p_mode is null or p_mode not in ('cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other') then
    raise exception 'Unknown payment mode %', p_mode using errcode = '22023';
  end if;
  if v_date > current_date then
    raise exception 'The date cannot be in the future' using errcode = '22023';
  end if;
  if v_date <= v_acc.opening_as_of then
    raise exception 'The date must be after the opening date of % (%); earlier movements are in its opening balance',
      v_acc.name, to_char(v_acc.opening_as_of, 'DD Mon YYYY') using errcode = '22023';
  end if;
  if v_acc.kind = 'loan' and p_direction = 'out' and p_amount > 0 then
    v_owed := public._loan_outstanding(v_acc.id);
    if p_amount > v_owed then
      raise exception 'Repayment of % is more than the % still owed on %', p_amount, v_owed, v_acc.name using errcode = '22023';
    end if;
  end if;

  v_fy := public.financial_year(v_date);
  v_no := case v_acc.kind when 'capital' then 'CAP/' else 'LOAN/' end || v_fy || '/'
       || lpad(public.next_org_seq(v_org, case v_acc.kind when 'capital' then 'cap:' else 'loan:' end || v_fy)::text, 4, '0');
  insert into public.funding_entries (org_id, account_id, entry_no, entry_date, financial_year, direction, amount, interest, mode, reference, notes, created_by)
  values (v_org, v_acc.id, v_no, v_date, v_fy, p_direction, p_amount, p_interest, p_mode,
          nullif(trim(p_reference), ''), nullif(trim(p_notes), ''), auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'entry_no', v_no, 'total', p_amount + p_interest);
end;
$function$;

comment on function public.record_funding_entry(uuid, text, numeric, numeric, date, text, text, text, uuid) is
  'Records capital introduced or drawings (capital account), or a loan received or repaid (loan account; interest only on repayments), numbered CAP/<fy>/<nnnn> or LOAN/<fy>/<nnnn>. A repayment cannot exceed what is still owed. Admin and manager. p_request_id makes a retried submission safe.';

create function public.cancel_funding_entry(p_entry_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
  v_e   public.funding_entries;
  v_acc public.funding_accounts;
begin
  perform public.assert_my_role('admin', 'manager');
  if nullif(trim(p_reason), '') is null then
    raise exception 'Give a reason for cancelling the entry' using errcode = '22023';
  end if;
  select * into v_e from public.funding_entries where id = p_entry_id and org_id = v_org;
  if not found then
    raise exception 'Entry not found' using errcode = 'P0002';
  end if;
  -- Account first, then the entry, in the same order as record_funding_entry()
  select * into v_acc from public.funding_accounts where id = v_e.account_id and org_id = v_org for update;
  select * into v_e from public.funding_entries where id = p_entry_id for update;
  if v_e.status = 'cancelled' then
    raise exception '% is already cancelled', v_e.entry_no using errcode = 'P0008';
  end if;
  if v_acc.kind = 'loan' and v_e.direction = 'in' and public._loan_outstanding(v_acc.id, v_e.id) < 0 then
    raise exception 'Cancelling % would leave repayments of % more than the loan; cancel a repayment first', v_e.entry_no, v_acc.name
      using errcode = '22023';
  end if;
  update public.funding_entries
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), cancel_reason = trim(p_reason)
  where id = p_entry_id;
  return jsonb_build_object('id', p_entry_id, 'entry_no', v_e.entry_no, 'status', 'cancelled');
end;
$function$;

comment on function public.cancel_funding_entry(uuid, text) is
  'Cancels a capital or loan entry with a reason; the row is kept. A loan received cannot be cancelled while its repayments would then exceed it. Admin and manager.';

-- ── Balances ──────────────────────────────────────────────────
create function public.funding_balances(p_as_of date)
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'public'
as $function$
declare
  v_org  uuid := public.my_org();
  v_role public.user_role := public.my_role();
  v_rows jsonb;
begin
  if v_role is null or v_role not in ('admin', 'manager', 'viewer') then
    raise exception 'Unauthorized: your role (%) cannot see capital and loans', coalesce(v_role::text, 'none')
      using errcode = 'P0005';
  end if;
  if p_as_of is null then
    raise exception 'Choose the day' using errcode = '22023';
  end if;

  with acc as (
    select a.id, a.kind, a.name, a.is_active, a.opening_as_of, a.opening_balance,
           p_as_of >= a.opening_as_of as started,
           coalesce(sum(e.amount) filter (where e.direction = 'in'), 0) as received,
           coalesce(sum(e.amount) filter (where e.direction = 'out'), 0) as paid_out,
           coalesce(sum(e.interest), 0) as interest
    from public.funding_accounts a
    left join public.funding_entries e
      on e.org_id = a.org_id and e.account_id = a.id and e.status = 'active'
     and e.entry_date > a.opening_as_of and e.entry_date <= p_as_of
    where a.org_id = v_org
    group by a.id
  )
  select jsonb_build_object(
    'as_of', p_as_of,
    'accounts', coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'kind', kind, 'name', name, 'is_active', is_active,
        'opening_as_of', opening_as_of, 'opening_balance', opening_balance, 'started', started,
        'received', case when started then round(received, 2) end,
        'paid_out', case when started then round(paid_out, 2) end,
        'interest', case when started then round(interest, 2) end,
        'balance', case when started then round(opening_balance + received - paid_out, 2) end)
      order by kind, lower(name)), '[]'::jsonb),
    'capital', jsonb_build_object(
      'amount', round(coalesce(sum(opening_balance + received - paid_out) filter (where kind = 'capital' and started), 0), 2),
      'accounts', count(*) filter (where kind = 'capital' and started)),
    'loans', jsonb_build_object(
      'amount', round(coalesce(sum(opening_balance + received - paid_out) filter (where kind = 'loan' and started), 0), 2),
      'accounts', count(*) filter (where kind = 'loan' and started and opening_balance + received - paid_out >= 0.005)),
    'not_started', count(*) filter (where not started))
  into v_rows
  from acc;
  return v_rows;
end;
$function$;

comment on function public.funding_balances(date) is
  'Each capital and loan account at the end of a day: opening balance + money in - money out (principal) since the opening date, and loan interest paid. Accounts whose opening date is after the day are left out of the totals. Admin, manager and viewer.';

-- ── Bank reconciliation takes capital and loan entries too ────
alter table public.bank_clearings drop constraint bank_clearings_doc_type_check;
alter table public.bank_clearings add constraint bank_clearings_doc_type_check
  check (doc_type in ('receipt', 'supplier_payment', 'expense', 'income', 'gst_payment', 'funding', 'transfer'));
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
select t.org_id, 'transfer', t.id, t.transfer_no, t.transfer_date, t.created_at,
       case t.direction when 'cash_to_bank' then 'Cash deposited in bank' else 'Cash drawn from bank' end, null, 'transfer', t.reference,
       case t.direction when 'cash_to_bank' then t.amount else 0 end,
       case t.direction when 'bank_to_cash' then t.amount else 0 end,
       bc.bank_date
from public.money_transfers t
left join public.bank_clearings bc on bc.org_id = t.org_id and bc.doc_type = 'transfer' and bc.doc_id = t.id
where t.status = 'active';

comment on view public.v_bank_entries is
  'Active receipts, supplier payments, expenses, other income, GST challans, capital and loan entries not in cash, and cash/bank transfers, with the bank date if one is set. Reads with the caller''s rights.';

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
    if e.doc_type is null or e.doc_type not in ('receipt', 'supplier_payment', 'expense', 'income', 'gst_payment', 'funding', 'transfer') then
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
  'Sets the bank date of bank-side entries, or clears it when bank_date is null: [{doc_type, doc_id, bank_date}], doc_type receipt | supplier_payment | expense | income | gst_payment | funding | transfer. All or nothing, up to 500. Admin and manager.';

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
  'Cash and bank balance at the start of a period (end of the day before p_from) and at the end of p_to, from the opening balance and the receipts, other income, supplier payments, expenses, GST challans, capital and loan entries, and cash/bank transfers recorded since. Null where the day is before the opening date. Admin, manager and viewer.';

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
    ) e
    group by head
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
  'Profit and loss for a period: net sales (taxable), cost of goods sold as opening stock + goods received - returns to suppliers - closing stock at a running average cost per item, expenses (including GST interest and late fee, and interest on loans) and other income by head, gross and net profit. Admin, manager and viewer.';

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

  v_assets := coalesce(v_cash, 0) + coalesce(v_bank, 0) + v_recv + v_sadv + v_stock + greatest(-coalesce(v_gst_bal, 0), 0);
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
    'total_owned', round(v_assets, 2),
    'total_owed', round(v_owed, 2),
    'net_worth', round(v_assets - v_owed, 2)
  );
end;
$function$;

comment on function public.financial_position(date) is
  'What the business owns (cash, bank, money owed by customers, advances paid to suppliers, stock at running average cost, GST credit) and owes (money owed to suppliers, advances from customers, GST payable, loans) with the capital accounts alongside at the end of a day, from what is recorded in the app. Cash, bank and GST are null until their opening position is set. Admin, manager and viewer.';

do $$ begin
  execute 'revoke all on function public._loan_outstanding(uuid, uuid) from public, anon, authenticated';
  execute 'revoke all on function public.save_funding_account(text, text, date, numeric, text, uuid, boolean) from public, anon';
  execute 'revoke all on function public.record_funding_entry(uuid, text, numeric, numeric, date, text, text, text, uuid) from public, anon';
  execute 'revoke all on function public.cancel_funding_entry(uuid, text) from public, anon';
  execute 'revoke all on function public.funding_balances(date) from public, anon';
  execute 'revoke all on function public.set_bank_dates(jsonb) from public, anon';
  execute 'revoke all on function public.money_balances(date, date) from public, anon';
  execute 'revoke all on function public.profit_and_loss(date, date) from public, anon';
  execute 'revoke all on function public.financial_position(date) from public, anon';
end $$;
grant execute on function public.save_funding_account(text, text, date, numeric, text, uuid, boolean) to authenticated;
grant execute on function public.record_funding_entry(uuid, text, numeric, numeric, date, text, text, text, uuid) to authenticated;
grant execute on function public.cancel_funding_entry(uuid, text) to authenticated;
grant execute on function public.funding_balances(date) to authenticated;
grant execute on function public.set_bank_dates(jsonb) to authenticated;
grant execute on function public.money_balances(date, date) to authenticated;
grant execute on function public.profit_and_loss(date, date) to authenticated;
grant execute on function public.financial_position(date) to authenticated;
