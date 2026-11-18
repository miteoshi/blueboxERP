-- ─────────────────────────────────────────────────────────────
-- Expenses: money paid out that is neither a supplier bill nor
-- stock — rent, wages, electricity, freight, bank charges.
--
-- expense_heads   the categories an organisation files expenses under
-- expenses        one row per payment, numbered EXP/<fy>/<nnnn>
--
-- Like supplier payments: read by admin, manager and viewer; written
-- only through the functions below (admin and manager); never deleted,
-- only cancelled with a reason. The amount is what was paid in full.
-- GST on an expense is not split out, so expenses add nothing to input
-- credit in the GST position.
-- ─────────────────────────────────────────────────────────────

create table public.expense_heads (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id),
  name       text not null check (length(trim(name)) between 1 and 60),
  is_active  boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create unique index expense_heads_org_name_key on public.expense_heads (org_id, lower(name));
create index expense_heads_created_by_idx on public.expense_heads (created_by);

comment on table public.expense_heads is
  'Categories for expenses (Rent, Wages, Electricity…). Written through save_expense_head().';

create table public.expenses (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id),
  expense_no     text not null,
  expense_date   date not null,
  financial_year text not null,
  head_id        uuid not null references public.expense_heads(id),
  payee          text,
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
  constraint expenses_org_no_key unique (org_id, expense_no)
);
create index expenses_org_date_idx on public.expenses (org_id, expense_date);
create index expenses_head_idx on public.expenses (head_id);
create index expenses_created_by_idx on public.expenses (created_by);
create index expenses_cancelled_by_idx on public.expenses (cancelled_by);

comment on table public.expenses is
  'Money paid out that is not a supplier bill. Written through record_expense() and cancel_expense(); rows are cancelled, never deleted.';

create trigger trg_aud_expense_heads after insert or update or delete on public.expense_heads
  for each row execute function public.write_audit_log();
create trigger trg_aud_expenses after insert or update or delete on public.expenses
  for each row execute function public.write_audit_log();

alter table public.expense_heads enable row level security;
alter table public.expenses enable row level security;

create policy "payables roles read expense heads" on public.expense_heads for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'viewer'));
create policy "payables roles read expenses" on public.expenses for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'viewer'));

do $$ begin
  execute 'revoke all on public.expense_heads, public.expenses from anon';
  execute 'revoke insert, update, delete, truncate, references, trigger on public.expense_heads, public.expenses from authenticated';
end $$;
grant select on public.expense_heads, public.expenses to authenticated;

-- ── Starting heads ────────────────────────────────────────────
create function public._seed_expense_heads(p_org_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  insert into public.expense_heads (org_id, name)
  select p_org_id, h.name
  from (values
    ('Rent'), ('Salaries and wages'), ('Electricity'), ('Freight and transport'),
    ('Repairs and maintenance'), ('Office expenses'), ('Telephone and internet'),
    ('Bank charges'), ('Professional fees'), ('Travel'), ('Other')
  ) as h(name)
  on conflict do nothing;
$function$;

create function public._seed_expense_heads_for_new_org()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public._seed_expense_heads(new.id);
  return new;
end;
$function$;

create trigger trg_seed_expense_heads after insert on public.organizations
  for each row execute function public._seed_expense_heads_for_new_org();

-- Organisations that already exist get the same starting list
select public._seed_expense_heads(o.id) from public.organizations o;

-- ── Heads ─────────────────────────────────────────────────────
create function public.save_expense_head(
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
    raise exception 'Give the expense head a name' using errcode = '22023';
  end if;
  if length(v_name) > 60 then
    raise exception 'An expense head name can be at most 60 characters' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.expense_heads
    where org_id = v_org and lower(name) = lower(v_name) and id is distinct from p_id
  ) then
    raise exception 'There is already an expense head called %', v_name using errcode = 'P0008';
  end if;

  if p_id is null then
    insert into public.expense_heads (org_id, name, is_active, created_by)
    values (v_org, v_name, coalesce(p_is_active, true), auth.uid())
    returning id into v_id;
  else
    update public.expense_heads
    set name = v_name, is_active = coalesce(p_is_active, true)
    where id = p_id and org_id = v_org
    returning id into v_id;
    if v_id is null then
      raise exception 'Expense head not found' using errcode = 'P0002';
    end if;
  end if;
  return jsonb_build_object('id', v_id, 'name', v_name, 'is_active', coalesce(p_is_active, true));
end;
$function$;

comment on function public.save_expense_head(text, uuid, boolean) is
  'Adds an expense head, or renames / switches one on or off when p_id is given. Admin and manager.';

-- ── Expenses ──────────────────────────────────────────────────
create function public.record_expense(
  p_head_id uuid,
  p_amount numeric,
  p_mode text,
  p_expense_date date default null,
  p_payee text default null,
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
  v_date date := coalesce(p_expense_date, current_date);
  v_head public.expense_heads;
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

  v_fy := public.financial_year(v_date);
  v_no := 'EXP/' || v_fy || '/' || lpad(public.next_org_seq(v_org, 'exp:' || v_fy)::text, 4, '0');
  insert into public.expenses (org_id, expense_no, expense_date, financial_year, head_id, payee, amount, mode, reference, notes, created_by)
  values (v_org, v_no, v_date, v_fy, p_head_id, nullif(trim(p_payee), ''), p_amount, p_mode,
          nullif(trim(p_reference), ''), nullif(trim(p_notes), ''), auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'expense_no', v_no, 'amount', p_amount);
end;
$function$;

comment on function public.record_expense(uuid, numeric, text, date, text, text, text, uuid) is
  'Records one expense under a head and numbers it EXP/<fy>/<nnnn>. Admin and manager. p_request_id makes a retried submission safe.';

create function public.cancel_expense(p_expense_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
  v_exp public.expenses;
begin
  perform public.assert_my_role('admin', 'manager');
  if nullif(trim(p_reason), '') is null then
    raise exception 'Give a reason for cancelling the expense' using errcode = '22023';
  end if;
  select * into v_exp from public.expenses where id = p_expense_id and org_id = v_org for update;
  if not found then
    raise exception 'Expense not found' using errcode = 'P0002';
  end if;
  if v_exp.status = 'cancelled' then
    raise exception 'Expense % is already cancelled', v_exp.expense_no using errcode = 'P0008';
  end if;
  update public.expenses
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), cancel_reason = trim(p_reason)
  where id = p_expense_id;
  return jsonb_build_object('id', p_expense_id, 'expense_no', v_exp.expense_no, 'status', 'cancelled');
end;
$function$;

comment on function public.cancel_expense(uuid, text) is
  'Cancels an expense with a reason; the row is kept. Admin and manager.';

do $$ begin
  execute 'revoke all on function public._seed_expense_heads(uuid) from public, anon, authenticated';
  execute 'revoke all on function public._seed_expense_heads_for_new_org() from public, anon, authenticated';
  execute 'revoke all on function public.save_expense_head(text, uuid, boolean) from public, anon';
  execute 'revoke all on function public.record_expense(uuid, numeric, text, date, text, text, text, uuid) from public, anon';
  execute 'revoke all on function public.cancel_expense(uuid, text) from public, anon';
end $$;
grant execute on function public.save_expense_head(text, uuid, boolean) to authenticated;
grant execute on function public.record_expense(uuid, numeric, text, date, text, text, text, uuid) to authenticated;
grant execute on function public.cancel_expense(uuid, text) to authenticated;
