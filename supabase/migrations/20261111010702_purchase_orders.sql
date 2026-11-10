-- ─────────────────────────────────────────────────────────────
-- Purchase orders
--
-- draft ──issue──▶ issued ──receive──▶ partially_received ──▶ received
--   │                │                        │
--   └──cancel──▶ cancelled ◀──cancel── (nothing received yet)
--                                             └──close──▶ closed (short)
--
-- • Store, manager and admin draft orders; only manager or admin issue them
--   (purchase approval). A draft can be edited; an issued order can't.
-- • Goods are received against the order's lines (receive_purchase_order),
--   at the order's rate and GST, never more than ordered. Each receipt is a
--   normal GRN, so stock, the inventory ledger and GRN screens work as before.
-- • An order with nothing received can be cancelled; a partly received one
--   can be closed short.
-- ─────────────────────────────────────────────────────────────

create table public.purchase_orders (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id),
  po_no            text not null,
  po_date          date not null,
  financial_year   text not null,
  supplier_id      uuid not null references public.suppliers(id),
  expected_date    date,
  status           text not null default 'draft'
                   check (status in ('draft', 'issued', 'partially_received', 'received', 'closed', 'cancelled')),
  is_interstate    boolean not null default false,
  taxable_value    numeric(14,2) not null default 0,
  gst_amount       numeric(14,2) not null default 0,
  total_amount     numeric(14,2) not null default 0,
  terms            text,
  notes            text,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  issued_by        uuid references public.profiles(id),
  issued_at        timestamptz,
  closed_by        uuid references public.profiles(id),
  closed_at        timestamptz,
  close_reason     text,
  constraint purchase_orders_org_no_key unique (org_id, po_no),
  constraint purchase_orders_expected_after_order check (expected_date is null or expected_date >= po_date)
);

create index purchase_orders_org_status_idx on public.purchase_orders (org_id, status);
create index purchase_orders_supplier_idx on public.purchase_orders (supplier_id);
create index purchase_orders_created_by_idx on public.purchase_orders (created_by);
create index purchase_orders_issued_by_idx on public.purchase_orders (issued_by);
create index purchase_orders_closed_by_idx on public.purchase_orders (closed_by);

create table public.purchase_order_lines (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id),
  po_id            uuid not null references public.purchase_orders(id) on delete cascade,
  sort_order       integer not null,
  item_id          uuid not null references public.items(id),
  unit_id          uuid not null references public.units(id),
  qty              numeric(14,4) not null check (qty > 0),
  qty_received     numeric(14,4) not null default 0 check (qty_received >= 0),
  rate             numeric(14,4) not null check (rate >= 0),
  gst_percent      public.gst_rate not null,
  taxable_value    numeric(14,2) not null,
  gst_amount       numeric(14,2) not null,
  line_total       numeric(14,2) not null,
  notes            text,
  constraint purchase_order_lines_received_le_ordered check (qty_received <= qty)
);

create index purchase_order_lines_po_idx on public.purchase_order_lines (po_id);
create index purchase_order_lines_item_idx on public.purchase_order_lines (item_id);
create index purchase_order_lines_unit_idx on public.purchase_order_lines (unit_id);
create index purchase_order_lines_org_idx on public.purchase_order_lines (org_id);

-- A GRN may come from a purchase order
alter table public.inbound_receipts add column po_id uuid references public.purchase_orders(id);
alter table public.inbound_receipt_lines add column po_line_id uuid references public.purchase_order_lines(id);
create index inbound_receipts_po_idx on public.inbound_receipts (po_id);
create index inbound_receipt_lines_po_line_idx on public.inbound_receipt_lines (po_line_id);

create trigger trg_upd_purchase_orders before update on public.purchase_orders
  for each row execute function public.set_updated_at();
create trigger trg_aud_purchase_orders after insert or update or delete on public.purchase_orders
  for each row execute function public.write_audit_log();

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;

create policy "purchasing roles read purchase orders" on public.purchase_orders for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'store', 'viewer'));
create policy "purchasing roles read purchase order lines" on public.purchase_order_lines for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'store', 'viewer'));

