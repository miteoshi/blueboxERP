-- ─────────────────────────────────────────────────────────────
-- Financial position on a day: what the business owns and owes, from
-- what is recorded in the app.
--
--   Owned:  cash and bank (from the opening balances), money customers
--           owe, advances paid to suppliers, stock
--   Owed:   money owed to suppliers, advances received from customers
--   Net worth as per the app = owned - owed
--
-- Customer and supplier balances are worked out per party exactly as the
-- statements do (documents dated on or before the day), so an advance and
-- an unpaid invoice of the same party net off. Stock is valued at the
-- running average cost, as in the profit and loss.
--
-- Customer and supplier balances include GST, but the GST owed to the
-- government (or input credit to claim) is not here, because GST payments
-- are not recorded in the app. So net worth moves by the period's profit
-- plus GST collected less GST paid on purchases.
--
-- Also not in the app, so not here: fixed assets, loans, capital put in or
-- drawn, and anything else not recorded. That is why the result is a
-- management view, not a balance sheet. Admin, manager and viewer.
-- ─────────────────────────────────────────────────────────────

create function public.financial_position(p_as_of date)
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'public'
as $function$
declare
  v_org     uuid := public.my_org();
  v_role    public.user_role := public.my_role();
  v_money   jsonb;
  v_pl      jsonb;
  v_cash    numeric;
  v_bank    numeric;
  v_recv    numeric;
  v_recv_n  integer;
  v_cadv    numeric;
  v_cadv_n  integer;
  v_pay     numeric;
  v_pay_n   integer;
  v_sadv    numeric;
  v_sadv_n  integer;
  v_stock   numeric;
  v_assets  numeric;
  v_owed    numeric;
begin
  if v_role is null or v_role not in ('admin', 'manager', 'viewer') then
    raise exception 'Unauthorized: your role (%) cannot see the financial position', coalesce(v_role::text, 'none')
      using errcode = 'P0005';
  end if;
  if p_as_of is null then
    raise exception 'Choose the day' using errcode = '22023';
  end if;

  -- Cash and bank: null when no opening balance is set, or the day is before it
  v_money := public.money_balances(p_as_of, p_as_of);
  v_cash := (v_money -> 'cash' ->> 'end')::numeric;
  v_bank := (v_money -> 'bank' ->> 'end')::numeric;

  -- Customers: invoices less receipts and credit notes, per customer
  select coalesce(sum(bal) filter (where bal >= 0.005), 0), count(*) filter (where bal >= 0.005),
         coalesce(-sum(bal) filter (where bal <= -0.005), 0), count(*) filter (where bal <= -0.005)
  into v_recv, v_recv_n, v_cadv, v_cadv_n
  from (
    select client_id, sum(amt) as bal
    from (
      select client_id, total_amount as amt from public.sales_invoices
      where org_id = v_org and status = 'issued' and invoice_date <= p_as_of
      union all
      select client_id, -amount from public.customer_receipts
      where org_id = v_org and status = 'active' and receipt_date <= p_as_of
      union all
      select client_id, -total_amount from public.credit_notes
      where org_id = v_org and status = 'issued' and note_date <= p_as_of
    ) x
    group by client_id
  ) c;

  -- Suppliers: bills less payments and debit notes, per supplier
  select coalesce(sum(bal) filter (where bal >= 0.005), 0), count(*) filter (where bal >= 0.005),
         coalesce(-sum(bal) filter (where bal <= -0.005), 0), count(*) filter (where bal <= -0.005)
  into v_pay, v_pay_n, v_sadv, v_sadv_n
  from (
    select supplier_id, sum(amt) as bal
    from (
      select supplier_id, total_amount as amt from public.supplier_bills
      where org_id = v_org and status = 'posted' and bill_date <= p_as_of
      union all
      select supplier_id, -amount from public.supplier_payments
      where org_id = v_org and status = 'active' and payment_date <= p_as_of
      union all
      select supplier_id, -total_amount from public.debit_notes
      where org_id = v_org and status = 'issued' and note_date <= p_as_of
    ) x
    group by supplier_id
  ) s;

  -- Stock at the end of the day, valued as in the profit and loss
  v_pl := public.profit_and_loss(p_as_of, p_as_of);
  v_stock := (v_pl -> 'stock' ->> 'closing')::numeric;

  v_assets := coalesce(v_cash, 0) + coalesce(v_bank, 0) + v_recv + v_sadv + v_stock;
  v_owed := v_pay + v_cadv;

  return jsonb_build_object(
    'as_of', p_as_of,
    'cash', jsonb_build_object('set', v_cash is not null, 'amount', round(v_cash, 2), 'opening_as_of', v_money -> 'cash' -> 'as_of'),
    'bank', jsonb_build_object('set', v_bank is not null, 'amount', round(v_bank, 2), 'opening_as_of', v_money -> 'bank' -> 'as_of'),
    'receivables', jsonb_build_object('amount', round(v_recv, 2), 'parties', v_recv_n),
    'supplier_advances', jsonb_build_object('amount', round(v_sadv, 2), 'parties', v_sadv_n),
    'stock', jsonb_build_object(
      'amount', round(v_stock, 2),
      'items_without_cost', (v_pl -> 'stock' ->> 'items_without_cost')::integer,
      'items_on_price_list', (v_pl -> 'stock' ->> 'items_on_price_list')::integer,
      'items_on_bom', (v_pl -> 'stock' ->> 'items_on_bom')::integer),
    'payables', jsonb_build_object('amount', round(v_pay, 2), 'parties', v_pay_n),
    'customer_advances', jsonb_build_object('amount', round(v_cadv, 2), 'parties', v_cadv_n),
    'total_owned', round(v_assets, 2),
    'total_owed', round(v_owed, 2),
    'net_worth', round(v_assets - v_owed, 2)
  );
end;
$function$;

comment on function public.financial_position(date) is
  'What the business owns (cash, bank, money owed by customers, advances paid to suppliers, stock at running average cost) and owes (money owed to suppliers, advances from customers) at the end of a day, from what is recorded in the app. Cash and bank are null until their opening balance is set. Admin, manager and viewer.';

do $$ begin
  execute 'revoke all on function public.financial_position(date) from public, anon';
end $$;
grant execute on function public.financial_position(date) to authenticated;
