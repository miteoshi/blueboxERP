-- ─────────────────────────────────────────────────────────────
-- Purchase returns (debit notes)
--
-- When goods go back to a supplier, or a supplier agrees a rate cut or
-- discount after billing, we raise a debit note against their bill. It
-- reduces what we owe them and reverses the input GST we claimed.
--
-- • purchase_return takes quantities and can send the goods out of stock
--   (movement type returned_supplier). The other reasons take an amount.
-- • A bill line can't be returned or credited for more than it carries,
--   counting every issued debit note against it.
-- • If the bill was already paid, the excess payment is freed from its
--   allocations and becomes an advance with that supplier again.
-- • Admin and manager raise and cancel; viewer can read.
-- ─────────────────────────────────────────────────────────────

-- A bill's balance now also comes down by what has been debited. The ageing
-- views read balance_due, so they are rebuilt around the new column.
do $$ begin
  execute 'drop view public.v_bill_ageing';
  execute 'drop view public.v_supplier_payables';
end $$;

alter table public.supplier_bills
  add column amount_debited numeric(14,2) not null default 0 check (amount_debited >= 0);
alter table public.supplier_bills drop column balance_due;
alter table public.supplier_bills
  add column balance_due numeric(14,2) generated always as (total_amount - amount_paid - amount_debited) stored;
alter table public.supplier_bills drop constraint supplier_bills_paid_within_total;
alter table public.supplier_bills
  add constraint supplier_bills_settled_within_total
  check (amount_paid >= 0 and amount_paid + amount_debited <= total_amount);

create view public.v_bill_ageing with (security_invoker = true) as
  select b.id, b.org_id, b.bill_no, b.supplier_invoice_no, b.bill_date, b.due_date, b.supplier_id,
         s.name as supplier_name, b.total_amount, b.amount_paid, b.amount_debited, b.balance_due,
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
    select supplier_id, sum(amount) as paid, sum(amount - amount_allocated) as advance
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

create table public.debit_notes (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id),
  debit_note_no  text not null,
  note_date      date not null,
  financial_year text not null,
  bill_id        uuid not null references public.supplier_bills(id),
  supplier_id    uuid not null references public.suppliers(id),
  reason         text not null check (reason in ('purchase_return', 'rate_difference', 'discount', 'deficiency', 'other')),
  returned_stock boolean not null default false,
  supplier_gstin text,
  is_interstate  boolean not null default false,
  taxable_value  numeric(14,2) not null default 0,
  cgst_amount    numeric(14,2) not null default 0,
  sgst_amount    numeric(14,2) not null default 0,
  igst_amount    numeric(14,2) not null default 0,
  round_off      numeric(6,2) not null default 0 check (round_off between -1 and 1),
  total_amount   numeric(14,2) not null default 0,
  status         text not null default 'issued' check (status in ('issued', 'cancelled')),
  notes          text,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  cancelled_by   uuid references public.profiles(id),
  cancelled_at   timestamptz,
  cancel_reason  text,
  constraint debit_notes_org_no_key unique (org_id, debit_note_no)
);
create index debit_notes_org_status_idx on public.debit_notes (org_id, status);
create index debit_notes_bill_idx on public.debit_notes (bill_id);
create index debit_notes_supplier_idx on public.debit_notes (supplier_id);
create index debit_notes_created_by_idx on public.debit_notes (created_by);
create index debit_notes_cancelled_by_idx on public.debit_notes (cancelled_by);
create index debit_notes_date_idx on public.debit_notes (org_id, note_date);

create table public.debit_note_lines (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id),
  debit_note_id uuid not null references public.debit_notes(id) on delete cascade,
  bill_line_id  uuid not null references public.supplier_bill_lines(id),
  sort_order    integer not null,
  item_id       uuid not null references public.items(id),
  unit_id       uuid not null references public.units(id),
  qty           numeric(12,4) check (qty is null or qty > 0),
  rate          numeric(14,4) not null,
  gst_percent   public.gst_rate not null,
  taxable_value numeric(14,2) not null check (taxable_value > 0),
  gst_amount    numeric(14,2) not null,
  line_total    numeric(14,2) not null
);
create index debit_note_lines_note_idx on public.debit_note_lines (debit_note_id);
create index debit_note_lines_bill_line_idx on public.debit_note_lines (bill_line_id);
create index debit_note_lines_item_idx on public.debit_note_lines (item_id);
create index debit_note_lines_unit_idx on public.debit_note_lines (unit_id);
create index debit_note_lines_org_idx on public.debit_note_lines (org_id);

