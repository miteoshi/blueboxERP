-- ─────────────────────────────────────────────────────────────
-- GST paid to the government, and the GST ledger.
--
-- gst_openings   where GST stood on a starting day: tax still unpaid and
--                input credit in hand, per head (IGST, CGST, SGST)
-- gst_payments   challans: tax per head plus interest and late fee,
--                numbered GSTP/<fy>/<nnnn>; cancelled, never deleted
-- gst_ledger()   per head on a day: opening + output tax - input credit
--                - paid = still payable (positive) or credit in hand
--                (negative)
--
-- Output tax: issued invoices less their credit notes, leaving out
-- reverse-charge invoices (the buyer pays that tax). Input credit: posted
-- bills from registered suppliers (with a GSTIN) less their debit notes.
-- Documents and payments on or before the opening day are part of the
-- opening position.
--
-- A challan also counts in:
--   money_balances()     money out of bank or cash, by mode
--   v_bank_entries / set_bank_dates()   bank reconciliation (gst_payment)
--   profit_and_loss()    interest and late fee as the expense line
--                        "GST interest and late fee"; the tax is not an expense
--   financial_position() GST payable (owed) or GST credit (owned) once an
--                        opening position is set; net worth then moves by the
--                        period's profit exactly
--
-- Read by admin, manager and viewer; written through the functions below
-- by admin and manager.
-- ─────────────────────────────────────────────────────────────

create table public.gst_openings (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null unique references public.organizations(id),
  as_of         date not null,
  payable_igst  numeric(14,2) not null default 0 check (payable_igst >= 0),
  payable_cgst  numeric(14,2) not null default 0 check (payable_cgst >= 0),
  payable_sgst  numeric(14,2) not null default 0 check (payable_sgst >= 0),
  credit_igst   numeric(14,2) not null default 0 check (credit_igst >= 0),
  credit_cgst   numeric(14,2) not null default 0 check (credit_cgst >= 0),
  credit_sgst   numeric(14,2) not null default 0 check (credit_sgst >= 0),
  updated_by    uuid references public.profiles(id),
  updated_at    timestamptz not null default now()
);
create index gst_openings_updated_by_idx on public.gst_openings (updated_by);

comment on table public.gst_openings is
  'GST position on a starting day: tax unpaid and input credit in hand per head. One row per organisation, written through set_gst_opening().';

create table public.gst_payments (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id),
  payment_no     text not null,
  payment_date   date not null,
  financial_year text not null,
  period         text check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  igst           numeric(14,2) not null default 0 check (igst >= 0),
  cgst           numeric(14,2) not null default 0 check (cgst >= 0),
  sgst           numeric(14,2) not null default 0 check (sgst >= 0),
  interest       numeric(14,2) not null default 0 check (interest >= 0),
  late_fee       numeric(14,2) not null default 0 check (late_fee >= 0),
  amount         numeric(14,2) generated always as (igst + cgst + sgst + interest + late_fee) stored,
  mode           text not null check (mode in ('cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other')),
  reference      text,
  notes          text,
  status         text not null default 'active' check (status in ('active', 'cancelled')),
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  cancelled_by   uuid references public.profiles(id),
  cancelled_at   timestamptz,
  cancel_reason  text,
  constraint gst_payments_org_no_key unique (org_id, payment_no),
  constraint gst_payments_some_amount check (igst + cgst + sgst + interest + late_fee > 0)
);
create index gst_payments_org_date_idx on public.gst_payments (org_id, payment_date);
create index gst_payments_created_by_idx on public.gst_payments (created_by);
create index gst_payments_cancelled_by_idx on public.gst_payments (cancelled_by);

comment on table public.gst_payments is
  'GST challans paid: tax per head, interest and late fee. Written through record_gst_payment() and cancel_gst_payment(); rows are cancelled, never deleted.';

create trigger trg_aud_gst_openings after insert or update or delete on public.gst_openings
  for each row execute function public.write_audit_log();
create trigger trg_aud_gst_payments after insert or update or delete on public.gst_payments
  for each row execute function public.write_audit_log();

alter table public.gst_openings enable row level security;
alter table public.gst_payments enable row level security;

