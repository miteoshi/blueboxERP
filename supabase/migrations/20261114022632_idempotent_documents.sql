-- ─────────────────────────────────────────────────────────────
-- One document per submission
--
-- A request that times out on its way back still committed in the
-- database. Until now a retry — the user pressing the button again, or a
-- flaky connection resending — created a second challan, invoice, GRN,
-- receipt or payment, with a second number, and moved stock twice.
--
-- Every document RPC now takes p_request_id. The first call claims it; a
-- second call with the same id is refused with P0012 instead of creating
-- anything. The claim lives in the same transaction as the work, so a call
-- that fails rolls the claim back too and the id can be used again.
--
-- The functions are rewritten from their own definitions, so only the
-- parameter and the guard change — nothing else about their behaviour.
-- ─────────────────────────────────────────────────────────────

create table public.document_requests (
  org_id     uuid not null references public.organizations(id),
  request_id uuid not null,
  operation  text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (org_id, request_id)
);
create index document_requests_created_at_idx on public.document_requests (created_at);
create index document_requests_created_by_idx on public.document_requests (created_by);

-- Only the guard below touches this table; nobody reads it from the client.
alter table public.document_requests enable row level security;
do $$ begin
  execute 'revoke all on public.document_requests from anon, authenticated';
end $$;

comment on table public.document_requests is
  'Submission ids claimed by document RPCs, so a retried request cannot create a second document. RLS on with no policies on purpose: only _claim_document_request() reads or writes it.';

create or replace function public._claim_document_request(p_request_id uuid, p_operation text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid;
begin
  -- No id supplied: nothing to protect against (older clients, SQL callers)
  if p_request_id is null then
    return;
  end if;
  v_org := public.my_org();

  insert into public.document_requests (org_id, request_id, operation, created_by)
  values (v_org, p_request_id, p_operation, auth.uid())
  on conflict (org_id, request_id) do nothing;

  -- We claimed it: carry on and do the work
  if found then
    return;
  end if;

  -- Already claimed, so an earlier attempt got through. Either way, this call
  -- must not create a second document. (A concurrent attempt that is still
  -- running blocks the insert above; if it rolls back we claim the id after
  -- all and carry on.)
  raise exception 'This was already submitted and saved. Refresh the page to see it.'
    using errcode = 'P0012', hint = p_operation;
end;
$function$;

do $$ begin
  execute 'revoke execute on function public._claim_document_request(uuid, text) from public, anon, authenticated';
end $$;

-- Claims are only useful while a client might retry; a month is generous
create or replace function public.prune_document_requests()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer;
begin
  delete from public.document_requests where created_at < now() - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

do $$ begin
  execute 'revoke execute on function public.prune_document_requests() from public, anon, authenticated';
end $$;

-- ── Add the parameter and the guard to every document RPC ─────
-- Each function is rebuilt from pg_get_functiondef, so its body is carried
-- over unchanged apart from the one inserted line. If either edit does not
-- apply, the migration fails rather than silently leaving a function
-- unprotected.
do $migrate$
declare
  v_fn     record;
  v_def    text;
  v_next   text;
  v_newarg text;
begin
  for v_fn in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as idargs
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'create_delivery_challan',
        'create_sales_invoice',
        'create_inbound_receipt',
        'receive_purchase_order',
        'record_customer_receipt',
        'record_supplier_payment',
        'create_credit_note',
        'create_debit_note',
        'create_production_order'
      ])
    order by p.proname
  loop
    v_def := pg_get_functiondef(v_fn.oid);

    -- 1. p_request_id goes last, with a default, so existing callers still work
    v_next := regexp_replace(v_def, '\)\s*\n\s*RETURNS ', ', p_request_id uuid DEFAULT NULL)' || E'\n RETURNS ');
    if v_next = v_def then
      raise exception 'Could not add p_request_id to %', v_fn.proname;
    end if;
    v_def := v_next;

    -- 2. The guard goes straight after the role check, before any work
    v_next := regexp_replace(
      v_def,
      '(perform public\.assert_my_role\([^;]*\);)',
      '\1' || E'\n  perform public._claim_document_request(p_request_id, ' || quote_literal(v_fn.proname) || ');'
    );
    if v_next = v_def then
      raise exception 'Could not add the guard to % (no assert_my_role call found)', v_fn.proname;
    end if;

    execute format('drop function public.%I(%s)', v_fn.proname, v_fn.idargs);
    execute v_next;

    v_newarg := v_fn.idargs || ', p_request_id uuid';
    execute format('revoke execute on function public.%I(%s) from public, anon', v_fn.proname, v_newarg);
    execute format('grant execute on function public.%I(%s) to authenticated', v_fn.proname, v_newarg);
  end loop;
end $migrate$;

-- Nightly tidy-up, alongside the existing reservation and reconcile jobs
do $$ begin
  perform cron.schedule('bluebox-prune-document-requests', '40 20 * * *', 'select public.prune_document_requests()');
exception when others then
  raise notice 'Could not schedule the prune job (%); run it manually or schedule it later', sqlerrm;
end $$;
