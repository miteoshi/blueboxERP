-- ─────────────────────────────────────────────────────────────
-- Cash and bank balances.
--
-- money_openings   one opening balance per organisation for 'cash' and
--                  one for 'bank', as at a date the user chooses (usually
--                  the day before they started recording in the app)
--
-- money_balances(p_from, p_to) works out, for cash and for bank, the
-- balance at the start of the period (end of p_from − 1) and at the end
-- of p_to:
--
--   opening balance
-- + customer receipts      (active)
-- − supplier payments      (active)
-- − expenses               (active)
--   dated after the opening date and up to the day asked for.
--
-- Cash is everything recorded with mode 'cash'; bank is every other mode
-- (bank transfer, UPI, cheque, card, other). Movements dated on or before
-- the opening date are taken to be inside the opening balance. A balance
-- asked for a day before the opening date cannot be known and is null.
--
-- The amount can be negative (an overdrawn bank account).
-- ─────────────────────────────────────────────────────────────

create table public.money_openings (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id),
  account    text not null check (account in ('cash', 'bank')),
  as_of      date not null,
  amount     numeric(14,2) not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  constraint money_openings_org_account_key unique (org_id, account)
);
create index money_openings_updated_by_idx on public.money_openings (updated_by);

comment on table public.money_openings is
  'Opening cash and bank balance per organisation, as at a date. Written through set_money_opening().';

create trigger trg_aud_money_openings after insert or update or delete on public.money_openings
  for each row execute function public.write_audit_log();

alter table public.money_openings enable row level security;
create policy "payables roles read money openings" on public.money_openings for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'viewer'));

do $$ begin
  execute 'revoke all on public.money_openings from anon';
  execute 'revoke insert, update, delete, truncate, references, trigger on public.money_openings from authenticated';
end $$;
grant select on public.money_openings to authenticated;

create function public.set_money_opening(p_account text, p_as_of date, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
begin
  perform public.assert_my_role('admin', 'manager');
  if p_account is null or p_account not in ('cash', 'bank') then
    raise exception 'Choose cash or bank' using errcode = '22023';
  end if;
  if p_as_of is null then
    raise exception 'Give the date the opening balance is as at' using errcode = '22023';
  end if;
  if p_as_of > current_date then
    raise exception 'The opening date cannot be in the future' using errcode = '22023';
  end if;
  if p_amount is null then
    raise exception 'Give the opening balance' using errcode = '22023';
  end if;
  if round(p_amount, 2) <> p_amount then
    raise exception 'Amount can have at most 2 decimals' using errcode = '22023';
  end if;
  if abs(p_amount) >= 1000000000000 then
    raise exception 'Amount is too large' using errcode = '22023';
  end if;

  insert into public.money_openings (org_id, account, as_of, amount, updated_by, updated_at)
  values (v_org, p_account, p_as_of, p_amount, auth.uid(), now())
  on conflict (org_id, account) do update
    set as_of = excluded.as_of, amount = excluded.amount, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  return jsonb_build_object('account', p_account, 'as_of', p_as_of, 'amount', p_amount);
end;
$function$;

comment on function public.set_money_opening(text, date, numeric) is
  'Sets the opening cash or bank balance as at a date (replaces any earlier one). Admin and manager.';

create function public.money_balances(p_from date, p_to date)
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
  'Cash and bank balance at the start of a period (end of the day before p_from) and at the end of p_to, from the opening balance and the receipts, supplier payments and expenses recorded since. Null where the day is before the opening date. Admin, manager and viewer.';

do $$ begin
  execute 'revoke all on function public.set_money_opening(text, date, numeric) from public, anon';
  execute 'revoke all on function public.money_balances(date, date) from public, anon';
end $$;
grant execute on function public.set_money_opening(text, date, numeric) to authenticated;
grant execute on function public.money_balances(date, date) to authenticated;
