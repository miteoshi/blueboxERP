-- ─────────────────────────────────────────────────────────────
-- GST credit notes (CGST Act s.34) and sales returns
--
-- A credit note is issued against one tax invoice:
--   • sales_return   — goods come back; optionally restocked
--   • rate_difference / discount / deficiency / other — value only
-- Tax is reversed at the invoice line's rate with the same CGST+SGST /
-- IGST split as the invoice. The note reduces the invoice balance
-- (sales_invoices.amount_credited). If the invoice was already paid,
-- the excess payment is released back to the receipt as on-account
-- credit, which can be applied to other invoices.
--
-- s.34(2): a credit note must be declared by 30 November after the end
-- of the financial year of the original invoice.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.credit_notes (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id),
  credit_note_no   text not null check (length(credit_note_no) <= 16),
  note_date        date not null,
  financial_year   text not null,
  invoice_id       uuid not null references public.sales_invoices(id),
  client_id        uuid not null references public.clients(id),
  reason           text not null check (reason in ('sales_return', 'rate_difference', 'discount', 'deficiency', 'other')),
  restocked        boolean not null default false,
  status           text not null default 'issued' check (status in ('issued', 'cancelled')),
  place_of_supply  text not null references public.gst_states(code),
  is_interstate    boolean not null,
  buyer_gstin      text,
  taxable_value    numeric(14,2) not null check (taxable_value > 0),
  cgst_amount      numeric(14,2) not null default 0,
  sgst_amount      numeric(14,2) not null default 0,
  igst_amount      numeric(14,2) not null default 0,
  round_off        numeric(8,2)  not null default 0,
  total_amount     numeric(14,2) not null check (total_amount > 0),
  notes            text,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  cancelled_by     uuid references public.profiles(id),
  cancelled_at     timestamptz,
  cancel_reason    text,
  constraint credit_notes_org_no_key unique (org_id, credit_note_no)
);

create index if not exists credit_notes_invoice_idx on public.credit_notes (invoice_id);
create index if not exists credit_notes_client_idx on public.credit_notes (client_id);
create index if not exists credit_notes_org_date_idx on public.credit_notes (org_id, note_date desc);

create table if not exists public.credit_note_lines (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id),
  credit_note_id   uuid not null references public.credit_notes(id) on delete cascade,
  invoice_line_id  uuid not null references public.sales_invoice_lines(id),
  sort_order       integer not null,
  item_id          uuid not null references public.items(id),
  description      text not null,
  hsn_code         text,
  qty              numeric(14,4) check (qty is null or qty > 0),
  unit_name        text,
  rate             numeric(14,4),
  taxable_value    numeric(14,2) not null check (taxable_value > 0),
  gst_rate         numeric(5,2) not null,
  cgst_amount      numeric(14,2) not null default 0,
  sgst_amount      numeric(14,2) not null default 0,
  igst_amount      numeric(14,2) not null default 0,
  line_total       numeric(14,2) not null
);

create index if not exists credit_note_lines_note_idx on public.credit_note_lines (credit_note_id);
create index if not exists credit_note_lines_invoice_line_idx on public.credit_note_lines (invoice_line_id);
create index if not exists credit_note_lines_item_idx on public.credit_note_lines (item_id);
create index if not exists credit_note_lines_org_idx on public.credit_note_lines (org_id);
create index if not exists credit_notes_created_by_idx on public.credit_notes (created_by);
create index if not exists credit_notes_cancelled_by_idx on public.credit_notes (cancelled_by);
create index if not exists credit_notes_pos_idx on public.credit_notes (place_of_supply);

alter table public.credit_notes enable row level security;
alter table public.credit_note_lines enable row level security;

create policy "finance roles read credit notes" on public.credit_notes for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'sales', 'viewer'));
create policy "finance roles read credit note lines" on public.credit_note_lines for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'sales', 'viewer'));

revoke all on public.credit_notes, public.credit_note_lines from anon;
revoke insert, update, delete, truncate on public.credit_notes, public.credit_note_lines from authenticated;

create trigger trg_aud_credit_notes after insert or update or delete on public.credit_notes
  for each row execute function public.write_audit_log();

-- Make room on an invoice for a credit of p_incoming: amount_paid +
-- amount_credited may not exceed total_amount, so the newest payment
-- allocations are reduced first and that money returns to its receipt
-- as on-account credit. Called before amount_credited is increased.
create or replace function public._release_overpayment(p_invoice_id uuid, p_incoming numeric)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_inv     public.sales_invoices;
  v_excess  numeric;
  v_alloc   record;
  v_take    numeric;
  v_freed   numeric := 0;