create trigger trg_aud_debit_notes after insert or update or delete on public.debit_notes
  for each row execute function public.write_audit_log();

alter table public.debit_notes enable row level security;
alter table public.debit_note_lines enable row level security;

create policy "payables roles read debit notes" on public.debit_notes for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'viewer'));
create policy "payables roles read debit note lines" on public.debit_note_lines for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'viewer'));

do $$ begin
  execute 'revoke all on public.debit_notes, public.debit_note_lines from anon';
  execute 'revoke insert, update, delete, truncate, references, trigger on public.debit_notes, public.debit_note_lines from authenticated';
end $$;

-- ── Free payment that a debit note has made excess ────────────
-- Mirrors _release_overpayment() on the sales side: the money goes back to
-- being an unallocated advance with that supplier.
create or replace function public._release_overpaid_bill(p_bill_id uuid, p_incoming numeric)
returns numeric language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_bill   public.supplier_bills;
  v_excess numeric;
  v_alloc  record;
  v_take   numeric;
  v_freed  numeric := 0;
begin
  select * into v_bill from public.supplier_bills where id = p_bill_id for update;
  v_excess := v_bill.amount_paid + v_bill.amount_debited + p_incoming - v_bill.total_amount;
  if v_excess <= 0 then
    return 0;
  end if;

  for v_alloc in
    select a.id, a.payment_id, a.amount
    from public.supplier_payment_allocations a
    join public.supplier_payments p on p.id = a.payment_id and p.status = 'active'
    where a.bill_id = p_bill_id
    order by a.created_at desc, p.payment_date desc
    for update of a
  loop
    exit when v_excess <= 0;
    v_take := least(v_excess, v_alloc.amount);
    if v_take = v_alloc.amount then
      delete from public.supplier_payment_allocations where id = v_alloc.id;
    else
      update public.supplier_payment_allocations set amount = amount - v_take where id = v_alloc.id;
    end if;
    perform public._recalc_payment_allocated(v_alloc.payment_id);
    v_excess := v_excess - v_take;
    v_freed := v_freed + v_take;
  end loop;

  perform public._recalc_bill_paid(p_bill_id);
  return v_freed;
end;
$function$;

do $$ begin
  execute 'revoke execute on function public._release_overpaid_bill(uuid, numeric) from public, anon, authenticated';
end $$;

