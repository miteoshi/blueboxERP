-- ─────────────────────────────────────────────────────────────
-- Transfers between cash and bank (contra entries).
--
-- money_transfers   one row per movement between the cash box and the
--                   bank: cash deposited in the bank (cash_to_bank) or
--                   cash drawn from it (bank_to_cash). Numbered
--                   CT/<fy>/<nnnn>.
--
-- A transfer is not money received or paid: it lowers one balance and
-- raises the other by the same amount. money_balances() now counts it.
--
-- Like expenses: read by admin, manager and viewer; written only through
-- the functions below (admin and manager); never deleted, only cancelled
-- with a reason.
-- ─────────────────────────────────────────────────────────────

create table public.money_transfers (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id),
  transfer_no    text not null,
  transfer_date  date not null,
  financial_year text not null,
  direction      text not null check (direction in ('cash_to_bank', 'bank_to_cash')),
  amount         numeric(14,2) not null check (amount > 0),
  reference      text,
  notes          text,
  status         text not null default 'active' check (status in ('active', 'cancelled')),
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  cancelled_by   uuid references public.profiles(id),
  cancelled_at   timestamptz,
  cancel_reason  text,
  constraint money_transfers_org_no_key unique (org_id, transfer_no)
);
create index money_transfers_org_date_idx on public.money_transfers (org_id, transfer_date);
create index money_transfers_created_by_idx on public.money_transfers (created_by);
create index money_transfers_cancelled_by_idx on public.money_transfers (cancelled_by);

comment on table public.money_transfers is
  'Cash deposited in or drawn from the bank. Written through record_money_transfer() and cancel_money_transfer(); rows are cancelled, never deleted.';

create trigger trg_aud_money_transfers after insert or update or delete on public.money_transfers
  for each row execute function public.write_audit_log();

alter table public.money_transfers enable row level security;
create policy "payables roles read money transfers" on public.money_transfers for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'viewer'));

do $$ begin
  execute 'revoke all on public.money_transfers from anon';
  execute 'revoke insert, update, delete, truncate, references, trigger on public.money_transfers from authenticated';
end $$;
grant select on public.money_transfers to authenticated;

create function public.record_money_transfer(
  p_direction text,
  p_amount numeric,
  p_transfer_date date default null,
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
  v_date date := coalesce(p_transfer_date, current_date);
  v_fy   text;
  v_no   text;
  v_id   uuid;
begin
  perform public.assert_my_role('admin', 'manager');
  perform public._claim_document_request(p_request_id, 'record_money_transfer');
  if p_direction is null or p_direction not in ('cash_to_bank', 'bank_to_cash') then
    raise exception 'Choose cash deposited in the bank or cash drawn from the bank' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;
  if round(p_amount, 2) <> p_amount then
    raise exception 'Amount can have at most 2 decimals' using errcode = '22023';
  end if;
  if p_amount >= 1000000000000 then
    raise exception 'Amount is too large' using errcode = '22023';
  end if;
  if v_date > current_date then
    raise exception 'Transfer date cannot be in the future' using errcode = '22023';
  end if;

  v_fy := public.financial_year(v_date);
  v_no := 'CT/' || v_fy || '/' || lpad(public.next_org_seq(v_org, 'ct:' || v_fy)::text, 4, '0');
  insert into public.money_transfers (org_id, transfer_no, transfer_date, financial_year, direction, amount, reference, notes, created_by)
  values (v_org, v_no, v_date, v_fy, p_direction, p_amount, nullif(trim(p_reference), ''), nullif(trim(p_notes), ''), auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'transfer_no', v_no, 'direction', p_direction, 'amount', p_amount);
end;
$function$;

comment on function public.record_money_transfer(text, numeric, date, text, text, uuid) is
  'Records cash deposited in the bank (cash_to_bank) or drawn from it (bank_to_cash), numbered CT/<fy>/<nnnn>. Admin and manager. p_request_id makes a retried submission safe.';

create function public.cancel_money_transfer(p_transfer_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
  v_tr  public.money_transfers;
begin
  perform public.assert_my_role('admin', 'manager');
  if nullif(trim(p_reason), '') is null then
    raise exception 'Give a reason for cancelling the transfer' using errcode = '22023';
  end if;
  select * into v_tr from public.money_transfers where id = p_transfer_id and org_id = v_org for update;
  if not found then
    raise exception 'Transfer not found' using errcode = 'P0002';
  end if;
  if v_tr.status = 'cancelled' then
    raise exception 'Transfer % is already cancelled', v_tr.transfer_no using errcode = 'P0008';
  end if;
  update public.money_transfers
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), cancel_reason = trim(p_reason)
  where id = p_transfer_id;
  return jsonb_build_object('id', p_transfer_id, 'transfer_no', v_tr.transfer_no, 'status', 'cancelled');
end;
$function$;

comment on function public.cancel_money_transfer(uuid, text) is
  'Cancels a cash/bank transfer with a reason; the row is kept. Admin and manager.';

-- ── Balances now count transfers ──────────────────────────────
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
  'Cash and bank balance at the start of a period (end of the day before p_from) and at the end of p_to, from the opening balance and the receipts, supplier payments, expenses and cash/bank transfers recorded since. Null where the day is before the opening date. Admin, manager and viewer.';

do $$ begin
  execute 'revoke all on function public.record_money_transfer(text, numeric, date, text, text, uuid) from public, anon';
  execute 'revoke all on function public.cancel_money_transfer(uuid, text) from public, anon';
  execute 'revoke all on function public.money_balances(date, date) from public, anon';
end $$;
grant execute on function public.record_money_transfer(text, numeric, date, text, text, uuid) to authenticated;
grant execute on function public.cancel_money_transfer(uuid, text) to authenticated;
grant execute on function public.money_balances(date, date) to authenticated;
