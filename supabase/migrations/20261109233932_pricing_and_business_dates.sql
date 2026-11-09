-- ─────────────────────────────────────────────────────────────
-- Price changes in one transaction + business dates in IST
--
-- 1. Business dates follow India time. The database ran in UTC, so
--    current_date (used for document dates, price effective dates and
--    defaults) was still "yesterday" until 05:30 IST. Timestamps
--    (timestamptz) are unaffected — only how dates are derived.
--
-- 2. set_item_price(): the Settings page closed the current price and
--    then inserted the new one as two requests. If the insert failed (or
--    the item had no unit) the item was left with no active price, and
--    entering only one of the two rates wiped the other. A same-day
--    second change also left two rows "effective from today" and the
--    current-price view picked one at random.
--
-- 3. v_current_prices: only rows effective today, newest first, with a
--    deterministic tie-breaker.
-- ─────────────────────────────────────────────────────────────

alter database postgres set timezone to 'Asia/Kolkata';
set timezone to 'Asia/Kolkata';

create or replace function public.set_item_price(
  p_item_id       uuid,
  p_purchase_rate numeric default null,
  p_selling_rate  numeric default null,
  p_gst_percent   public.gst_rate default null,
  p_notes         text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org        uuid := public.my_org();
  v_unit_id    uuid;
  v_today      date := current_date;
  v_cur_id     uuid;
  v_cur_from   date;
  v_cur_buy    numeric;
  v_cur_sell   numeric;
  v_cur_gst    public.gst_rate;
  v_id         uuid;
begin
  perform public.assert_my_role('admin', 'manager', 'store');

  if p_purchase_rate is null and p_selling_rate is null then
    raise exception 'Enter a purchase or selling rate' using errcode = '22023';
  end if;
  if coalesce(p_purchase_rate, 0) < 0 or coalesce(p_selling_rate, 0) < 0 then
    raise exception 'Rates cannot be negative' using errcode = '22023';
  end if;

  select unit_id into v_unit_id
  from public.items
  where id = p_item_id and org_id = v_org
  for update;

  if not found then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;
  if v_unit_id is null then
    raise exception 'Item has no unit assigned' using errcode = '22023';
  end if;

  select id, effective_from, purchase_rate, selling_rate, gst_percent
    into v_cur_id, v_cur_from, v_cur_buy, v_cur_sell, v_cur_gst
  from public.item_prices
  where item_id = p_item_id and org_id = v_org and effective_to is null
  order by effective_from desc, created_at desc
  limit 1;

  if v_cur_id is not null and v_cur_from >= v_today then
    -- Second change on the same day: correct today's row in place
    update public.item_prices
    set purchase_rate = coalesce(p_purchase_rate, v_cur_buy),
        selling_rate  = coalesce(p_selling_rate, v_cur_sell),
        gst_percent   = coalesce(p_gst_percent, v_cur_gst),
        unit_id       = v_unit_id,
        notes         = coalesce(p_notes, notes)
    where id = v_cur_id
    returning id into v_id;
  else
    -- Close every open row the day before, then start the new price today
    update public.item_prices
    set effective_to = v_today - 1
    where item_id = p_item_id and org_id = v_org and effective_to is null;

    insert into public.item_prices (
      org_id, item_id, unit_id, purchase_rate, selling_rate, gst_percent,
      effective_from, notes, created_by
    ) values (
      v_org, p_item_id, v_unit_id,
      coalesce(p_purchase_rate, v_cur_buy),
      coalesce(p_selling_rate, v_cur_sell),
      coalesce(p_gst_percent, v_cur_gst, '18'),
      v_today, p_notes, auth.uid()
    )
    returning id into v_id;
  end if;

  return jsonb_build_object('id', v_id, 'effective_from', v_today);
end;
$function$;

revoke execute on function public.set_item_price(uuid, numeric, numeric, public.gst_rate, text) from public, anon;
grant execute on function public.set_item_price(uuid, numeric, numeric, public.gst_rate, text) to authenticated;

create or replace view public.v_current_prices
with (security_invoker = true)
as
select distinct on (p.item_id)
  p.item_id,
  i.item_code,
  i.name,
  p.purchase_rate,
  p.selling_rate,
  p.gst_percent::text as gst_percent,
  u.name as rate_unit,
  p.effective_from,
  p.notes as price_notes
from public.item_prices p
join public.items i on i.id = p.item_id
left join public.units u on u.id = p.unit_id
where p.effective_from <= current_date
  and (p.effective_to is null or p.effective_to >= current_date)
order by p.item_id, p.effective_from desc, p.created_at desc;
