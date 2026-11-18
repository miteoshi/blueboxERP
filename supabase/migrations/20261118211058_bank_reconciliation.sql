-- ─────────────────────────────────────────────────────────────
-- Bank reconciliation.
--
-- Every receipt, supplier payment and expense not made in cash, and every
-- transfer between cash and bank, goes through the bank. The day it shows
-- on the bank statement is its bank date:
--
-- bank_clearings     one bank date per entry (kept apart from the
--                    documents, which are never edited)
-- v_bank_entries     every active bank-side entry with its bank date
--                    (reads with the caller's rights)
-- set_bank_dates()   sets or clears bank dates for several entries at once
-- bank_book()        the entries to tick off for a period: those dated in it
--                    and older ones still not in the bank at its start
-- bank_reconciliation()
--                    balance as per books, deposits not yet credited,
--                    payments not yet cleared, and the balance the bank
--                    statement should show on that day
--
-- Entries on or before the bank opening date are part of the opening
-- balance and are left out. Read by admin, manager and viewer; bank dates
-- set by admin and manager.
-- ─────────────────────────────────────────────────────────────

create table public.bank_clearings (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id),
  doc_type   text not null check (doc_type in ('receipt', 'supplier_payment', 'expense', 'transfer')),
  doc_id     uuid not null,
  bank_date  date not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  constraint bank_clearings_doc_key unique (org_id, doc_type, doc_id)
);
create index bank_clearings_updated_by_idx on public.bank_clearings (updated_by);

comment on table public.bank_clearings is
  'The day a bank-side receipt, supplier payment, expense or cash/bank transfer appeared on the bank statement. Written through set_bank_dates().';

create trigger trg_aud_bank_clearings after insert or update or delete on public.bank_clearings
  for each row execute function public.write_audit_log();

alter table public.bank_clearings enable row level security;
create policy "payables roles read bank clearings" on public.bank_clearings for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'viewer'));

do $$ begin
  execute 'revoke all on public.bank_clearings from anon';
  execute 'revoke insert, update, delete, truncate, references, trigger on public.bank_clearings from authenticated';
end $$;
grant select on public.bank_clearings to authenticated;

-- ── Every entry that goes through the bank ────────────────────
create view public.v_bank_entries with (security_invoker = true) as
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
select t.org_id, 'transfer', t.id, t.transfer_no, t.transfer_date, t.created_at,
       case t.direction when 'cash_to_bank' then 'Cash deposited in bank' else 'Cash drawn from bank' end, null, 'transfer', t.reference,
       case t.direction when 'cash_to_bank' then t.amount else 0 end,
       case t.direction when 'bank_to_cash' then t.amount else 0 end,
       bc.bank_date
from public.money_transfers t
left join public.bank_clearings bc on bc.org_id = t.org_id and bc.doc_type = 'transfer' and bc.doc_id = t.id
where t.status = 'active';

comment on view public.v_bank_entries is
  'Active receipts, supplier payments and expenses not made in cash, and cash/bank transfers, with the bank date if one is set. Reads with the caller''s rights.';

do $$ begin
  execute 'revoke all on public.v_bank_entries from anon';
end $$;
grant select on public.v_bank_entries to authenticated;

-- ── Set or clear bank dates ───────────────────────────────────
create function public.set_bank_dates(p_entries jsonb)
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
    if e.doc_type is null or e.doc_type not in ('receipt', 'supplier_payment', 'expense', 'transfer') then
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
  'Sets the bank date of bank-side entries, or clears it when bank_date is null: [{doc_type, doc_id, bank_date}], doc_type receipt | supplier_payment | expense | transfer. All or nothing, up to 500. Admin and manager.';

-- ── Entries to tick off for a period ──────────────────────────
create function public.bank_book(p_from date, p_to date)
returns table (
  kind text,
  doc_id uuid,
  doc_no text,
  doc_date date,
  party text,
  detail text,
  mode text,
  reference text,
  deposit numeric,
  withdrawal numeric,
  bank_date date
)
language plpgsql
stable
security invoker
set search_path to 'public'
as $function$
declare
  v_org     uuid := public.my_org();
  v_role    public.user_role := public.my_role();
  v_opening date;
