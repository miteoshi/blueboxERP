-- ─────────────────────────────────────────────────────────────
-- Statement of account for a customer or a supplier.
--
-- One row per document in the period, oldest first, with a running
-- balance, preceded by an opening-balance row that carries everything
-- dated before the period. Cancelled documents are left out, the same
-- as the receivables and payables views, so the closing balance agrees
-- with them: invoices outstanding less unallocated receipts for a
-- customer, bills outstanding less advances for a supplier.
--
-- Customer balance: positive = the customer owes us.
-- Supplier balance: positive = we owe the supplier.
--
-- SECURITY INVOKER: every table is read under the caller's own row
-- level security. The role check on top stops a role that can read
-- only part of the picture (store reads invoices but not receipts)
-- from being shown a statement with the payments missing.
-- ─────────────────────────────────────────────────────────────

create function public.client_statement(
  p_client_id uuid,
  p_from date,
  p_to date
) returns table (
  seq integer,
  entry_date date,
  kind text,
  doc_id uuid,
  doc_no text,
  detail text,
  debit numeric,
  credit numeric,
  balance numeric
)
language plpgsql
stable
security invoker
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
  v_role public.user_role := public.my_role();
begin
  -- assert_my_role() is for the definer-rights workflow functions and is
  -- not callable from here, so the same check is written out
  if v_role is null or v_role not in ('admin', 'manager', 'sales', 'viewer') then
    raise exception 'Unauthorized: your role (%) cannot see a customer statement', coalesce(v_role::text, 'none')
      using errcode = 'P0005';
  end if;

  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Choose a period that starts on or before the day it ends' using errcode = '22023';
  end if;
  if not exists (select 1 from public.clients c where c.id = p_client_id and c.org_id = v_org) then
    raise exception 'Client not found' using errcode = 'P0002';
  end if;

  return query
  with entries as (
    select i.invoice_date as d, i.created_at as at, 'invoice'::text as k, i.id, i.invoice_no as no,
           null::text as detail, i.total_amount as dr, 0::numeric as cr
    from public.sales_invoices i
    where i.org_id = v_org and i.client_id = p_client_id and i.status = 'issued' and i.invoice_date <= p_to
    union all
    select r.receipt_date, r.created_at, 'receipt', r.id, r.receipt_no,
           nullif(concat_ws(' · ', nullif(r.mode, ''), nullif(r.reference, '')), ''), 0, r.amount
    from public.customer_receipts r
    where r.org_id = v_org and r.client_id = p_client_id and r.status = 'active' and r.receipt_date <= p_to
    union all
    select n.note_date, n.created_at, 'credit_note', n.id, n.credit_note_no, n.reason, 0, n.total_amount
    from public.credit_notes n
    where n.org_id = v_org and n.client_id = p_client_id and n.status = 'issued' and n.note_date <= p_to
  ),
  opening as (
    select coalesce(sum(e.dr - e.cr), 0) as amount from entries e where e.d < p_from
  ),
  period as (
    select e.*, (row_number() over (order by e.d, e.at, e.no))::integer as rn
    from entries e where e.d >= p_from
  )
  select 0, p_from, 'opening'::text, null::uuid, null::text, null::text,
         greatest(o.amount, 0), greatest(-o.amount, 0), o.amount
  from opening o
  union all
  select p.rn, p.d, p.k, p.id, p.no, p.detail, p.dr, p.cr,
         o.amount + sum(p.dr - p.cr) over (order by p.rn)
  from period p cross join opening o
  order by 1;
end;
$function$;

comment on function public.client_statement(uuid, date, date) is
  'Statement of account for a customer: opening balance, then issued invoices (debit), active receipts and issued credit notes (credit) in the period with a running balance. Positive balance = the customer owes us. Admin, manager, sales and viewer.';

create function public.supplier_statement(
  p_supplier_id uuid,
  p_from date,
  p_to date
) returns table (
  seq integer,
  entry_date date,
  kind text,
  doc_id uuid,
  doc_no text,
  detail text,
  debit numeric,
  credit numeric,
  balance numeric
)
language plpgsql
stable
security invoker
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
  v_role public.user_role := public.my_role();
begin
  if v_role is null or v_role not in ('admin', 'manager', 'viewer') then
    raise exception 'Unauthorized: your role (%) cannot see a supplier statement', coalesce(v_role::text, 'none')
      using errcode = 'P0005';
  end if;

  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Choose a period that starts on or before the day it ends' using errcode = '22023';
  end if;
  if not exists (select 1 from public.suppliers s where s.id = p_supplier_id and s.org_id = v_org) then
    raise exception 'Supplier not found' using errcode = 'P0002';
  end if;

  return query
  with entries as (
    select b.bill_date as d, b.created_at as at, 'bill'::text as k, b.id, b.bill_no as no,
           nullif(b.supplier_invoice_no, '') as detail, 0::numeric as dr, b.total_amount as cr
    from public.supplier_bills b
    where b.org_id = v_org and b.supplier_id = p_supplier_id and b.status = 'posted' and b.bill_date <= p_to
    union all
    select y.payment_date, y.created_at, 'payment', y.id, y.payment_no,
           nullif(concat_ws(' · ', nullif(y.mode, ''), nullif(y.reference, '')), ''), y.amount, 0
    from public.supplier_payments y
    where y.org_id = v_org and y.supplier_id = p_supplier_id and y.status = 'active' and y.payment_date <= p_to
    union all
    select n.note_date, n.created_at, 'debit_note', n.id, n.debit_note_no, n.reason, n.total_amount, 0
    from public.debit_notes n
    where n.org_id = v_org and n.supplier_id = p_supplier_id and n.status = 'issued' and n.note_date <= p_to
  ),
  opening as (
    select coalesce(sum(e.cr - e.dr), 0) as amount from entries e where e.d < p_from
  ),
  period as (
    select e.*, (row_number() over (order by e.d, e.at, e.no))::integer as rn
    from entries e where e.d >= p_from
  )
  select 0, p_from, 'opening'::text, null::uuid, null::text, null::text,
         greatest(-o.amount, 0), greatest(o.amount, 0), o.amount
  from opening o
  union all
  select p.rn, p.d, p.k, p.id, p.no, p.detail, p.dr, p.cr,
         o.amount + sum(p.cr - p.dr) over (order by p.rn)
  from period p cross join opening o
  order by 1;
end;
$function$;

comment on function public.supplier_statement(uuid, date, date) is
  'Statement of account for a supplier: opening balance, then posted bills (credit), active payments and issued debit notes (debit) in the period with a running balance. Positive balance = we owe the supplier. Admin, manager and viewer.';

do $$ begin
  execute 'revoke all on function public.client_statement(uuid, date, date) from public, anon';
  execute 'revoke all on function public.supplier_statement(uuid, date, date) from public, anon';
end $$;
grant execute on function public.client_statement(uuid, date, date) to authenticated;
grant execute on function public.supplier_statement(uuid, date, date) to authenticated;