create policy "payables roles read gst openings" on public.gst_openings for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'viewer'));
create policy "payables roles read gst payments" on public.gst_payments for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'viewer'));

do $$ begin
  execute 'revoke all on public.gst_openings, public.gst_payments from anon';
  execute 'revoke insert, update, delete, truncate, references, trigger on public.gst_openings, public.gst_payments from authenticated';
end $$;
grant select on public.gst_openings, public.gst_payments to authenticated;

-- ── Opening position ──────────────────────────────────────────
create function public.set_gst_opening(
  p_as_of date,
  p_payable_igst numeric default 0,
  p_payable_cgst numeric default 0,
  p_payable_sgst numeric default 0,
  p_credit_igst numeric default 0,
  p_credit_cgst numeric default 0,
  p_credit_sgst numeric default 0
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
  v_amt numeric;
begin
  perform public.assert_my_role('admin', 'manager');
  if p_as_of is null then
    raise exception 'Choose the day the opening position is for' using errcode = '22023';
  end if;
  if p_as_of > current_date then
    raise exception 'The opening day cannot be in the future' using errcode = '22023';
  end if;
  foreach v_amt in array array[p_payable_igst, p_payable_cgst, p_payable_sgst, p_credit_igst, p_credit_cgst, p_credit_sgst] loop
    if v_amt is null or v_amt < 0 then
      raise exception 'Amounts cannot be negative' using errcode = '22023';
    end if;
    if round(v_amt, 2) <> v_amt then
      raise exception 'Amounts can have at most 2 decimals' using errcode = '22023';
    end if;
    if v_amt >= 1000000000000 then
      raise exception 'Amount is too large' using errcode = '22023';
    end if;
  end loop;

  insert into public.gst_openings (org_id, as_of, payable_igst, payable_cgst, payable_sgst, credit_igst, credit_cgst, credit_sgst, updated_by)
  values (v_org, p_as_of, p_payable_igst, p_payable_cgst, p_payable_sgst, p_credit_igst, p_credit_cgst, p_credit_sgst, auth.uid())
  on conflict (org_id) do update
  set as_of = excluded.as_of,
      payable_igst = excluded.payable_igst, payable_cgst = excluded.payable_cgst, payable_sgst = excluded.payable_sgst,
      credit_igst = excluded.credit_igst, credit_cgst = excluded.credit_cgst, credit_sgst = excluded.credit_sgst,
      updated_by = excluded.updated_by, updated_at = now();
  return jsonb_build_object('as_of', p_as_of);
end;
$function$;

comment on function public.set_gst_opening(date, numeric, numeric, numeric, numeric, numeric, numeric) is
  'Sets where GST stood on a day: tax still unpaid and input credit in hand, per head. Replaces any earlier opening. Admin and manager.';

-- ── Challans ──────────────────────────────────────────────────
create function public.record_gst_payment(
  p_payment_date date,
  p_igst numeric default 0,
  p_cgst numeric default 0,
  p_sgst numeric default 0,
  p_interest numeric default 0,
  p_late_fee numeric default 0,
  p_mode text default 'bank_transfer',
  p_period text default null,
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
  v_date  date := coalesce(p_payment_date, current_date);
  v_amt   numeric;
  v_total numeric;
  v_fy    text;
  v_no    text;
  v_id    uuid;
begin
  perform public.assert_my_role('admin', 'manager');
  perform public._claim_document_request(p_request_id, 'record_gst_payment');
  foreach v_amt in array array[p_igst, p_cgst, p_sgst, p_interest, p_late_fee] loop
    if v_amt is null or v_amt < 0 then
      raise exception 'Amounts cannot be negative' using errcode = '22023';
    end if;
    if round(v_amt, 2) <> v_amt then
      raise exception 'Amounts can have at most 2 decimals' using errcode = '22023';
    end if;
  end loop;
  v_total := p_igst + p_cgst + p_sgst + p_interest + p_late_fee;
  if v_total <= 0 then
    raise exception 'Enter the amount paid under at least one head' using errcode = '22023';
  end if;
  if v_total >= 1000000000000 then
    raise exception 'Amount is too large' using errcode = '22023';
  end if;
  if p_mode is null or p_mode not in ('cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other') then
    raise exception 'Unknown payment mode %', p_mode using errcode = '22023';
  end if;
  if v_date > current_date then
    raise exception 'Payment date cannot be in the future' using errcode = '22023';
  end if;
  if p_period is not null then
    if p_period !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
      raise exception 'Return period must be a month, like 2026-10' using errcode = '22023';
    end if;
    if to_date(p_period || '-01', 'YYYY-MM-DD') > date_trunc('month', v_date)::date then
      raise exception 'The return period cannot be after the month of payment' using errcode = '22023';
    end if;
  end if;

  v_fy := public.financial_year(v_date);
  v_no := 'GSTP/' || v_fy || '/' || lpad(public.next_org_seq(v_org, 'gstp:' || v_fy)::text, 4, '0');
  insert into public.gst_payments (org_id, payment_no, payment_date, financial_year, period, igst, cgst, sgst, interest, late_fee, mode, reference, notes, created_by)
  values (v_org, v_no, v_date, v_fy, p_period, p_igst, p_cgst, p_sgst, p_interest, p_late_fee, p_mode,
          nullif(trim(p_reference), ''), nullif(trim(p_notes), ''), auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'payment_no', v_no, 'amount', v_total);
end;
$function$;

comment on function public.record_gst_payment(date, numeric, numeric, numeric, numeric, numeric, text, text, text, text, uuid) is
  'Records a GST challan: tax per head plus interest and late fee, numbered GSTP/<fy>/<nnnn>. Admin and manager. p_request_id makes a retried submission safe.';

create function public.cancel_gst_payment(p_payment_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
  v_pay public.gst_payments;
begin
  perform public.assert_my_role('admin', 'manager');
  if nullif(trim(p_reason), '') is null then
    raise exception 'Give a reason for cancelling the GST payment' using errcode = '22023';
  end if;
  select * into v_pay from public.gst_payments where id = p_payment_id and org_id = v_org for update;
  if not found then
    raise exception 'GST payment not found' using errcode = 'P0002';
  end if;
  if v_pay.status = 'cancelled' then
    raise exception 'GST payment % is already cancelled', v_pay.payment_no using errcode = 'P0008';
  end if;
  update public.gst_payments
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), cancel_reason = trim(p_reason)
  where id = p_payment_id;
  return jsonb_build_object('id', p_payment_id, 'payment_no', v_pay.payment_no, 'status', 'cancelled');
end;
$function$;

comment on function public.cancel_gst_payment(uuid, text) is
  'Cancels a GST challan with a reason; the row is kept. Admin and manager.';

-- ── The ledger ────────────────────────────────────────────────
create function public.gst_ledger(p_as_of date)
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'public'
as $function$
declare
  v_org   uuid := public.my_org();
  v_role  public.user_role := public.my_role();
  v_open  public.gst_openings;
  o_i numeric; o_c numeric; o_s numeric;
  n_i numeric; n_c numeric; n_s numeric;
  p_i numeric; p_c numeric; p_s numeric; p_extra numeric;
  v_heads jsonb;
begin
  if v_role is null or v_role not in ('admin', 'manager', 'viewer') then
    raise exception 'Unauthorized: your role (%) cannot see the GST ledger', coalesce(v_role::text, 'none')
      using errcode = 'P0005';
  end if;
  if p_as_of is null then
    raise exception 'Choose the day' using errcode = '22023';
  end if;
  select * into v_open from public.gst_openings where org_id = v_org;
  if not found then
    return jsonb_build_object('set', false);
  end if;
  if p_as_of < v_open.as_of then
    return jsonb_build_object('set', false, 'opening_as_of', v_open.as_of, 'before_opening', true);
  end if;

  -- Output tax: issued invoices less their credit notes; reverse charge left out
  select coalesce(sum(i), 0), coalesce(sum(c), 0), coalesce(sum(s), 0) into o_i, o_c, o_s
  from (
    select v.igst_amount as i, v.cgst_amount as c, v.sgst_amount as s
    from public.sales_invoices v
    where v.org_id = v_org and v.status = 'issued' and not v.reverse_charge
      and v.invoice_date > v_open.as_of and v.invoice_date <= p_as_of
    union all
    select -n.igst_amount, -n.cgst_amount, -n.sgst_amount
    from public.credit_notes n
    join public.sales_invoices v on v.id = n.invoice_id
    where n.org_id = v_org and n.status = 'issued' and not v.reverse_charge
      and n.note_date > v_open.as_of and n.note_date <= p_as_of
  ) x;

  -- Input credit: bills from registered suppliers less their debit notes
  select coalesce(sum(i), 0), coalesce(sum(c), 0), coalesce(sum(s), 0) into n_i, n_c, n_s
  from (
    select b.igst_amount as i, b.cgst_amount as c, b.sgst_amount as s
    from public.supplier_bills b
    where b.org_id = v_org and b.status = 'posted' and nullif(trim(b.supplier_gstin), '') is not null
      and b.bill_date > v_open.as_of and b.bill_date <= p_as_of
    union all
    select -d.igst_amount, -d.cgst_amount, -d.sgst_amount
    from public.debit_notes d
    where d.org_id = v_org and d.status = 'issued' and nullif(trim(d.supplier_gstin), '') is not null
      and d.note_date > v_open.as_of and d.note_date <= p_as_of
  ) y;

  select coalesce(sum(igst), 0), coalesce(sum(cgst), 0), coalesce(sum(sgst), 0), coalesce(sum(interest + late_fee), 0)
  into p_i, p_c, p_s, p_extra
  from public.gst_payments
  where org_id = v_org and status = 'active' and payment_date > v_open.as_of and payment_date <= p_as_of;

  v_heads := jsonb_build_object(
    'igst', jsonb_build_object('opening', v_open.payable_igst - v_open.credit_igst, 'output', round(o_i, 2), 'input', round(n_i, 2), 'paid', round(p_i, 2),
                               'balance', round(v_open.payable_igst - v_open.credit_igst + o_i - n_i - p_i, 2)),
    'cgst', jsonb_build_object('opening', v_open.payable_cgst - v_open.credit_cgst, 'output', round(o_c, 2), 'input', round(n_c, 2), 'paid', round(p_c, 2),
                               'balance', round(v_open.payable_cgst - v_open.credit_cgst + o_c - n_c - p_c, 2)),
    'sgst', jsonb_build_object('opening', v_open.payable_sgst - v_open.credit_sgst, 'output', round(o_s, 2), 'input', round(n_s, 2), 'paid', round(p_s, 2),
                               'balance', round(v_open.payable_sgst - v_open.credit_sgst + o_s - n_s - p_s, 2)));

  return jsonb_build_object(
    'set', true,
    'as_of', p_as_of,
    'opening_as_of', v_open.as_of,
    'opening', jsonb_build_object(
      'payable', jsonb_build_object('igst', v_open.payable_igst, 'cgst', v_open.payable_cgst, 'sgst', v_open.payable_sgst),
      'credit', jsonb_build_object('igst', v_open.credit_igst, 'cgst', v_open.credit_cgst, 'sgst', v_open.credit_sgst)),
    'heads', v_heads,
    'balance', round((v_heads -> 'igst' ->> 'balance')::numeric + (v_heads -> 'cgst' ->> 'balance')::numeric + (v_heads -> 'sgst' ->> 'balance')::numeric, 2),
    'interest_and_late_fee', round(p_extra, 2));
end;
$function$;

comment on function public.gst_ledger(date) is
  'GST per head at the end of a day: opening position + output tax (issued invoices less credit notes, reverse charge left out) - input credit (bills from registered suppliers less debit notes) - tax paid by challan. A positive balance is still payable, a negative one is credit in hand. {set:false} until an opening position is set on or before the day. Admin, manager and viewer.';

-- ── Bank reconciliation takes GST challans too ────────────────
alter table public.bank_clearings drop constraint bank_clearings_doc_type_check;
alter table public.bank_clearings add constraint bank_clearings_doc_type_check
  check (doc_type in ('receipt', 'supplier_payment', 'expense', 'income', 'gst_payment', 'transfer'));

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
select t.org_id, 'transfer', t.id, t.transfer_no, t.transfer_date, t.created_at,
       case t.direction when 'cash_to_bank' then 'Cash deposited in bank' else 'Cash drawn from bank' end, null, 'transfer', t.reference,
       case t.direction when 'cash_to_bank' then t.amount else 0 end,
       case t.direction when 'bank_to_cash' then t.amount else 0 end,
       bc.bank_date
from public.money_transfers t
left join public.bank_clearings bc on bc.org_id = t.org_id and bc.doc_type = 'transfer' and bc.doc_id = t.id
where t.status = 'active';

comment on view public.v_bank_entries is
  'Active receipts, supplier payments, expenses, other income and GST challans not in cash, and cash/bank transfers, with the bank date if one is set. Reads with the caller''s rights.';

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
    if e.doc_type is null or e.doc_type not in ('receipt', 'supplier_payment', 'expense', 'income', 'gst_payment', 'transfer') then
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
  'Sets the bank date of bank-side entries, or clears it when bank_date is null: [{doc_type, doc_id, bank_date}], doc_type receipt | supplier_payment | expense | income | gst_payment | transfer. All or nothing, up to 500. Admin and manager.';

-- ── Cash and bank balances count GST challans ─────────────────
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
  'Cash and bank balance at the start of a period (end of the day before p_from) and at the end of p_to, from the opening balance and the receipts, other income, supplier payments, expenses, GST challans and cash/bank transfers recorded since. Null where the day is before the opening date. Admin, manager and viewer.';

-- ── Profit and loss: GST interest and late fee are an expense ─
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
  'Profit and loss for a period: net sales (taxable), cost of goods sold as opening stock + goods received - returns to suppliers - closing stock at a running average cost per item, expenses (including GST interest and late fee) and other income by head, gross and net profit. Admin, manager and viewer.';

-- ── Financial position: GST payable or credit ─────────────────
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

  v_assets := coalesce(v_cash, 0) + coalesce(v_bank, 0) + v_recv + v_sadv + v_stock + greatest(-coalesce(v_gst_bal, 0), 0);
  v_owed := v_pay + v_cadv + greatest(coalesce(v_gst_bal, 0), 0);

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
    'total_owned', round(v_assets, 2),
    'total_owed', round(v_owed, 2),
    'net_worth', round(v_assets - v_owed, 2)
  );
end;
$function$;

comment on function public.financial_position(date) is
  'What the business owns (cash, bank, money owed by customers, advances paid to suppliers, stock at running average cost, GST credit) and owes (money owed to suppliers, advances from customers, GST payable) at the end of a day, from what is recorded in the app. Cash, bank and GST are null until their opening position is set. Admin, manager and viewer.';

do $$ begin
  execute 'revoke all on function public.set_gst_opening(date, numeric, numeric, numeric, numeric, numeric, numeric) from public, anon';
  execute 'revoke all on function public.record_gst_payment(date, numeric, numeric, numeric, numeric, numeric, text, text, text, text, uuid) from public, anon';
  execute 'revoke all on function public.cancel_gst_payment(uuid, text) from public, anon';
  execute 'revoke all on function public.gst_ledger(date) from public, anon';
  execute 'revoke all on function public.set_bank_dates(jsonb) from public, anon';
  execute 'revoke all on function public.money_balances(date, date) from public, anon';
  execute 'revoke all on function public.profit_and_loss(date, date) from public, anon';
  execute 'revoke all on function public.financial_position(date) from public, anon';
end $$;
grant execute on function public.set_gst_opening(date, numeric, numeric, numeric, numeric, numeric, numeric) to authenticated;
grant execute on function public.record_gst_payment(date, numeric, numeric, numeric, numeric, numeric, text, text, text, text, uuid) to authenticated;
grant execute on function public.cancel_gst_payment(uuid, text) to authenticated;
grant execute on function public.gst_ledger(date) to authenticated;
grant execute on function public.set_bank_dates(jsonb) to authenticated;
grant execute on function public.money_balances(date, date) to authenticated;
grant execute on function public.profit_and_loss(date, date) to authenticated;
grant execute on function public.financial_position(date) to authenticated;
