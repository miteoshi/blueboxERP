-- ─────────────────────────────────────────────────────────────
-- Sales order balance follows invoice payments and credit notes
--
-- Before: a sales order counted only receipts recorded against the order
-- itself. A payment recorded against the invoice (Payments page) or a
-- credit note left the order showing the full balance due, and the order's
-- "Record payment" box invited collecting it again.
--
-- Now, for each order:
--   • money received against the order counts in full to that order
--     (whether still unapplied or applied to an invoice);
--   • a credit note counts to the order whose goods it credits (credit note
--     line → invoice line → order line);
--   • other money applied to an invoice is shared among the orders on that
--     invoice in proportion to what each still owes on it. One invoice can
--     cover several orders of the same client.
-- advance_paid now means "received or settled" for the order.
-- ─────────────────────────────────────────────────────────────

create or replace function public._recalc_so_advance(p_so_id uuid)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  with
  -- issued invoices that cover this order
  my_invoices as (
    select distinct l.invoice_id as id
    from public.sales_invoice_lines l
    join public.sales_order_lines sol on sol.id = l.so_line_id
    join public.sales_invoices i on i.id = l.invoice_id and i.status = 'issued'
    where sol.so_id = p_so_id
  ),
  -- each order's portion of each of those invoices (by line totals)
  portions as (
    select l.invoice_id, sol.so_id,
           i.total_amount * sum(l.line_total)
             / nullif(sum(sum(l.line_total)) over (partition by l.invoice_id), 0) as portion
    from public.sales_invoice_lines l
    join public.sales_order_lines sol on sol.id = l.so_line_id
    join public.sales_invoices i on i.id = l.invoice_id
    where l.invoice_id in (select id from my_invoices)
    group by l.invoice_id, sol.so_id, i.total_amount
  ),
  -- money received against an order and applied to the invoice
  tagged_on as (
    select a.invoice_id, r.so_id, sum(a.amount) as amt
    from public.receipt_allocations a
    join public.customer_receipts r on r.id = a.receipt_id and r.status = 'active'
    where a.invoice_id in (select id from my_invoices) and r.so_id is not null
    group by a.invoice_id, r.so_id
  ),
  -- credit notes, attributed to the order whose goods they credit
  credited_on as (
    select n.invoice_id, sol.so_id,
           sum(n.total_amount * cl.line_total / nullif(nt.lines_total, 0)) as amt
    from public.credit_notes n
    join (select credit_note_id, sum(line_total) as lines_total
          from public.credit_note_lines group by credit_note_id) nt on nt.credit_note_id = n.id
    join public.credit_note_lines cl on cl.credit_note_id = n.id
    join public.sales_invoice_lines il on il.id = cl.invoice_line_id
    join public.sales_order_lines sol on sol.id = il.so_line_id
    where n.status = 'issued' and n.invoice_id in (select id from my_invoices)
    group by n.invoice_id, sol.so_id
  ),
  owing as (
    select p.invoice_id, p.so_id,
           greatest(p.portion - coalesce(t.amt, 0) - coalesce(c.amt, 0), 0) as owing,
           coalesce(c.amt, 0) as credited
    from portions p
    left join tagged_on t on t.invoice_id = p.invoice_id and t.so_id = p.so_id
    left join credited_on c on c.invoice_id = p.invoice_id and c.so_id = p.so_id
  ),
  -- money applied to the invoice that isn't tagged to one of its orders
  shared as (
    select a.invoice_id, sum(a.amount) as amt
    from public.receipt_allocations a
    join public.customer_receipts r on r.id = a.receipt_id and r.status = 'active'
    where a.invoice_id in (select id from my_invoices)
      and (r.so_id is null
           or not exists (select 1 from portions p where p.invoice_id = a.invoice_id and p.so_id = r.so_id))
    group by a.invoice_id
  ),
  via_invoices as (
    select coalesce(sum(o.credited + coalesce(sh.amt, 0) * o.owing / nullif(tot.owing, 0)), 0) as v
    from owing o
    join (select invoice_id, sum(owing) as owing from owing group by invoice_id) tot on tot.invoice_id = o.invoice_id
    left join shared sh on sh.invoice_id = o.invoice_id
    where o.so_id = p_so_id
  ),
  tagged as (
    select coalesce(sum(amount), 0) as v
    from public.customer_receipts
    where so_id = p_so_id and status = 'active'
  ),
  total as (
    select round((select v from tagged) + (select v from via_invoices), 2) as v
  )
  update public.sales_orders s
  set advance_paid = least(s.total_amount, (select v from total)),
      balance_due  = greatest(s.total_amount - (select v from total), 0)
  where s.id = p_so_id;
$function$;

revoke execute on function public._recalc_so_advance(uuid) from public, anon, authenticated;

-- Invoice paid / credited / cancelled → recompute every order it covers
create or replace function public._so_settlement_from_invoice()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_so uuid;
begin
  for v_so in
    select distinct sol.so_id
    from public.sales_invoice_lines l
    join public.sales_order_lines sol on sol.id = l.so_line_id
    where l.invoice_id = new.id
    order by 1
  loop
    perform public._recalc_so_advance(v_so);
  end loop;
  return null;
end;
$function$;

-- Receipt applied / unapplied / cancelled → recompute its order
create or replace function public._so_settlement_from_receipt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.so_id is not null then
    perform public._recalc_so_advance(new.so_id);
  end if;
  return null;
end;
$function$;

do $$ begin
  execute 'revoke execute on function public._so_settlement_from_invoice() from public, anon, authenticated';
  execute 'revoke execute on function public._so_settlement_from_receipt() from public, anon, authenticated';
end $$;

create trigger trg_so_settlement_from_invoice
  after update of amount_paid, amount_credited, status on public.sales_invoices
  for each row
  when (old.amount_paid is distinct from new.amount_paid
        or old.amount_credited is distinct from new.amount_credited
        or old.status is distinct from new.status)
  execute function public._so_settlement_from_invoice();

create trigger trg_so_settlement_from_receipt
  after update of amount_allocated, status on public.customer_receipts
  for each row
  when (old.amount_allocated is distinct from new.amount_allocated
        or old.status is distinct from new.status)
  execute function public._so_settlement_from_receipt();

-- A payment recorded on an order may not exceed the order's real balance
do $fix$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_functiondef('public.record_customer_receipt'::regproc);
  v_new := regexp_replace(
    v_def,
    'select coalesce\(sum\(amount\), 0\) into v_so_paid\s+from public\.customer_receipts\s+where so_id = p_so_id and status = ''active'';',
    'v_so_paid := v_so.total_amount - coalesce(v_so.balance_due, v_so.total_amount);'
  );
  if v_new = v_def then
    raise exception 'record_customer_receipt: order balance check not found';
  end if;
  execute v_new;
end
$fix$;

-- A payment recorded on an order is applied to any invoice that covers the
-- order's goods, including an invoice shared with other orders (whose
-- sales_invoices.so_id is empty).
do $fix$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_functiondef('public._allocate_receipt_fifo'::regproc);
  v_new := replace(
    v_def,
    'and (p_so_id is null or so_id = p_so_id)',
    'and (p_so_id is null or exists (
             select 1 from public.sales_invoice_lines l
             join public.sales_order_lines sol on sol.id = l.so_line_id
             where l.invoice_id = sales_invoices.id and sol.so_id = p_so_id))'
  );
  if v_new = v_def then
    raise exception '_allocate_receipt_fifo: order filter not found';
  end if;
  execute v_new;
end
$fix$;

-- Recompute every existing order
select public._recalc_so_advance(id) from public.sales_orders;