begin
  select * into v_inv from public.sales_invoices where id = p_invoice_id for update;
  v_excess := v_inv.amount_paid + v_inv.amount_credited + p_incoming - v_inv.total_amount;
  if v_excess <= 0 then
    return 0;
  end if;

  for v_alloc in
    select a.id, a.receipt_id, a.amount
    from public.receipt_allocations a
    join public.customer_receipts r on r.id = a.receipt_id and r.status = 'active'
    where a.invoice_id = p_invoice_id
    order by a.created_at desc, r.receipt_date desc
    for update of a
  loop
    exit when v_excess <= 0;
    v_take := least(v_excess, v_alloc.amount);
    if v_take = v_alloc.amount then
      delete from public.receipt_allocations where id = v_alloc.id;
    else
      update public.receipt_allocations set amount = amount - v_take where id = v_alloc.id;
    end if;
    perform public._recalc_receipt_allocated(v_alloc.receipt_id);
    v_excess := v_excess - v_take;
    v_freed := v_freed + v_take;
  end loop;

  perform public._recalc_invoice_paid(p_invoice_id);
  return v_freed;
end;
$function$;

revoke execute on function public._release_overpayment(uuid, numeric) from public, anon, authenticated;

-- ── create_credit_note ───────────────────────────────────────
-- p_lines: [{ "invoice_line_id": uuid, "qty": n }]            for sales_return
--          [{ "invoice_line_id": uuid, "taxable_value": n }]  for other reasons
create or replace function public.create_credit_note(
  p_invoice_id uuid,
  p_reason     text,
  p_lines      jsonb,
  p_restock    boolean default false,
  p_note_date  date default null,
  p_notes      text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org       uuid := public.my_org();
  v_user      uuid := auth.uid();
  v_date      date := coalesce(p_note_date, current_date);
  v_inv       public.sales_invoices;
  v_fy_end    int;
  v_deadline  date;
  v_fy        text;
  v_no        text;
  v_cn_id     uuid;
  v_in        record;
  v_line      public.sales_invoice_lines;
  v_done_qty  numeric;
  v_done_tax  numeric;
  v_qty       numeric;
  v_taxable   numeric;
  v_sort      int := 0;
  v_tax_sum   numeric;
  v_cgst      numeric;
  v_sgst      numeric;
  v_igst      numeric;
  v_sum       numeric;
  v_total     numeric;
  v_room      numeric;
  v_freed     numeric;
  v_mv        record;
begin
  perform public.assert_my_role('admin', 'manager');

  if p_reason not in ('sales_return', 'rate_difference', 'discount', 'deficiency', 'other') then
    raise exception 'Unknown credit note reason %', p_reason using errcode = '22023';
  end if;
  if coalesce(p_restock, false) and p_reason <> 'sales_return' then
    raise exception 'Only a sales return can put goods back into stock' using errcode = '22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one line' using errcode = '22023';
  end if;
  if v_date > current_date then
    raise exception 'Credit note date cannot be in the future' using errcode = '22023';
  end if;

  select * into v_inv from public.sales_invoices
  where id = p_invoice_id and org_id = v_org for update;
  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if v_inv.status <> 'issued' then
    raise exception 'Invoice % is cancelled', v_inv.invoice_no using errcode = 'P0008';
  end if;
  if v_date < v_inv.invoice_date then
    raise exception 'Credit note date cannot be before the invoice date (%)', v_inv.invoice_date using errcode = '22023';
  end if;

  -- s.34(2): by 30 November following the end of the invoice's financial year
  v_fy_end := case when extract(month from v_inv.invoice_date) >= 4
                   then extract(year from v_inv.invoice_date)::int + 1
                   else extract(year from v_inv.invoice_date)::int end;
  v_deadline := make_date(v_fy_end, 11, 30);
  if v_date > v_deadline then
    raise exception 'Too late: a credit note for % had to be issued by % (CGST Act s.34)', v_inv.invoice_no, v_deadline
      using errcode = 'P0008';
  end if;

  v_fy := public.financial_year(v_date);
  v_no := 'CN/' || v_fy || '/' || lpad(public.next_org_seq(v_org, 'cn:' || v_fy)::text, 4, '0');

  insert into public.credit_notes (
    org_id, credit_note_no, note_date, financial_year, invoice_id, client_id, reason, restocked,
    place_of_supply, is_interstate, buyer_gstin, taxable_value, total_amount, notes, created_by
  ) values (
    v_org, v_no, v_date, v_fy, v_inv.id, v_inv.client_id, p_reason, coalesce(p_restock, false),
    v_inv.place_of_supply, v_inv.is_interstate, v_inv.buyer_gstin, 0.01, 0.01,
    nullif(trim(p_notes), ''), v_user
  )
  returning id into v_cn_id;

  for v_in in
    select (x->>'invoice_line_id')::uuid as invoice_line_id,
           nullif(x->>'qty', '')::numeric as qty,
           nullif(x->>'taxable_value', '')::numeric as taxable_value
    from jsonb_array_elements(p_lines) x
  loop
    select * into v_line from public.sales_invoice_lines
    where id = v_in.invoice_line_id and invoice_id = v_inv.id;
    if not found then
      raise exception 'Line does not belong to invoice %', v_inv.invoice_no using errcode = 'P0002';
    end if;

    select coalesce(sum(l.qty), 0), coalesce(sum(l.taxable_value), 0)
      into v_done_qty, v_done_tax
    from public.credit_note_lines l
    join public.credit_notes n on n.id = l.credit_note_id and n.status = 'issued'
    where l.invoice_line_id = v_line.id and l.credit_note_id <> v_cn_id;

    if p_reason = 'sales_return' then
      v_qty := v_in.qty;
      if v_qty is null or v_qty <= 0 then
        raise exception 'Enter the quantity returned for %', v_line.description using errcode = '22023';
      end if;
      if v_qty > v_line.qty - v_done_qty + 0.00001 then
        raise exception 'Only % of % can still be returned', v_line.qty - v_done_qty, v_line.description
          using errcode = 'P0009';
      end if;
      v_taxable := round(v_qty * v_line.rate, 2);
    else
      v_qty := null;
      v_taxable := round(v_in.taxable_value, 2);
      if v_taxable is null or v_taxable <= 0 then
        raise exception 'Enter the amount to credit for %', v_line.description using errcode = '22023';
      end if;
    end if;

    if v_taxable > v_line.taxable_value - v_done_tax + 0.005 then
      raise exception 'Credit for % exceeds what remains on the invoice line (%)',
        v_line.description, v_line.taxable_value - v_done_tax using errcode = 'P0009';
    end if;

    v_sort := v_sort + 1;
    insert into public.credit_note_lines (
      org_id, credit_note_id, invoice_line_id, sort_order, item_id, description, hsn_code,
      qty, unit_name, rate, taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount, line_total
    ) values (
      v_org, v_cn_id, v_line.id, v_sort, v_line.item_id, v_line.description, v_line.hsn_code,
      v_qty, v_line.unit_name, v_line.rate, v_taxable, v_line.gst_rate,
      case when v_inv.is_interstate then 0 else round(v_taxable * v_line.gst_rate / 200, 2) end,
      case when v_inv.is_interstate then 0 else round(v_taxable * v_line.gst_rate / 200, 2) end,
      case when v_inv.is_interstate then round(v_taxable * v_line.gst_rate / 100, 2) else 0 end,
      0
    );
  end loop;

  update public.credit_note_lines
  set line_total = taxable_value + cgst_amount + sgst_amount + igst_amount
  where credit_note_id = v_cn_id;

  select sum(taxable_value), sum(cgst_amount), sum(sgst_amount), sum(igst_amount)
    into v_tax_sum, v_cgst, v_sgst, v_igst
  from public.credit_note_lines where credit_note_id = v_cn_id;

  v_sum := v_tax_sum + v_cgst + v_sgst + v_igst;
  v_total := round(v_sum, 0);

  -- Rounding across several notes must never credit more than the invoice
  v_room := v_inv.total_amount - v_inv.amount_credited;
  if v_total > v_room then
    if v_total - v_room <= 1 then
      v_total := v_room;
    else
      raise exception 'Credit notes would exceed the invoice value (% remaining)', v_room using errcode = 'P0009';
    end if;
  end if;

  update public.credit_notes
  set taxable_value = v_tax_sum, cgst_amount = v_cgst, sgst_amount = v_sgst, igst_amount = v_igst,
      round_off = v_total - v_sum, total_amount = v_total
  where id = v_cn_id;

  v_freed := public._release_overpayment(v_inv.id, v_total);
  update public.sales_invoices set amount_credited = amount_credited + v_total where id = v_inv.id;

  -- Returned goods back into stock
  if coalesce(p_restock, false) then
    for v_mv in
      select item_id, sum(qty) as qty, max(description) as description
      from public.credit_note_lines where credit_note_id = v_cn_id
      group by item_id
    loop
      perform public.lock_inventory_balance(v_mv.item_id);
      insert into public.stock_movements (item_id, org_id, movement_type, qty, ref_type, ref_id, notes, created_by)
      values (v_mv.item_id, v_org, 'returned_client', v_mv.qty, 'credit_note', v_cn_id,
              'Sales return ' || v_no || ' against ' || v_inv.invoice_no, v_user);
    end loop;
  end if;

  return jsonb_build_object(
    'id', v_cn_id,
    'credit_note_no', v_no,
    'total_amount', v_total,
    'payment_released', v_freed
  );
end;
$function$;

-- ── cancel_credit_note ───────────────────────────────────────
create or replace function public.cancel_credit_note(p_credit_note_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org  uuid := public.my_org();
  v_user uuid := auth.uid();
  v_cn   public.credit_notes;
  v_inv  public.sales_invoices;
  v_mv   record;
  v_bal  public.inventory_balance;
begin
  perform public.assert_my_role('admin', 'manager');

  if nullif(trim(p_reason), '') is null then
    raise exception 'Give a reason for cancelling the credit note' using errcode = '22023';
  end if;

  select * into v_cn from public.credit_notes
  where id = p_credit_note_id and org_id = v_org for update;
  if not found then
    raise exception 'Credit note not found' using errcode = 'P0002';
  end if;
  if v_cn.status = 'cancelled' then
    raise exception 'Credit note % is already cancelled', v_cn.credit_note_no using errcode = 'P0008';
  end if;

  select * into v_inv from public.sales_invoices where id = v_cn.invoice_id for update;

  -- Take restocked goods back out (refused if they have since been used)
  if v_cn.restocked then
    for v_mv in
      select item_id, sum(qty) as qty
      from public.credit_note_lines where credit_note_id = v_cn.id
      group by item_id
    loop
      v_bal := public.lock_inventory_balance(v_mv.item_id);
      perform public.validate_stock_sufficiency(v_mv.item_id, v_mv.qty, v_bal);
      insert into public.stock_movements (item_id, org_id, movement_type, qty, ref_type, ref_id, notes, created_by)
      values (v_mv.item_id, v_org, 'adjustment_out', v_mv.qty, 'credit_note_cancel', v_cn.id,
              'Cancelled ' || v_cn.credit_note_no, v_user);
    end loop;
  end if;

  update public.credit_notes
  set status = 'cancelled', cancelled_by = v_user, cancelled_at = now(), cancel_reason = trim(p_reason)
  where id = v_cn.id;

  update public.sales_invoices
  set amount_credited = greatest(amount_credited - v_cn.total_amount, 0)
  where id = v_cn.invoice_id;

  return jsonb_build_object('id', v_cn.id, 'credit_note_no', v_cn.credit_note_no, 'status', 'cancelled');
end;
$function$;

-- HSN summary is reported net of credit notes issued in the period
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
  with movements as (
    select l.hsn_code, l.description, l.unit_name, l.gst_rate, l.qty, l.taxable_value,
           l.igst_amount, l.cgst_amount, l.sgst_amount, l.line_total, i.buyer_gstin is not null as b2b
    from public.sales_invoice_lines l
    join public.sales_invoices i on i.id = l.invoice_id
    where i.status = 'issued' and i.invoice_date between p_from and p_to
    union all
    select l.hsn_code, l.description, l.unit_name, l.gst_rate, -coalesce(l.qty, 0), -l.taxable_value,
           -l.igst_amount, -l.cgst_amount, -l.sgst_amount, -l.line_total, n.buyer_gstin is not null
    from public.credit_note_lines l
    join public.credit_notes n on n.id = l.credit_note_id
    where n.status = 'issued' and n.note_date between p_from and p_to
  )
  select coalesce(hsn_code, '—'), min(description), unit_name, gst_rate, sum(qty), sum(taxable_value),
         sum(igst_amount), sum(cgst_amount), sum(sgst_amount), sum(line_total), b2b
  from movements
  group by coalesce(hsn_code, '—'), unit_name, gst_rate, b2b
  order by 1, 4;
$function$;

revoke execute on function public.create_credit_note(uuid, text, jsonb, boolean, date, text) from public, anon;
revoke execute on function public.cancel_credit_note(uuid, text) from public, anon;
grant execute on function public.create_credit_note(uuid, text, jsonb, boolean, date, text) to authenticated;
grant execute on function public.cancel_credit_note(uuid, text) to authenticated;
