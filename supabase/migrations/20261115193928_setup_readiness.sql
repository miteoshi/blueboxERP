-- ─────────────────────────────────────────────────────────────
-- Tell the user what is stopping them invoicing, before they try
--
-- create_sales_invoice refuses, correctly, without the company GSTIN and
-- state code, without a usable state on the client, and without an HSN code
-- on each item sold to a GST-registered buyer. All three are right to
-- enforce — a tax invoice is not valid otherwise — but the user only meets
-- them at the end, after picking challans and filling the form in.
--
-- On this database right now: no organization has a GSTIN, address or state
-- code, one of the two clients has "mumbai" typed into its state field, 33
-- of 309 items have no HSN code, and two delivered challans are waiting to
-- be invoiced. Nothing in the app says so until the save fails.
--
-- This view puts the same checks in one place so they can be shown up front,
-- with a sample of the records to fix. It is read-only and enforces nothing.
-- ─────────────────────────────────────────────────────────────

create view public.v_setup_readiness with (security_invoker = true) as
  with org as (
    select o.id as org_id,
           o.name,
           nullif(trim(coalesce(o.gst_number, '')), '') as gst_number,
           nullif(trim(coalesce(o.state_code, '')), '') as state_code,
           nullif(trim(coalesce(o.address, '')), '') as address,
           nullif(trim(coalesce(o.bank_account_no, '')), '') as bank_account_no
    from public.organizations o
  ),
  -- No state code, and none derivable from a GSTIN: CGST/SGST versus IGST
  -- cannot be decided, so this client cannot be invoiced
  stateless_clients as (
    select c.org_id, c.id, c.name, c.state,
           row_number() over (partition by c.org_id order by c.name) as rn
    from public.clients c
    where c.is_active
      and nullif(trim(coalesce(c.state_code, '')), '') is null
      and nullif(trim(coalesce(left(c.gst_number, 2), '')), '') is null
  ),
  client_gaps as (
    select org_id,
           count(*) as n,
           jsonb_agg(jsonb_build_object('id', id, 'name', name, 'state', state) order by name)
             filter (where rn <= 10) as sample
    from stateless_clients
    group by org_id
  ),
  -- An HSN code is required on every line of a B2B tax invoice
  hsnless_items as (
    select i.org_id, i.id, i.name, i.item_code,
           row_number() over (partition by i.org_id order by i.item_code) as rn
    from public.items i
    where i.is_active and nullif(trim(coalesce(i.hsn_code, '')), '') is null
  ),
  item_gaps as (
    select org_id,
           count(*) as n,
           jsonb_agg(jsonb_build_object('id', id, 'name', name, 'code', item_code) order by item_code)
             filter (where rn <= 10) as sample
    from hsnless_items
    group by org_id
  ),
  waiting as (
    select d.org_id, count(*) as n
    from public.delivery_challans d
    where d.status in ('dispatched', 'delivered')
      and not exists (select 1 from public.sales_invoice_lines l where l.challan_id = d.id)
    group by d.org_id
  )
  select org.org_id,
         org.name as company_name,
         (org.gst_number is not null) as has_gstin,
         (org.state_code is not null) as has_state_code,
         (org.address is not null) as has_address,
         (org.bank_account_no is not null) as has_bank_details,
         -- Exactly what create_sales_invoice insists on
         (org.gst_number is not null and org.state_code is not null) as can_invoice,
         coalesce(cg.n, 0) as clients_missing_state,
         coalesce(cg.sample, '[]'::jsonb) as clients_missing_state_sample,
         coalesce(ig.n, 0) as items_missing_hsn,
         coalesce(ig.sample, '[]'::jsonb) as items_missing_hsn_sample,
         coalesce(w.n, 0) as challans_awaiting_invoice
  from org
  left join client_gaps cg on cg.org_id = org.org_id
  left join item_gaps ig on ig.org_id = org.org_id
  left join waiting w on w.org_id = org.org_id;

comment on view public.v_setup_readiness is
  'What is still missing before tax invoices can be raised: the company GSTIN and state code (which create_sales_invoice requires), clients with no usable state, and items with no HSN code, each with a sample of up to 10 records to fix. Reports only; enforces nothing.';

do $$ begin
  execute 'revoke all on public.v_setup_readiness from anon, public';
  execute 'revoke insert, update, delete, truncate, references, trigger on public.v_setup_readiness from authenticated';
end $$;
grant select on public.v_setup_readiness to authenticated;