-- A bill with debit notes against it can no longer be cancelled: the notes
-- carry their own numbers and have already reversed stock and input GST.
create or replace function public.cancel_supplier_bill(p_bill_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_org  uuid := public.my_org();
  v_bill public.supplier_bills;
  v_dn   text;
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
  select string_agg(debit_note_no, ', ' order by debit_note_no) into v_dn
  from public.debit_notes where bill_id = p_bill_id and status = 'issued';
  if v_dn is not null then
    raise exception '% has debit notes against it (%). Cancel those first.', v_bill.bill_no, v_dn using errcode = 'P0008';
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

-- ── Raise a debit note ────────────────────────────────────────
-- p_lines: [{ bill_line_id, qty }]            for purchase_return
--          [{ bill_line_id, taxable_value }]  for the other reasons
create or replace function public.create_debit_note(
  p_bill_id       uuid,
  p_reason        text,
  p_lines         jsonb,
  p_return_stock  boolean default false,
  p_note_date     date default null,
  p_notes         text default null
)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_org      uuid := public.my_org();
  v_user     uuid := auth.uid();
  v_date     date := coalesce(p_note_date, current_date);
  v_bill     public.supplier_bills;
  v_fy       text;
  v_no       text;
  v_dn_id    uuid;
  v_in       record;
  v_line     public.supplier_bill_lines;
  v_item     text;
  v_done_qty numeric;
  v_done_tax numeric;
  v_qty      numeric;
  v_taxable  numeric;
  v_sort     int := 0;
  v_tax_sum  numeric;
  v_gst_sum  numeric;
  v_half     numeric;
  v_sum      numeric;
  v_total    numeric;
  v_room     numeric;
  v_freed    numeric;
  v_mv       record;
  v_bal      public.inventory_balance;
begin
  perform public.assert_my_role('admin', 'manager');

  if p_reason not in ('purchase_return', 'rate_difference', 'discount', 'deficiency', 'other') then
    raise exception 'Unknown debit note reason %', p_reason using errcode = '22023';
  end if;
  if coalesce(p_return_stock, false) and p_reason <> 'purchase_return' then
    raise exception 'Only a purchase return can send goods out of stock' using errcode = '22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one line' using errcode = '22023';
  end if;
  if v_date > current_date then
    raise exception 'Debit note date cannot be in the future' using errcode = '22023';
  end if;

  select * into v_bill from public.supplier_bills where id = p_bill_id and org_id = v_org for update;
  if not found then
    raise exception 'Supplier bill not found' using errcode = 'P0002';
  end if;
  if v_bill.status <> 'posted' then
    raise exception 'Bill % is cancelled', v_bill.bill_no using errcode = 'P0008';
  end if;
  if v_date < v_bill.bill_date then
    raise exception 'Debit note date cannot be before the bill date (%)', v_bill.bill_date using errcode = '22023';
  end if;

  v_fy := public.financial_year(v_date);
  v_no := 'DN/' || v_fy || '/' || lpad(public.next_org_seq(v_org, 'dn:' || v_fy)::text, 4, '0');

  insert into public.debit_notes (
    org_id, debit_note_no, note_date, financial_year, bill_id, supplier_id, reason, returned_stock,
    supplier_gstin, is_interstate, notes, created_by
  ) values (
    v_org, v_no, v_date, v_fy, v_bill.id, v_bill.supplier_id, p_reason, coalesce(p_return_stock, false),
    v_bill.supplier_gstin, v_bill.is_interstate, nullif(trim(p_notes), ''), v_user
  )
  returning id into v_dn_id;

  for v_in in
    select (x->>'bill_line_id')::uuid as bill_line_id,
           nullif(x->>'qty', '')::numeric as qty,
           nullif(x->>'taxable_value', '')::numeric as taxable_value
    from jsonb_array_elements(p_lines) x order by 1
  loop
    select * into v_line from public.supplier_bill_lines
    where id = v_in.bill_line_id and bill_id = v_bill.id for update;
    if not found then
      raise exception 'Line does not belong to %', v_bill.bill_no using errcode = 'P0002';
    end if;
    select name into v_item from public.items where id = v_line.item_id;

    -- What earlier issued debit notes already took off this line
    select coalesce(sum(l.qty), 0), coalesce(sum(l.taxable_value), 0)
      into v_done_qty, v_done_tax
    from public.debit_note_lines l
    join public.debit_notes n on n.id = l.debit_note_id and n.status = 'issued'
    where l.bill_line_id = v_line.id and l.debit_note_id <> v_dn_id;

    if p_reason = 'purchase_return' then
      v_qty := v_in.qty;
      if v_qty is null or v_qty <= 0 then
        raise exception 'Enter the quantity returned for %', v_item using errcode = '22023';
      end if;
      if v_qty > v_line.qty - v_done_qty + 0.00001 then
        raise exception 'Only % of % can still be returned', v_line.qty - v_done_qty, v_item using errcode = 'P0009';
      end if;
      v_taxable := round(v_qty * v_line.rate, 2);
    else
      v_qty := null;
      v_taxable := round(v_in.taxable_value, 2);
      if v_taxable is null or v_taxable <= 0 then
        raise exception 'Enter the amount to debit for %', v_item using errcode = '22023';
      end if;
    end if;

    if v_taxable > v_line.taxable_value - v_done_tax + 0.005 then
      raise exception 'Debit for % exceeds what remains on the bill line (%)',
        v_item, v_line.taxable_value - v_done_tax using errcode = 'P0009';
    end if;

    v_sort := v_sort + 1;
    insert into public.debit_note_lines (
      org_id, debit_note_id, bill_line_id, sort_order, item_id, unit_id, qty, rate, gst_percent,
      taxable_value, gst_amount, line_total
    ) values (
      v_org, v_dn_id, v_line.id, v_sort, v_line.item_id, v_line.unit_id, v_qty, v_line.rate, v_line.gst_percent,
      v_taxable, round(v_taxable * v_line.gst_percent::text::numeric / 100, 2),
      v_taxable + round(v_taxable * v_line.gst_percent::text::numeric / 100, 2)
    );
  end loop;

  select sum(taxable_value), sum(gst_amount) into v_tax_sum, v_gst_sum
  from public.debit_note_lines where debit_note_id = v_dn_id;

  v_sum := v_tax_sum + v_gst_sum;
  v_total := round(v_sum, 0);

  -- Rounding across several notes must never debit more than the bill
  v_room := v_bill.total_amount - v_bill.amount_debited;
  if v_total > v_room then
    if v_total - v_room <= 1 then
      v_total := v_room;
    else
      raise exception 'Debit notes would exceed the bill value (% remaining)', v_room using errcode = 'P0009';
    end if;
  end if;

  v_half := round(v_gst_sum / 2, 2);
  update public.debit_notes
  set taxable_value = v_tax_sum,
      cgst_amount = case when v_bill.is_interstate then 0 else v_half end,
      sgst_amount = case when v_bill.is_interstate then 0 else v_gst_sum - v_half end,
      igst_amount = case when v_bill.is_interstate then v_gst_sum else 0 end,
      round_off = v_total - v_sum,
      total_amount = v_total
  where id = v_dn_id;

  -- Free any payment this makes excess, then book the debit
  v_freed := public._release_overpaid_bill(v_bill.id, v_total);
  update public.supplier_bills set amount_debited = amount_debited + v_total where id = v_bill.id;

  -- Goods going back to the supplier leave stock
  if coalesce(p_return_stock, false) then
    for v_mv in
      select item_id, sum(qty) as qty from public.debit_note_lines
      where debit_note_id = v_dn_id group by item_id
    loop
      v_bal := public.lock_inventory_balance(v_mv.item_id);
      perform public.validate_stock_sufficiency(v_mv.item_id, v_mv.qty, v_bal);
      insert into public.stock_movements (item_id, org_id, movement_type, qty, ref_type, ref_id, notes, created_by)
      values (v_mv.item_id, v_org, 'returned_supplier', v_mv.qty, 'debit_note', v_dn_id,
              'Purchase return ' || v_no || ' against ' || v_bill.bill_no, v_user);
    end loop;
  end if;

  return jsonb_build_object(
    'id', v_dn_id,
    'debit_note_no', v_no,
    'total_amount', v_total,
    'payment_released', v_freed
  );
end;
$function$;

create or replace function public.cancel_debit_note(p_debit_note_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_org  uuid := public.my_org();
  v_user uuid := auth.uid();
  v_dn   public.debit_notes;
  v_mv   record;
begin
  perform public.assert_my_role('admin', 'manager');

  if nullif(trim(p_reason), '') is null then
    raise exception 'Give a reason for cancelling the debit note' using errcode = '22023';
  end if;

  select * into v_dn from public.debit_notes where id = p_debit_note_id and org_id = v_org for update;
  if not found then
    raise exception 'Debit note not found' using errcode = 'P0002';
  end if;
  if v_dn.status = 'cancelled' then
    raise exception 'Debit note % is already cancelled', v_dn.debit_note_no using errcode = 'P0008';
  end if;

  perform 1 from public.supplier_bills where id = v_dn.bill_id for update;

  -- Returned goods come back into stock
  if v_dn.returned_stock then
    for v_mv in
      select item_id, sum(qty) as qty from public.debit_note_lines
      where debit_note_id = v_dn.id group by item_id
    loop
      perform public.lock_inventory_balance(v_mv.item_id);
      insert into public.stock_movements (item_id, org_id, movement_type, qty, ref_type, ref_id, notes, created_by)
      values (v_mv.item_id, v_org, 'adjustment_in', v_mv.qty, 'debit_note_cancel', v_dn.id,
              'Cancelled ' || v_dn.debit_note_no, v_user);
    end loop;
  end if;

  update public.debit_notes
  set status = 'cancelled', cancelled_by = v_user, cancelled_at = now(), cancel_reason = trim(p_reason)
  where id = v_dn.id;

  update public.supplier_bills
  set amount_debited = greatest(amount_debited - v_dn.total_amount, 0)
  where id = v_dn.bill_id;

  return jsonb_build_object('id', v_dn.id, 'debit_note_no', v_dn.debit_note_no, 'status', 'cancelled');
end;
$function$;

do $$ begin
  execute 'revoke execute on function public.create_debit_note(uuid, text, jsonb, boolean, date, text) from public, anon';
  execute 'revoke execute on function public.cancel_debit_note(uuid, text) from public, anon';
end $$;
grant execute on function public.create_debit_note(uuid, text, jsonb, boolean, date, text) to authenticated;
grant execute on function public.cancel_debit_note(uuid, text) to authenticated;
