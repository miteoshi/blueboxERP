-- ─────────────────────────────────────────────────────────────
-- Dispatch at the order's rate; sensible document dates
--
-- 1. A delivery challan used whatever rate the screen sent, so anyone
--    who can dispatch could change the price, and the invoice is raised
--    from the challan. The challan now always uses the sales order line's
--    approved rate; price corrections go through a credit note.
-- 2. A challan date can't be in the future or before the order date
--    (an invoice can't be dated in the future, so a future challan could
--    not be invoiced).
-- 3. A GRN date can't be in the future.
-- ─────────────────────────────────────────────────────────────

do $fix$
declare
  v_def text;
  v_new text;
begin
  -- 1 + 2: create_delivery_challan
  v_def := pg_get_functiondef('public.create_delivery_challan'::regproc);

  v_new := regexp_replace(v_def, 'x\.rate,(\s*)sol\.id as sol_id', 'sol.unit_rate as rate,\1sol.id as sol_id');
  if v_new = v_def then
    raise exception 'create_delivery_challan: rate select not found';
  end if;
  v_def := v_new;

  v_new := replace(v_def, 'v_dc_no := public.next_dc_no(v_org);',
    'if coalesce(p_challan_date, current_date) > current_date then
    raise exception ''Challan date cannot be in the future'' using errcode = ''22023'';
  end if;
  if coalesce(p_challan_date, current_date) < v_so.order_date then
    raise exception ''Challan date cannot be before the order date (%)'', v_so.order_date using errcode = ''22023'';
  end if;
  v_dc_no := public.next_dc_no(v_org);');
  if v_new = v_def then
    raise exception 'create_delivery_challan: numbering anchor not found';
  end if;
  execute v_new;

  -- 3: create_inbound_receipt
  v_def := pg_get_functiondef('public.create_inbound_receipt'::regproc);
  v_new := replace(v_def, 'v_grn_no := public.next_grn_no(v_org);',
    'if coalesce(p_receipt_date, current_date) > current_date then
    raise exception ''Receipt date cannot be in the future'' using errcode = ''22023'';
  end if;
  v_grn_no := public.next_grn_no(v_org);');
  if v_new = v_def then
    raise exception 'create_inbound_receipt: numbering anchor not found';
  end if;
  execute v_new;
end
$fix$;
