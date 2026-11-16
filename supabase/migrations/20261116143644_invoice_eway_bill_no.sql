-- ─────────────────────────────────────────────────────────────
-- Keep the e-way bill number on the invoice it was issued for
--
-- The e-way bill file is prepared from the invoice, uploaded to the portal,
-- and the portal answers with a 12-digit number. Until now that number had
-- nowhere to go: it was not on the invoice, not on the print that travels
-- with the goods, and could not be looked up later.
--
-- sales_invoices is written only through functions, so the number is
-- recorded through one too. Every change lands in the audit log through the
-- table's existing audit trigger.
-- ─────────────────────────────────────────────────────────────

alter table public.sales_invoices
  add column eway_bill_no text,
  add column eway_bill_date date,
  add constraint sales_invoices_eway_bill_no_format
    check (eway_bill_no is null or eway_bill_no ~ '^[0-9]{12}$'),
  add constraint sales_invoices_eway_bill_date_with_no
    check ((eway_bill_no is null) = (eway_bill_date is null));

comment on column public.sales_invoices.eway_bill_no is
  'The 12-digit e-way bill number the portal issued for this consignment. Set through set_invoice_eway_bill().';

-- One live invoice per e-way bill number. A cancelled invoice keeps its
-- number on record without blocking the invoice that replaces it.
create unique index sales_invoices_eway_bill_no_live
  on public.sales_invoices (org_id, eway_bill_no)
  where eway_bill_no is not null and status = 'issued';

create function public.set_invoice_eway_bill(
  p_invoice_id uuid,
  p_eway_bill_no text,
  p_eway_bill_date date default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
  v_inv public.sales_invoices;
  v_no text := nullif(regexp_replace(coalesce(p_eway_bill_no, ''), '\s', '', 'g'), '');
  v_date date;
  v_other text;
begin
  -- Whoever raises the invoice or sends the goods out may record the number
  perform public.assert_my_role('admin', 'manager', 'sales', 'store');

  select * into v_inv from public.sales_invoices
  where id = p_invoice_id and org_id = v_org for update;
  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if v_inv.status = 'cancelled' then
    raise exception 'Invoice % is cancelled', v_inv.invoice_no using errcode = 'P0008';
  end if;

  -- An empty number takes the e-way bill off the invoice
  if v_no is null then
    update public.sales_invoices set eway_bill_no = null, eway_bill_date = null where id = p_invoice_id;
    return jsonb_build_object('id', p_invoice_id, 'invoice_no', v_inv.invoice_no, 'eway_bill_no', null, 'eway_bill_date', null);
  end if;

  if v_no !~ '^[0-9]{12}$' then
    raise exception 'An e-way bill number has 12 digits' using errcode = '22023';
  end if;

  v_date := coalesce(p_eway_bill_date, current_date);
  if v_date > current_date then
    raise exception 'The e-way bill date cannot be in the future' using errcode = '22023';
  end if;
  if v_date < v_inv.invoice_date then
    raise exception 'The e-way bill date cannot be before the invoice date (%)', v_inv.invoice_date using errcode = '22023';
  end if;

  select invoice_no into v_other from public.sales_invoices
  where org_id = v_org and eway_bill_no = v_no and status = 'issued' and id <> p_invoice_id
  limit 1;
  if v_other is not null then
    raise exception 'E-way bill % is already recorded on invoice %', v_no, v_other using errcode = 'P0008';
  end if;

  update public.sales_invoices set eway_bill_no = v_no, eway_bill_date = v_date where id = p_invoice_id;
  return jsonb_build_object('id', p_invoice_id, 'invoice_no', v_inv.invoice_no, 'eway_bill_no', v_no, 'eway_bill_date', v_date);
end;
$function$;

comment on function public.set_invoice_eway_bill(uuid, text, date) is
  'Records, changes or (with an empty number) removes the e-way bill number on an issued invoice. Admin, manager, sales and store.';

do $$ begin
  execute 'revoke all on function public.set_invoice_eway_bill(uuid, text, date) from public, anon';
end $$;
grant execute on function public.set_invoice_eway_bill(uuid, text, date) to authenticated;
