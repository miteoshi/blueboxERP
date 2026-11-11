-- ─────────────────────────────────────────────────────────────
-- Supplier bills and payables
--
-- • A supplier bill is the supplier's tax invoice, entered against the GRN
--   lines it covers. A GRN line can't be billed for more than was received,
--   and the same supplier invoice number can't be entered twice in a
--   financial year.
-- • The total entered from the supplier's invoice must agree with the
--   computed total to within ₹1 (the difference is kept as round-off).
-- • Payments to suppliers are allocated to bills (oldest due first unless
--   told otherwise); anything left over stays as an advance.
-- • Admin and manager enter bills and payments; viewer can read.
-- ─────────────────────────────────────────────────────────────

alter table public.suppliers
  add column credit_days integer not null default 30 check (credit_days between 0 and 365);

alter table public.inbound_receipt_lines
  add column qty_billed numeric(12,4) not null default 0 check (qty_billed >= 0);
alter table public.inbound_receipt_lines
  add constraint inbound_receipt_lines_billed_le_received check (qty_billed <= qty_received);

create table public.supplier_bills (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id),
  bill_no             text not null,
  supplier_invoice_no text not null,
  bill_date           date not null,
  financial_year      text not null,
  supplier_id         uuid not null references public.suppliers(id),
  status              text not null default 'posted' check (status in ('posted', 'cancelled')),
  supplier_gstin      text,
  is_interstate       boolean not null default false,
  taxable_value       numeric(14,2) not null default 0,
  cgst_amount         numeric(14,2) not null default 0,
  sgst_amount         numeric(14,2) not null default 0,
  igst_amount         numeric(14,2) not null default 0,
  round_off           numeric(6,2) not null default 0 check (round_off between -1 and 1),
  total_amount        numeric(14,2) not null default 0,
  amount_paid         numeric(14,2) not null default 0,
  balance_due         numeric(14,2) generated always as (total_amount - amount_paid) stored,
  due_date            date not null,
  notes               text,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now(),
  cancelled_by        uuid references public.profiles(id),
  cancelled_at        timestamptz,
  cancel_reason       text,
  constraint supplier_bills_org_no_key unique (org_id, bill_no),
  constraint supplier_bills_due_after_bill check (due_date >= bill_date),
  constraint supplier_bills_paid_within_total check (amount_paid >= 0 and amount_paid <= total_amount)
);
create unique index supplier_bills_one_per_supplier_invoice
  on public.supplier_bills (org_id, supplier_id, financial_year, lower(supplier_invoice_no))
  where status = 'posted';
create index supplier_bills_org_status_idx on public.supplier_bills (org_id, status);
create index supplier_bills_supplier_idx on public.supplier_bills (supplier_id);
create index supplier_bills_created_by_idx on public.supplier_bills (created_by);
create index supplier_bills_cancelled_by_idx on public.supplier_bills (cancelled_by);

create table public.supplier_bill_lines (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id),
  bill_id       uuid not null references public.supplier_bills(id) on delete cascade,
  sort_order    integer not null,
  grn_line_id   uuid not null references public.inbound_receipt_lines(id),
  item_id       uuid not null references public.items(id),
  unit_id       uuid not null references public.units(id),
  qty           numeric(12,4) not null check (qty > 0),
  rate          numeric(14,4) not null check (rate >= 0),
  gst_percent   public.gst_rate not null,
  taxable_value numeric(14,2) not null,
  gst_amount    numeric(14,2) not null,
  line_total    numeric(14,2) not null
);
create index supplier_bill_lines_bill_idx on public.supplier_bill_lines (bill_id);
create index supplier_bill_lines_grn_line_idx on public.supplier_bill_lines (grn_line_id);
create index supplier_bill_lines_item_idx on public.supplier_bill_lines (item_id);
create index supplier_bill_lines_unit_idx on public.supplier_bill_lines (unit_id);
create index supplier_bill_lines_org_idx on public.supplier_bill_lines (org_id);

