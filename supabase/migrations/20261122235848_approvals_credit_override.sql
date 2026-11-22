-- ─────────────────────────────────────────────────────────────
-- Approvals trail
--
-- 1. When an admin or manager converts a quotation that takes the customer
--    over their credit limit, record it in the approvals trail with the
--    exposure, limit and amount over, as an expired conversion already is.
--    The rule itself is unchanged: a sales user is refused (P0011).
-- 2. The trail is written only by create_quotation, set_quotation_status and
--    convert_quotation_to_sales_order. The insert policy let an admin or
--    manager add rows directly through the API, naming any user as the one
--    who acted, so it is removed.
-- ─────────────────────────────────────────────────────────────

do $$ begin
  execute 'alter table public.approvals drop constraint approvals_action_check';
  execute 'drop policy "org mgr creates approval" on public.approvals';
end $$;

alter table public.approvals add constraint approvals_action_check check (action = any (array[
  'approved', 'rejected', 'sent_for_approval', 'revision_requested', 'converted_after_expiry', 'converted_over_credit_limit'
]));

create or replace function public.convert_quotation_to_sales_order(
  p_quotation_id  uuid,
  p_allow_expired boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org(); v_user uuid := auth.uid(); v_qt public.quotations; v_so_id uuid; v_so_no text; v_limit numeric; v_credit jsonb; v_after numeric;
begin
  perform public.assert_my_role('admin', 'manager', 'sales');
  select * into v_qt from public.quotations where id = p_quotation_id and org_id = v_org for update;
  if not found then
    raise exception 'Quotation not found' using errcode = 'P0002';
  end if;
  if v_qt.status = 'converted' then
    raise exception 'Quotation % has already been converted', v_qt.quotation_no using errcode = 'P0008';
  end if;
  if v_qt.status <> 'approved' then
    raise exception 'Only approved quotations can be converted (this one is %)', v_qt.status using errcode = 'P0008';
  end if;
  if not exists (select 1 from public.quotation_lines where quotation_id = p_quotation_id) then
    raise exception 'Quotation has no lines' using errcode = '22023';
  end if;

  -- Expired: a manager has to say so explicitly, and it is logged
  if v_qt.valid_until is not null and v_qt.valid_until < current_date then
    if not coalesce(p_allow_expired, false) then
      raise exception 'Quotation % expired on %. Re-quote at current prices, or ask a manager to convert it as it stands.',
        v_qt.quotation_no, v_qt.valid_until using errcode = 'P0008';
    end if;
    perform public.assert_my_role('admin', 'manager');
    insert into public.approvals (org_id, ref_type, ref_id, action, actioned_by, comments)
    values (v_org, 'quotation', p_quotation_id, 'converted_after_expiry', v_user,
            'Converted after expiry on ' || v_qt.valid_until);
  end if;

  -- Over the credit limit: a sales user is refused; an admin or manager may
  -- go ahead, and that is logged
  select credit_limit into v_limit from public.clients where id = v_qt.client_id and org_id = v_org;
  if coalesce(v_limit, 0) > 0 then
    v_credit := public.client_credit_status(v_qt.client_id);
    v_after := (v_credit->>'exposure')::numeric + v_qt.total_amount;
    if v_after > v_limit then
      if public.my_role() not in ('admin', 'manager') then
        raise exception 'Credit limit exceeded: exposure would be ₹% against a limit of ₹%. Ask a manager to approve this order.',
          round(v_after, 2), v_limit using errcode = 'P0011';
      end if;
      insert into public.approvals (org_id, ref_type, ref_id, action, actioned_by, comments)
      values (v_org, 'quotation', p_quotation_id, 'converted_over_credit_limit', v_user,
              'Exposure ₹' || to_char(round(v_after, 2), 'FM99999999999990.00') || ' against a limit of ₹' || to_char(v_limit, 'FM99999999999990.00')
              || ' (₹' || to_char(round(v_after - v_limit, 2), 'FM99999999999990.00') || ' over)');
    end if;
  end if;
  v_so_no := public.next_so_no(v_org);
  insert into public.sales_orders (org_id, so_number, created_by, quotation_id, client_id, order_date, status, subtotal, gst_amount, total_amount, advance_paid, balance_due, payment_terms, delivery_date, notes)
  values (v_org, v_so_no, v_user, v_qt.id, v_qt.client_id, current_date, 'confirmed', v_qt.subtotal, v_qt.gst_amount, v_qt.total_amount, 0, v_qt.total_amount, v_qt.payment_terms,
    case when v_qt.delivery_days is not null then current_date + v_qt.delivery_days end,
    nullif(concat_ws(E'\n\n', nullif(v_qt.notes, ''), case when nullif(v_qt.transport_note, '') is not null then 'Transport: ' || v_qt.transport_note end), ''))
  returning id into v_so_id;
  insert into public.sales_order_lines (so_id, item_id, description, qty, unit_id, unit_rate, gst_percent, sort_order)
  select v_so_id, ql.item_id, ql.description, ql.qty, ql.unit_id, ql.unit_rate, ql.gst_percent, (row_number() over (order by ql.sort_order nulls last, ql.id) - 1)::integer
  from public.quotation_lines ql where ql.quotation_id = p_quotation_id;
  update public.quotations set status = 'converted' where id = p_quotation_id;
  return jsonb_build_object('success', true, 'id', v_so_id, 'so_number', v_so_no);
end;
$function$;
