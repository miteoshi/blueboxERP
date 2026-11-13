-- ─────────────────────────────────────────────────────────────
-- A quotation's validity means something at conversion
--
-- valid_until was recorded and printed on the quotation, but nothing
-- stopped an expired quotation being turned into a sales order months
-- later at prices the business no longer honours.
--
-- Conversion now refuses an expired quotation. An admin or manager can
-- still convert one deliberately by passing p_allow_expired, which is
-- recorded in the approvals trail; sales cannot override it. Quotations
-- with no valid_until are open-ended, as before.
-- ─────────────────────────────────────────────────────────────

-- The approvals trail only allowed the four quotation-approval actions
do $$ begin
  execute 'alter table public.approvals drop constraint approvals_action_check';
  execute $c$alter table public.approvals add constraint approvals_action_check
    check (action = any (array['approved', 'rejected', 'sent_for_approval', 'revision_requested', 'converted_after_expiry']))$c$;
end $$;

do $$ begin
  execute 'drop function public.convert_quotation_to_sales_order(uuid)';
end $$;

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
  v_org uuid := public.my_org(); v_user uuid := auth.uid(); v_qt public.quotations; v_so_id uuid; v_so_no text; v_limit numeric; v_credit jsonb;
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

  select credit_limit into v_limit from public.clients where id = v_qt.client_id;
  if coalesce(v_limit, 0) > 0 and public.my_role() = 'sales' then
    v_credit := public.client_credit_status(v_qt.client_id);
    if (v_credit->>'exposure')::numeric + v_qt.total_amount > v_limit then
      raise exception 'Credit limit exceeded: exposure would be ₹% against a limit of ₹%. Ask a manager to approve this order.',
        round((v_credit->>'exposure')::numeric + v_qt.total_amount, 2), v_limit using errcode = 'P0011';
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

do $$ begin
  execute 'revoke execute on function public.convert_quotation_to_sales_order(uuid, boolean) from public, anon';
end $$;
grant execute on function public.convert_quotation_to_sales_order(uuid, boolean) to authenticated;