create table public.supplier_payments (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id),
  payment_no       text not null,
  payment_date     date not null,
  financial_year   text not null,
  supplier_id      uuid not null references public.suppliers(id),
  amount           numeric(14,2) not null check (amount > 0),
  amount_allocated numeric(14,2) not null default 0,
  mode             text not null check (mode in ('cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other')),
  reference        text,
  notes            text,
  status           text not null default 'active' check (status in ('active', 'cancelled')),
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  cancelled_by     uuid references public.profiles(id),
  cancelled_at     timestamptz,
  cancel_reason    text,
  constraint supplier_payments_org_no_key unique (org_id, payment_no),
  constraint supplier_payments_allocated_within_amount check (amount_allocated >= 0 and amount_allocated <= amount)
);
create index supplier_payments_org_status_idx on public.supplier_payments (org_id, status);
create index supplier_payments_supplier_idx on public.supplier_payments (supplier_id);
create index supplier_payments_created_by_idx on public.supplier_payments (created_by);
create index supplier_payments_cancelled_by_idx on public.supplier_payments (cancelled_by);

create table public.supplier_payment_allocations (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id),
  payment_id uuid not null references public.supplier_payments(id),
  bill_id    uuid not null references public.supplier_bills(id),
  amount     numeric(14,2) not null check (amount > 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint supplier_payment_allocations_once unique (payment_id, bill_id)
);
create index supplier_payment_allocations_bill_idx on public.supplier_payment_allocations (bill_id);
create index supplier_payment_allocations_org_idx on public.supplier_payment_allocations (org_id);
create index supplier_payment_allocations_created_by_idx on public.supplier_payment_allocations (created_by);

create trigger trg_aud_supplier_bills after insert or update or delete on public.supplier_bills
  for each row execute function public.write_audit_log();
create trigger trg_aud_supplier_payments after insert or update or delete on public.supplier_payments
  for each row execute function public.write_audit_log();

alter table public.supplier_bills enable row level security;
alter table public.supplier_bill_lines enable row level security;
alter table public.supplier_payments enable row level security;
alter table public.supplier_payment_allocations enable row level security;

create policy "payables roles read supplier bills" on public.supplier_bills for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'viewer'));
create policy "payables roles read supplier bill lines" on public.supplier_bill_lines for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'viewer'));
create policy "payables roles read supplier payments" on public.supplier_payments for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'viewer'));
create policy "payables roles read supplier payment allocations" on public.supplier_payment_allocations for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'viewer'));

do $$ begin
  execute 'revoke all on public.supplier_bills, public.supplier_bill_lines, public.supplier_payments, public.supplier_payment_allocations from anon';
  execute 'revoke insert, update, delete, truncate, references, trigger on public.supplier_bills, public.supplier_bill_lines, public.supplier_payments, public.supplier_payment_allocations from authenticated';
end $$;

