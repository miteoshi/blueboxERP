-- ─────────────────────────────────────────────────────────────
-- Documents and stock can only change through the RPCs
--
-- RLS lets roles write these tables directly (e.g. sales could set a
-- sales order to 'delivered' or rewrite its totals, store could insert
-- stock_movements without an ops-log entry). Every legitimate write now
-- goes through a SECURITY DEFINER function, which runs as the function
-- owner — so a direct write made by a signed-in user through the API
-- (current_user = authenticated / anon) is the only thing these
-- triggers refuse. service_role and direct DB access are unaffected.
--
-- Fully RPC-managed (no direct INSERT / UPDATE / DELETE):
--   sales_order_lines, delivery_challans, delivery_challan_lines,
--   inbound_receipts, inbound_receipt_lines, production_order_items,
--   quotation_lines, stock_movements
-- Partially managed (header fields like notes stay editable; state,
-- numbering and money columns are protected; no direct INSERT/DELETE):
--   sales_orders, production_orders, quotations
-- ─────────────────────────────────────────────────────────────

create or replace function public.block_direct_writes()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- SECURITY INVOKER on purpose: current_user is the caller's role.
  if current_user in ('authenticated', 'anon') then
    raise exception '% on % must go through the application workflow', tg_op, tg_table_name
      using errcode = '42501',
            hint = 'Use the corresponding RPC (e.g. create_delivery_challan, create_inbound_receipt).';
  end if;
  return coalesce(new, old);
end;
$function$;

create or replace function public.guard_document_columns()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_old jsonb;
  v_new jsonb;
  v_col text;
  v_protected text[];
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;

  if tg_op <> 'UPDATE' then
    raise exception '% on % must go through the application workflow', tg_op, tg_table_name
      using errcode = '42501';
  end if;

  v_protected := case tg_table_name
    when 'sales_orders' then array[
      'org_id', 'so_number', 'quotation_id', 'client_id', 'status',
      'subtotal', 'gst_amount', 'total_amount', 'advance_paid', 'balance_due',
      'created_by', 'approved_by', 'approved_at', 'order_date']
    when 'production_orders' then array[
      'org_id', 'po_number', 'so_id', 'status', 'start_date', 'completed_date', 'created_by']
    when 'quotations' then array[
      'org_id', 'quotation_no', 'client_id', 'status',
      'subtotal', 'gst_amount', 'total_amount', 'created_by', 'approved_by', 'approved_at']
    else array[]::text[]
  end;

  v_old := to_jsonb(old);
  v_new := to_jsonb(new);

  foreach v_col in array v_protected loop
    if v_old -> v_col is distinct from v_new -> v_col then
      raise exception 'Column %.% can only be changed through the application workflow', tg_table_name, v_col
        using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$function$;

-- Fully RPC-managed tables
do $$
declare
  t text;
begin
  foreach t in array array[
    'sales_order_lines', 'delivery_challans', 'delivery_challan_lines',
    'inbound_receipts', 'inbound_receipt_lines', 'production_order_items',
    'quotation_lines', 'stock_movements'
  ] loop
    execute format('drop trigger if exists trg_block_direct_writes on public.%I', t);
    execute format(
      'create trigger trg_block_direct_writes before insert or update or delete on public.%I
         for each row execute function public.block_direct_writes()', t);
  end loop;

  foreach t in array array['sales_orders', 'production_orders', 'quotations'] loop
    execute format('drop trigger if exists trg_guard_document_columns on public.%I', t);
    execute format(
      'create trigger trg_guard_document_columns before insert or update or delete on public.%I
         for each row execute function public.guard_document_columns()', t);
  end loop;
end
$$;

revoke execute on function public.block_direct_writes() from public, anon, authenticated;
revoke execute on function public.guard_document_columns() from public, anon, authenticated;