-- All writes go through the functions below
do $$ begin
  execute 'revoke all on public.purchase_orders, public.purchase_order_lines from anon';
  execute 'revoke insert, update, delete, truncate, references, trigger on public.purchase_orders, public.purchase_order_lines from authenticated';
end $$;

-- ── Lines: validate, price and (re)write a purchase order's lines ──
-- p_lines: [{ item_id, unit_id?, qty, rate, gst_percent?, notes? }]
create or replace function public._write_purchase_order_lines(p_po_id uuid, p_lines jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_po    public.purchase_orders;
  v_in    record;
  v_item  public.items;
  v_gst   public.gst_rate;
  v_tax   numeric;
  v_g     numeric;
  v_sort  int := 0;
begin
  select * into v_po from public.purchase_orders where id = p_po_id;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one item' using errcode = '22023';
  end if;

  delete from public.purchase_order_lines where po_id = p_po_id;

  for v_in in
    select (x->>'item_id')::uuid as item_id,
           nullif(x->>'unit_id', '')::uuid as unit_id,
           (x->>'qty')::numeric as qty,
           (x->>'rate')::numeric as rate,
           nullif(x->>'gst_percent', '') as gst_percent,
           nullif(trim(x->>'notes'), '') as notes
    from jsonb_array_elements(p_lines) x
  loop
    select * into v_item from public.items where id = v_in.item_id and org_id = v_po.org_id;
    if not found then
      raise exception 'Item not found' using errcode = 'P0002';
    end if;
    if v_in.qty is null or v_in.qty <= 0 then
      raise exception 'Quantity for % must be greater than zero', v_item.name using errcode = '22023';
    end if;
    if v_in.rate is null or v_in.rate < 0 then
      raise exception 'Rate for % cannot be negative', v_item.name using errcode = '22023';
    end if;
    if coalesce(v_in.unit_id, v_item.unit_id) is null then
      raise exception 'Item % has no unit', v_item.name using errcode = '22023';
    end if;
    if v_in.unit_id is not null
       and not exists (select 1 from public.units where id = v_in.unit_id and org_id = v_po.org_id) then
      raise exception 'Unit not found' using errcode = 'P0002';
    end if;

    -- GST: as given, else the item's current price setting, else 18%
    v_gst := coalesce(
      v_in.gst_percent::public.gst_rate,
      (select gst_percent::public.gst_rate from public.v_current_prices where item_id = v_item.id),
      '18'::public.gst_rate
    );
    v_tax := round(v_in.qty * v_in.rate, 2);
    v_g   := round(v_tax * v_gst::text::numeric / 100, 2);
    v_sort := v_sort + 1;

    insert into public.purchase_order_lines (
      org_id, po_id, sort_order, item_id, unit_id, qty, rate, gst_percent,
      taxable_value, gst_amount, line_total, notes
    ) values (
      v_po.org_id, p_po_id, v_sort, v_item.id, coalesce(v_in.unit_id, v_item.unit_id), v_in.qty, v_in.rate, v_gst,
      v_tax, v_g, v_tax + v_g, v_in.notes
    );
  end loop;

  update public.purchase_orders po
  set taxable_value = t.taxable, gst_amount = t.gst, total_amount = t.taxable + t.gst
  from (
    select coalesce(sum(taxable_value), 0) as taxable, coalesce(sum(gst_amount), 0) as gst
    from public.purchase_order_lines where po_id = p_po_id
  ) t
  where po.id = p_po_id;
end;
$function$;

-- Interstate when both states are known and differ (supplier state from
-- its state code, else its GSTIN)
create or replace function public._po_is_interstate(p_org_id uuid, p_supplier_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(
    (select coalesce(s.state_code, left(s.gst_number, 2)) <> o.state_code
     from public.suppliers s, public.organizations o
     where s.id = p_supplier_id and o.id = p_org_id),
    false)
$function$;

do $$ begin
  execute 'revoke execute on function public._write_purchase_order_lines(uuid, jsonb) from public, anon, authenticated';
  execute 'revoke execute on function public._po_is_interstate(uuid, uuid) from public, anon, authenticated';
end $$;

-- ── Create ────────────────────────────────────────────────────
create or replace function public.create_purchase_order(
  p_supplier_id   uuid,
  p_lines         jsonb,
  p_expected_date date default null,
  p_terms         text default null,
  p_notes         text default null,
  p_issue         boolean default false,
  p_po_date       date default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org   uuid := public.my_org();
  v_user  uuid := auth.uid();
  v_date  date := coalesce(p_po_date, current_date);
  v_fy    text;
  v_no    text;
  v_id    uuid;
  v_total numeric;
begin
  perform public.assert_my_role('admin', 'manager', 'store');
  if coalesce(p_issue, false) then
    perform public.assert_my_role('admin', 'manager');
  end if;
  if v_date > current_date then
    raise exception 'Order date cannot be in the future' using errcode = '22023';
  end if;
  if not exists (select 1 from public.suppliers where id = p_supplier_id and org_id = v_org and is_active) then
    raise exception 'Supplier not found or inactive' using errcode = 'P0002';
  end if;

  v_fy := public.financial_year(v_date);
  v_no := 'PO/' || v_fy || '/' || lpad(public.next_org_seq(v_org, 'po:' || v_fy)::text, 4, '0');

  insert into public.purchase_orders (
    org_id, po_no, po_date, financial_year, supplier_id, expected_date, status, is_interstate,
    terms, notes, created_by, issued_by, issued_at
  ) values (
    v_org, v_no, v_date, v_fy, p_supplier_id, p_expected_date,
    case when coalesce(p_issue, false) then 'issued' else 'draft' end,
    public._po_is_interstate(v_org, p_supplier_id),
    nullif(trim(p_terms), ''), nullif(trim(p_notes), ''), v_user,
    case when coalesce(p_issue, false) then v_user end,
    case when coalesce(p_issue, false) then now() end
  ) returning id into v_id;

  perform public._write_purchase_order_lines(v_id, p_lines);
  select total_amount into v_total from public.purchase_orders where id = v_id;

  return jsonb_build_object('id', v_id, 'po_no', v_no, 'status',
    case when coalesce(p_issue, false) then 'issued' else 'draft' end, 'total_amount', v_total);
end;
$function$;

-- ── Edit a draft ──────────────────────────────────────────────
create or replace function public.update_purchase_order(
  p_po_id         uuid,
  p_supplier_id   uuid,
  p_lines         jsonb,
  p_expected_date date default null,
  p_terms         text default null,
  p_notes         text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
  v_po  public.purchase_orders;
begin
  perform public.assert_my_role('admin', 'manager', 'store');
  select * into v_po from public.purchase_orders where id = p_po_id and org_id = v_org for update;
  if not found then
    raise exception 'Purchase order not found' using errcode = 'P0002';
  end if;
  if v_po.status <> 'draft' then
    raise exception '% is % and can no longer be edited', v_po.po_no, v_po.status using errcode = 'P0008';
  end if;
  if not exists (select 1 from public.suppliers where id = p_supplier_id and org_id = v_org and is_active) then
    raise exception 'Supplier not found or inactive' using errcode = 'P0002';
  end if;

  update public.purchase_orders
  set supplier_id = p_supplier_id,
      expected_date = p_expected_date,
      terms = nullif(trim(p_terms), ''),
      notes = nullif(trim(p_notes), ''),
      is_interstate = public._po_is_interstate(v_org, p_supplier_id)
  where id = p_po_id;

  perform public._write_purchase_order_lines(p_po_id, p_lines);
  return jsonb_build_object('id', p_po_id, 'po_no', v_po.po_no);
end;
$function$;

-- ── Issue (approve and send to the supplier) ──────────────────
create or replace function public.issue_purchase_order(p_po_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
  v_po  public.purchase_orders;
begin
  perform public.assert_my_role('admin', 'manager');
  select * into v_po from public.purchase_orders where id = p_po_id and org_id = v_org for update;
  if not found then
    raise exception 'Purchase order not found' using errcode = 'P0002';
  end if;
  if v_po.status <> 'draft' then
    raise exception '% is already %', v_po.po_no, v_po.status using errcode = 'P0008';
  end if;
  if not exists (select 1 from public.suppliers where id = v_po.supplier_id and is_active) then
    raise exception 'The supplier is inactive' using errcode = 'P0008';
  end if;
  update public.purchase_orders
  set status = 'issued', issued_by = auth.uid(), issued_at = now(),
      is_interstate = public._po_is_interstate(v_org, v_po.supplier_id)
  where id = p_po_id;
  return jsonb_build_object('id', p_po_id, 'po_no', v_po.po_no, 'status', 'issued');
end;
$function$;

-- ── Cancel (nothing received) or close short (partly received) ──
create or replace function public.close_purchase_order(p_po_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org    uuid := public.my_org();
  v_po     public.purchase_orders;
  v_status text;
begin
  perform public.assert_my_role('admin', 'manager');
  if nullif(trim(p_reason), '') is null then
    raise exception 'Give a reason' using errcode = '22023';
  end if;
  select * into v_po from public.purchase_orders where id = p_po_id and org_id = v_org for update;
  if not found then
    raise exception 'Purchase order not found' using errcode = 'P0002';
  end if;
  if v_po.status not in ('draft', 'issued', 'partially_received') then
    raise exception '% is already %', v_po.po_no, v_po.status using errcode = 'P0008';
  end if;
  v_status := case when v_po.status = 'partially_received' then 'closed' else 'cancelled' end;
  update public.purchase_orders
  set status = v_status, closed_by = auth.uid(), closed_at = now(), close_reason = trim(p_reason)
  where id = p_po_id;
  return jsonb_build_object('id', p_po_id, 'po_no', v_po.po_no, 'status', v_status);
end;
$function$;

-- ── Receive goods against the order (creates a GRN) ───────────
-- p_lines: [{ po_line_id, qty, notes? }]
create or replace function public.receive_purchase_order(
  p_po_id          uuid,
  p_lines          jsonb,
  p_receipt_date   date default null,
  p_transport_mode public.transport_mode default 'supplier_truck',
  p_vehicle_no     text default null,
  p_driver_name    text default null,
  p_challan_no     text default null,
  p_invoice_no     text default null,
  p_notes          text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org      uuid := public.my_org();
  v_user     uuid := auth.uid();
  v_date     date := coalesce(p_receipt_date, current_date);
  v_po       public.purchase_orders;
  v_grn_id   uuid;
  v_grn_no   text;
  v_in       record;
  v_line     public.purchase_order_lines;
  v_subtotal numeric := 0;
  v_gst      numeric := 0;
  v_count    int := 0;
  v_status   text;
begin
  perform public.assert_my_role('admin', 'manager', 'store');
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Enter the quantity received for at least one item' using errcode = '22023';
  end if;
  if v_date > current_date then
    raise exception 'Receipt date cannot be in the future' using errcode = '22023';
  end if;

  select * into v_po from public.purchase_orders where id = p_po_id and org_id = v_org for update;
  if not found then
    raise exception 'Purchase order not found' using errcode = 'P0002';
  end if;
  if v_po.status not in ('issued', 'partially_received') then
    raise exception 'Goods can only be received against an issued order (% is %)', v_po.po_no, v_po.status
      using errcode = 'P0008';
  end if;
  if v_date < v_po.po_date then
    raise exception 'Receipt date cannot be before the order date (%)', v_po.po_date using errcode = '22023';
  end if;

  v_grn_no := public.next_grn_no(v_org);
  insert into public.inbound_receipts (
    org_id, receipt_no, supplier_id, po_id, receipt_date, transport_mode, vehicle_no, driver_name,
    challan_no, invoice_no, total_amount, gst_amount, status, notes, received_by, created_by
  ) values (
    v_org, v_grn_no, v_po.supplier_id, v_po.id, v_date, coalesce(p_transport_mode, 'supplier_truck'),
    nullif(trim(p_vehicle_no), ''), nullif(trim(p_driver_name), ''), nullif(trim(p_challan_no), ''),
    nullif(trim(p_invoice_no), ''), 0, 0, 'received', nullif(trim(p_notes), ''), v_user, v_user
  ) returning id into v_grn_id;

  for v_in in
    select (x->>'po_line_id')::uuid as po_line_id, (x->>'qty')::numeric as qty, nullif(trim(x->>'notes'), '') as notes
    from jsonb_array_elements(p_lines) x
    order by 1
  loop
    if v_in.qty is null or v_in.qty = 0 then
      continue;
    end if;
    select * into v_line from public.purchase_order_lines
    where id = v_in.po_line_id and po_id = v_po.id
    for update;
    if not found then
      raise exception 'Line does not belong to %', v_po.po_no using errcode = 'P0002';
    end if;
    if v_in.qty < 0 then
      raise exception 'Received quantities must be greater than zero' using errcode = '22023';
    end if;
    if v_in.qty > v_line.qty - v_line.qty_received + 0.00001 then
      raise exception 'Only % more of this item is on order (line %)', v_line.qty - v_line.qty_received, v_line.sort_order
        using errcode = 'P0009';
    end if;

    insert into public.inbound_receipt_lines (
      receipt_id, item_id, po_line_id, qty_ordered, qty_received, unit_id, rate, gst_percent, notes
    ) values (
      v_grn_id, v_line.item_id, v_line.id, v_line.qty, v_in.qty, v_line.unit_id, v_line.rate, v_line.gst_percent, v_in.notes
    );
    perform public.receive_inventory(gen_random_uuid(), v_line.item_id, v_in.qty, v_line.rate,
      'inbound_receipt', v_grn_id, null, 'GRN ' || v_grn_no || ' against ' || v_po.po_no);

    update public.purchase_order_lines set qty_received = qty_received + v_in.qty where id = v_line.id;

    v_subtotal := v_subtotal + round(v_in.qty * v_line.rate, 2);
    v_gst := v_gst + round(round(v_in.qty * v_line.rate, 2) * v_line.gst_percent::text::numeric / 100, 2);
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'Enter the quantity received for at least one item' using errcode = '22023';
  end if;

  update public.inbound_receipts set total_amount = v_subtotal, gst_amount = v_gst where id = v_grn_id;

  v_status := case
    when not exists (select 1 from public.purchase_order_lines where po_id = v_po.id and qty_received < qty)
      then 'received'
    else 'partially_received'
  end;
  update public.purchase_orders set status = v_status where id = v_po.id;

  return jsonb_build_object('id', v_grn_id, 'receipt_no', v_grn_no, 'po_no', v_po.po_no,
    'po_status', v_status, 'lines', v_count, 'total_amount', v_subtotal, 'gst_amount', v_gst);
end;
$function$;

do $$ begin
  execute 'revoke execute on function public.create_purchase_order(uuid, jsonb, date, text, text, boolean, date) from public, anon';
  execute 'revoke execute on function public.update_purchase_order(uuid, uuid, jsonb, date, text, text) from public, anon';
  execute 'revoke execute on function public.issue_purchase_order(uuid) from public, anon';
  execute 'revoke execute on function public.close_purchase_order(uuid, text) from public, anon';
  execute 'revoke execute on function public.receive_purchase_order(uuid, jsonb, date, public.transport_mode, text, text, text, text, text) from public, anon';
end $$;
grant execute on function public.create_purchase_order(uuid, jsonb, date, text, text, boolean, date) to authenticated;
grant execute on function public.update_purchase_order(uuid, uuid, jsonb, date, text, text) to authenticated;
grant execute on function public.issue_purchase_order(uuid) to authenticated;
grant execute on function public.close_purchase_order(uuid, text) to authenticated;
grant execute on function public.receive_purchase_order(uuid, jsonb, date, public.transport_mode, text, text, text, text, text) to authenticated;