-- ── Ageing views (caller's RLS applies) ───────────────────────
create view public.v_bill_ageing with (security_invoker = true) as
  select b.id, b.org_id, b.bill_no, b.supplier_invoice_no, b.bill_date, b.due_date, b.supplier_id,
         s.name as supplier_name, b.total_amount, b.amount_paid, b.balance_due,
         greatest(current_date - b.due_date, 0) as days_overdue,
         case
           when b.due_date >= current_date then 'not_due'
           when current_date - b.due_date <= 30 then '1_30'
           when current_date - b.due_date <= 60 then '31_60'
           when current_date - b.due_date <= 90 then '61_90'
           else 'over_90'
         end as bucket
  from public.supplier_bills b
  join public.suppliers s on s.id = b.supplier_id
  where b.status = 'posted' and b.balance_due > 0;

create view public.v_supplier_payables with (security_invoker = true) as
  with bill as (
    select supplier_id,
           sum(total_amount) as billed,
           sum(balance_due) as outstanding,
           sum(balance_due) filter (where due_date >= current_date) as not_due,
           sum(balance_due) filter (where current_date - due_date between 1 and 30) as d1_30,
           sum(balance_due) filter (where current_date - due_date between 31 and 60) as d31_60,
           sum(balance_due) filter (where current_date - due_date between 61 and 90) as d61_90,
           sum(balance_due) filter (where current_date - due_date > 90) as d90_plus,
           min(due_date) filter (where balance_due > 0) as next_due
    from public.supplier_bills where status = 'posted' group by supplier_id
  ), pay as (
    select supplier_id, sum(amount) as paid, sum(amount - amount_allocated) as advance
    from public.supplier_payments where status = 'active' group by supplier_id
  )
  select s.id as supplier_id, s.org_id, s.name as supplier_name, s.credit_days,
         coalesce(bill.billed, 0) as billed,
         coalesce(pay.paid, 0) as paid,
         coalesce(bill.outstanding, 0) as outstanding,
         coalesce(bill.not_due, 0) as not_due,
         coalesce(bill.d1_30, 0) as overdue_1_30,
         coalesce(bill.d31_60, 0) as overdue_31_60,
         coalesce(bill.d61_90, 0) as overdue_61_90,
         coalesce(bill.d90_plus, 0) as overdue_90_plus,
         coalesce(bill.d1_30, 0) + coalesce(bill.d31_60, 0) + coalesce(bill.d61_90, 0) + coalesce(bill.d90_plus, 0) as overdue,
         coalesce(pay.advance, 0) as advance,
         bill.next_due
  from public.suppliers s
  left join bill on bill.supplier_id = s.id
  left join pay on pay.supplier_id = s.id
  where bill.supplier_id is not null or pay.supplier_id is not null;

do $$ begin
  execute 'revoke all on public.v_bill_ageing, public.v_supplier_payables from anon, public';
  execute 'revoke insert, update, delete, truncate, references, trigger on public.v_bill_ageing, public.v_supplier_payables from authenticated';
end $$;
grant select on public.v_bill_ageing, public.v_supplier_payables to authenticated;

-- ── Internal helpers ──────────────────────────────────────────
create or replace function public._recalc_bill_paid(p_bill_id uuid)
returns void language sql security definer set search_path to 'public'
as $function$
  update public.supplier_bills b
  set amount_paid = coalesce((
    select sum(a.amount) from public.supplier_payment_allocations a
    join public.supplier_payments p on p.id = a.payment_id and p.status = 'active'
    where a.bill_id = b.id
  ), 0)
  where b.id = p_bill_id;
$function$;

create or replace function public._recalc_payment_allocated(p_payment_id uuid)
returns void language sql security definer set search_path to 'public'
as $function$
  update public.supplier_payments p
  set amount_allocated = coalesce((select sum(a.amount) from public.supplier_payment_allocations a where a.payment_id = p.id), 0)
  where p.id = p_payment_id;
$function$;

-- Apply what is left of a payment to the supplier's bills, oldest due first
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
  v_left := v_pay.amount - v_pay.amount_allocated;
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

-- Apply explicit allocations [{ bill_id, amount }] up to p_available
create or replace function public._allocate_payment_explicit(p_payment_id uuid, p_allocations jsonb, p_available numeric)
returns numeric language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_pay   public.supplier_payments;
  v_alloc record;
  v_bill  public.supplier_bills;
  v_sum   numeric := 0;
begin
  select * into v_pay from public.supplier_payments where id = p_payment_id;
  for v_alloc in
    select (x->>'bill_id')::uuid as bill_id, (x->>'amount')::numeric as amount
    from jsonb_array_elements(p_allocations) x order by 1
  loop
    if v_alloc.amount is null or v_alloc.amount <= 0 then
      raise exception 'Allocation amounts must be greater than zero' using errcode = '22023';
    end if;
    select * into v_bill from public.supplier_bills where id = v_alloc.bill_id and org_id = v_pay.org_id for update;
    if not found or v_bill.supplier_id <> v_pay.supplier_id then
      raise exception 'Bill not found for this supplier' using errcode = 'P0002';
    end if;
    if v_bill.status <> 'posted' then
      raise exception 'Bill % is cancelled', v_bill.bill_no using errcode = 'P0008';
    end if;
    if v_alloc.amount > v_bill.balance_due + 0.005 then
      raise exception 'Amount % exceeds the balance due on % (%)', v_alloc.amount, v_bill.bill_no, v_bill.balance_due using errcode = 'P0009';
    end if;
    v_sum := v_sum + v_alloc.amount;
    if v_sum > p_available + 0.005 then
      raise exception 'Allocations add up to more than the amount available (%)', p_available using errcode = 'P0009';
    end if;
    insert into public.supplier_payment_allocations (org_id, payment_id, bill_id, amount, created_by)
    values (v_pay.org_id, p_payment_id, v_bill.id, v_alloc.amount, auth.uid())
    on conflict (payment_id, bill_id) do update set amount = public.supplier_payment_allocations.amount + excluded.amount;
    perform public._recalc_bill_paid(v_bill.id);
  end loop;
  perform public._recalc_payment_allocated(p_payment_id);
  return v_sum;
end;
$function$;

do $$ begin
  execute 'revoke execute on function public._recalc_bill_paid(uuid) from public, anon, authenticated';
  execute 'revoke execute on function public._recalc_payment_allocated(uuid) from public, anon, authenticated';
  execute 'revoke execute on function public._allocate_payment_fifo(uuid) from public, anon, authenticated';
  execute 'revoke execute on function public._allocate_payment_explicit(uuid, jsonb, numeric) from public, anon, authenticated';
end $$;

-- ── Enter a supplier's invoice against GRN lines ──────────────
-- p_lines: [{ grn_line_id, qty, rate?, gst_percent? }]
create or replace function public.create_supplier_bill(
  p_supplier_id         uuid,
  p_supplier_invoice_no text,
  p_bill_date           date,
  p_lines               jsonb,
  p_invoice_total       numeric default null,
  p_due_date            date default null,
  p_notes               text default null
)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_org      uuid := public.my_org();
  v_sup      public.suppliers;
  v_inv_no   text := nullif(trim(p_supplier_invoice_no), '');
  v_fy       text;
  v_no       text;
  v_id       uuid;
  v_due      date;
  v_inter    boolean;
  v_in       record;
  v_line     record;
  v_rate     numeric;
  v_gst      public.gst_rate;
  v_tax      numeric;
  v_g        numeric;
  v_sort     int := 0;
  v_taxable  numeric := 0;
  v_gst_sum  numeric := 0;
  v_half     numeric;
  v_round    numeric := 0;
  v_dup      text;
begin
  perform public.assert_my_role('admin', 'manager');
  if v_inv_no is null then
    raise exception 'Enter the supplier''s invoice number' using errcode = '22023';
  end if;
  if p_bill_date is null then
    raise exception 'Enter the invoice date' using errcode = '22023';
  end if;
  if p_bill_date > current_date then
    raise exception 'Invoice date cannot be in the future' using errcode = '22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Select at least one received item to bill' using errcode = '22023';
  end if;
  select * into v_sup from public.suppliers where id = p_supplier_id and org_id = v_org;
  if not found then
    raise exception 'Supplier not found' using errcode = 'P0002';
  end if;

  v_fy := public.financial_year(p_bill_date);
  select bill_no into v_dup from public.supplier_bills
  where org_id = v_org and supplier_id = p_supplier_id and financial_year = v_fy
    and lower(supplier_invoice_no) = lower(v_inv_no) and status = 'posted';
  if found then
    raise exception 'Invoice % from % is already entered as %', v_inv_no, v_sup.name, v_dup using errcode = 'P0008';
  end if;

  v_due := coalesce(p_due_date, p_bill_date + v_sup.credit_days);
  if v_due < p_bill_date then
    raise exception 'Due date cannot be before the invoice date' using errcode = '22023';
  end if;
  v_inter := public._po_is_interstate(v_org, p_supplier_id);
  v_no := 'PB/' || v_fy || '/' || lpad(public.next_org_seq(v_org, 'pb:' || v_fy)::text, 4, '0');

  insert into public.supplier_bills (org_id, bill_no, supplier_invoice_no, bill_date, financial_year, supplier_id,
    supplier_gstin, is_interstate, due_date, notes, created_by)
  values (v_org, v_no, v_inv_no, p_bill_date, v_fy, p_supplier_id, v_sup.gst_number, v_inter, v_due,
    nullif(trim(p_notes), ''), auth.uid())
  returning id into v_id;

  for v_in in
    select (x->>'grn_line_id')::uuid as grn_line_id, (x->>'qty')::numeric as qty,
           (x->>'rate')::numeric as rate, nullif(x->>'gst_percent', '') as gst_percent
    from jsonb_array_elements(p_lines) x order by 1
  loop
    select l.id, l.item_id, l.unit_id, l.qty_received, l.qty_billed, l.rate, l.gst_percent,
           r.supplier_id, r.status, r.receipt_no, r.receipt_date
    into v_line
    from public.inbound_receipt_lines l
    join public.inbound_receipts r on r.id = l.receipt_id
    where l.id = v_in.grn_line_id and r.org_id = v_org
    for update of l;
    if not found then
      raise exception 'Received item not found' using errcode = 'P0002';
    end if;
    if v_line.supplier_id <> p_supplier_id then
      raise exception '% was received from another supplier', v_line.receipt_no using errcode = '22023';
    end if;
    if v_line.status <> 'received' then
      raise exception '% is % and cannot be billed', v_line.receipt_no, v_line.status using errcode = 'P0008';
    end if;
    if v_in.qty is null or v_in.qty <= 0 then
      raise exception 'Billed quantities must be greater than zero' using errcode = '22023';
    end if;
    if v_in.qty > v_line.qty_received - v_line.qty_billed + 0.00001 then
      raise exception 'Only % of this item on % is still unbilled', v_line.qty_received - v_line.qty_billed, v_line.receipt_no
        using errcode = 'P0009';
    end if;
    v_rate := coalesce(v_in.rate, v_line.rate);
    if v_rate < 0 then
      raise exception 'Rate cannot be negative' using errcode = '22023';
    end if;
    v_gst := coalesce(v_in.gst_percent::public.gst_rate, v_line.gst_percent);
    v_tax := round(v_in.qty * v_rate, 2);
    v_g   := round(v_tax * v_gst::text::numeric / 100, 2);
    v_sort := v_sort + 1;

    insert into public.supplier_bill_lines (org_id, bill_id, sort_order, grn_line_id, item_id, unit_id, qty, rate,
      gst_percent, taxable_value, gst_amount, line_total)
    values (v_org, v_id, v_sort, v_line.id, v_line.item_id, v_line.unit_id, v_in.qty, v_rate, v_gst, v_tax, v_g, v_tax + v_g);
    update public.inbound_receipt_lines set qty_billed = qty_billed + v_in.qty where id = v_line.id;

    v_taxable := v_taxable + v_tax;
    v_gst_sum := v_gst_sum + v_g;
  end loop;

  if p_invoice_total is not null then
    v_round := round(p_invoice_total, 2) - (v_taxable + v_gst_sum);
    if abs(v_round) > 1 then
      raise exception 'The invoice total % does not match the items entered (%). Check quantities, rates and GST.',
        round(p_invoice_total, 2), v_taxable + v_gst_sum using errcode = '22023';
    end if;
  end if;
  v_half := round(v_gst_sum / 2, 2);

  update public.supplier_bills
  set taxable_value = v_taxable,
      cgst_amount = case when v_inter then 0 else v_half end,
      sgst_amount = case when v_inter then 0 else v_gst_sum - v_half end,
      igst_amount = case when v_inter then v_gst_sum else 0 end,
      round_off = v_round,
      total_amount = v_taxable + v_gst_sum + v_round
  where id = v_id;

  return jsonb_build_object('id', v_id, 'bill_no', v_no, 'total_amount', v_taxable + v_gst_sum + v_round, 'due_date', v_due);
end;
$function$;

create or replace function public.cancel_supplier_bill(p_bill_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_org  uuid := public.my_org();
  v_bill public.supplier_bills;
begin
  perform public.assert_my_role('admin', 'manager');
  if nullif(trim(p_reason), '') is null then
    raise exception 'Give a reason for cancelling the bill' using errcode = '22023';
  end if;
  select * into v_bill from public.supplier_bills where id = p_bill_id and org_id = v_org for update;
  if not found then
    raise exception 'Bill not found' using errcode = 'P0002';
  end if;
  if v_bill.status = 'cancelled' then
    raise exception 'Bill % is already cancelled', v_bill.bill_no using errcode = 'P0008';
  end if;
  if v_bill.amount_paid > 0 then
    raise exception '% has payments against it (%). Cancel those payments first.', v_bill.bill_no, v_bill.amount_paid
      using errcode = 'P0008';
  end if;
  update public.inbound_receipt_lines l
  set qty_billed = l.qty_billed - b.qty
  from (select grn_line_id, sum(qty) as qty from public.supplier_bill_lines where bill_id = p_bill_id group by grn_line_id) b
  where l.id = b.grn_line_id;
  update public.supplier_bills
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), cancel_reason = trim(p_reason)
  where id = p_bill_id;
  return jsonb_build_object('id', p_bill_id, 'bill_no', v_bill.bill_no, 'status', 'cancelled');
end;
$function$;

-- ── Pay a supplier ────────────────────────────────────────────
create or replace function public.record_supplier_payment(
  p_supplier_id   uuid,
  p_amount        numeric,
  p_mode          text,
  p_payment_date  date default null,
  p_reference     text default null,
  p_notes         text default null,
  p_allocations   jsonb default null,
  p_auto_allocate boolean default true
)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_org     uuid := public.my_org();
  v_date    date := coalesce(p_payment_date, current_date);
  v_fy      text;
  v_no      text;
  v_id      uuid;
  v_applied numeric := 0;
begin
  perform public.assert_my_role('admin', 'manager');
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
  v_fy := public.financial_year(v_date);
  v_no := 'PAY/' || v_fy || '/' || lpad(public.next_org_seq(v_org, 'pay:' || v_fy)::text, 4, '0');
  insert into public.supplier_payments (org_id, payment_no, payment_date, financial_year, supplier_id, amount, mode, reference, notes, created_by)
  values (v_org, v_no, v_date, v_fy, p_supplier_id, p_amount, p_mode, nullif(trim(p_reference), ''), nullif(trim(p_notes), ''), auth.uid())
  returning id into v_id;
  if p_allocations is not null and jsonb_typeof(p_allocations) = 'array' and jsonb_array_length(p_allocations) > 0 then
    v_applied := public._allocate_payment_explicit(v_id, p_allocations, p_amount);
  elsif p_auto_allocate then
    v_applied := public._allocate_payment_fifo(v_id);
  end if;
  return jsonb_build_object('id', v_id, 'payment_no', v_no, 'amount', p_amount, 'allocated', v_applied, 'unallocated', p_amount - v_applied);
end;
$function$;

-- Apply an advance (unallocated part of a payment) to bills
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
    v_sum := public._allocate_payment_explicit(p_payment_id, p_allocations, v_pay.amount - v_pay.amount_allocated);
  end if;
  return jsonb_build_object('id', p_payment_id, 'allocated', v_sum);
end;
$function$;

create or replace function public.cancel_supplier_payment(p_payment_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_org  uuid := public.my_org();
  v_pay  public.supplier_payments;
  v_bill uuid;
begin
  perform public.assert_my_role('admin', 'manager');
  if nullif(trim(p_reason), '') is null then
    raise exception 'Give a reason for cancelling the payment' using errcode = '22023';
  end if;
  select * into v_pay from public.supplier_payments where id = p_payment_id and org_id = v_org for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  if v_pay.status = 'cancelled' then
    raise exception 'Payment % is already cancelled', v_pay.payment_no using errcode = 'P0008';
  end if;
  update public.supplier_payments
  set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now(), cancel_reason = trim(p_reason)
  where id = p_payment_id;
  for v_bill in delete from public.supplier_payment_allocations where payment_id = p_payment_id returning bill_id loop
    perform public._recalc_bill_paid(v_bill);
  end loop;
  perform public._recalc_payment_allocated(p_payment_id);
  return jsonb_build_object('id', p_payment_id, 'payment_no', v_pay.payment_no, 'status', 'cancelled');
end;
$function$;

do $$ begin
  execute 'revoke execute on function public.create_supplier_bill(uuid, text, date, jsonb, numeric, date, text) from public, anon';
  execute 'revoke execute on function public.cancel_supplier_bill(uuid, text) from public, anon';
  execute 'revoke execute on function public.record_supplier_payment(uuid, numeric, text, date, text, text, jsonb, boolean) from public, anon';
  execute 'revoke execute on function public.allocate_supplier_payment(uuid, jsonb) from public, anon';
  execute 'revoke execute on function public.cancel_supplier_payment(uuid, text) from public, anon';
end $$;
grant execute on function public.create_supplier_bill(uuid, text, date, jsonb, numeric, date, text) to authenticated;
grant execute on function public.cancel_supplier_bill(uuid, text) to authenticated;
grant execute on function public.record_supplier_payment(uuid, numeric, text, date, text, text, jsonb, boolean) to authenticated;
grant execute on function public.allocate_supplier_payment(uuid, jsonb) to authenticated;
grant execute on function public.cancel_supplier_payment(uuid, text) to authenticated;