begin
  if v_role is null or v_role not in ('admin', 'manager', 'viewer') then
    raise exception 'Unauthorized: your role (%) cannot see the bank reconciliation', coalesce(v_role::text, 'none')
      using errcode = 'P0005';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Choose a period that starts on or before the day it ends' using errcode = '22023';
  end if;
  select as_of into v_opening from public.money_openings where org_id = v_org and account = 'bank';

  return query
  select b.kind, b.doc_id, b.doc_no, b.doc_date, b.party, b.detail, b.mode, b.reference, b.deposit, b.withdrawal, b.bank_date
  from public.v_bank_entries b
  where b.org_id = v_org
    and b.doc_date <= p_to
    and (v_opening is null or b.doc_date > v_opening)
    -- dated in the period, or older and not in the bank before it started
    and (b.doc_date >= p_from or b.bank_date is null or b.bank_date >= p_from)
  order by b.doc_date, b.created_at, b.doc_no;
end;
$function$;

comment on function public.bank_book(date, date) is
  'Bank-side entries dated in the period, plus older ones not in the bank before it started, with their bank dates. Entries on or before the bank opening date are left out. Admin, manager and viewer.';

-- ── The reconciliation on a day ───────────────────────────────
create function public.bank_reconciliation(p_as_of date)
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'public'
as $function$
declare
  v_org     uuid := public.my_org();
  v_role    public.user_role := public.my_role();
  v_open    public.money_openings;
  v_book    numeric;
  v_dep     numeric;
  v_dep_n   integer;
  v_wd      numeric;
  v_wd_n    integer;
  v_ticked  integer;
begin
  if v_role is null or v_role not in ('admin', 'manager', 'viewer') then
    raise exception 'Unauthorized: your role (%) cannot see the bank reconciliation', coalesce(v_role::text, 'none')
      using errcode = 'P0005';
  end if;
  if p_as_of is null then
    raise exception 'Choose the day to reconcile' using errcode = '22023';
  end if;
  select * into v_open from public.money_openings where org_id = v_org and account = 'bank';
  if not found then
    return jsonb_build_object('set', false);
  end if;
  if p_as_of < v_open.as_of then
    raise exception 'Choose a day on or after the bank opening date (%)', to_char(v_open.as_of, 'DD Mon YYYY')
      using errcode = '22023';
  end if;

  v_book := (public.money_balances(p_as_of, p_as_of) -> 'bank' ->> 'end')::numeric;

  select coalesce(sum(b.deposit) filter (where b.deposit > 0 and (b.bank_date is null or b.bank_date > p_as_of)), 0),
         count(*) filter (where b.deposit > 0 and (b.bank_date is null or b.bank_date > p_as_of)),
         coalesce(sum(b.withdrawal) filter (where b.withdrawal > 0 and (b.bank_date is null or b.bank_date > p_as_of)), 0),
         count(*) filter (where b.withdrawal > 0 and (b.bank_date is null or b.bank_date > p_as_of)),
         count(*) filter (where b.bank_date <= p_as_of)
  into v_dep, v_dep_n, v_wd, v_wd_n, v_ticked
  from public.v_bank_entries b
  where b.org_id = v_org and b.doc_date > v_open.as_of and b.doc_date <= p_as_of;

  return jsonb_build_object(
    'set', true,
    'as_of', p_as_of,
    'opening_as_of', v_open.as_of,
    'book_balance', round(v_book, 2),
    'deposits_not_credited', jsonb_build_object('amount', round(v_dep, 2), 'entries', v_dep_n),
    'payments_not_cleared', jsonb_build_object('amount', round(v_wd, 2), 'entries', v_wd_n),
    'entries_in_bank', v_ticked,
    'bank_balance', round(v_book - v_dep + v_wd, 2)
  );
end;
$function$;

comment on function public.bank_reconciliation(date) is
  'Bank reconciliation on a day: balance as per books, less deposits not yet credited, plus payments not yet cleared, gives the balance the bank statement should show. {set:false} until a bank opening balance is set. Admin, manager and viewer.';

do $$ begin
  execute 'revoke all on function public.set_bank_dates(jsonb) from public, anon';
  execute 'revoke all on function public.bank_book(date, date) from public, anon';
  execute 'revoke all on function public.bank_reconciliation(date) from public, anon';
end $$;
grant execute on function public.set_bank_dates(jsonb) to authenticated;
grant execute on function public.bank_book(date, date) to authenticated;
grant execute on function public.bank_reconciliation(date) to authenticated;
