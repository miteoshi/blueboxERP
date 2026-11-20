-- ─────────────────────────────────────────────────────────────
-- A log of payment reminders sent to customers.
--
-- The app does not send reminders itself: it opens WhatsApp or the mail app
-- with the text filled in, or copies it. Each time someone does that, the
-- reminder is logged here, so Receivables can show when a customer was last
-- reminded, how, by whom and for how much.
--
-- payment_reminders            append-only log
-- log_payment_reminder()       admin, manager and sales; a repeat within two
--                              minutes (same customer, channel and person) is
--                              not logged twice
-- v_last_payment_reminders     the latest reminder per customer, with the
--                              number sent in the last 30 days
-- ─────────────────────────────────────────────────────────────

create table public.payment_reminders (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id),
  client_id       uuid not null references public.clients(id),
  channel         text not null check (channel in ('whatsapp', 'email', 'copy')),
  overdue_amount  numeric(14,2) not null check (overdue_amount >= 0),
  invoices        integer not null check (invoices >= 0),
  sent_by         uuid references public.profiles(id),
  sent_at         timestamptz not null default now()
);
create index payment_reminders_client_idx on public.payment_reminders (org_id, client_id, sent_at desc);
create index payment_reminders_client_id_idx on public.payment_reminders (client_id);
create index payment_reminders_sent_by_idx on public.payment_reminders (sent_by);

comment on table public.payment_reminders is
  'Payment reminders sent (opened in WhatsApp or mail, or copied) per customer. Append-only; written through log_payment_reminder().';

alter table public.payment_reminders enable row level security;
create policy "finance roles read payment reminders" on public.payment_reminders for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'sales', 'viewer'));

do $$ begin
  execute 'revoke all on public.payment_reminders from anon';
  execute 'revoke insert, update, delete, truncate, references, trigger on public.payment_reminders from authenticated';
end $$;
grant select on public.payment_reminders to authenticated;

create function public.log_payment_reminder(p_client_id uuid, p_channel text, p_overdue_amount numeric, p_invoices integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
  v_id  uuid;
  v_at  timestamptz;
begin
  perform public.assert_my_role('admin', 'manager', 'sales');
  if not exists (select 1 from public.clients where id = p_client_id and org_id = v_org) then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;
  if p_channel is null or p_channel not in ('whatsapp', 'email', 'copy') then
    raise exception 'Unknown channel %', coalesce(p_channel, 'none') using errcode = '22023';
  end if;
  if p_overdue_amount is null or p_overdue_amount < 0 or round(p_overdue_amount, 2) <> p_overdue_amount
     or p_invoices is null or p_invoices < 0 then
    raise exception 'Give the overdue amount and number of invoices' using errcode = '22023';
  end if;

  -- A second press of the same button is the same reminder
  select id, sent_at into v_id, v_at
  from public.payment_reminders
  where org_id = v_org and client_id = p_client_id and channel = p_channel and sent_by = auth.uid()
    and sent_at > now() - interval '2 minutes'
  order by sent_at desc
  limit 1;
  if found then
    return jsonb_build_object('id', v_id, 'sent_at', v_at, 'repeat', true);
  end if;

  insert into public.payment_reminders (org_id, client_id, channel, overdue_amount, invoices, sent_by)
  values (v_org, p_client_id, p_channel, p_overdue_amount, p_invoices, auth.uid())
  returning id, sent_at into v_id, v_at;
  return jsonb_build_object('id', v_id, 'sent_at', v_at, 'repeat', false);
end;
$function$;

comment on function public.log_payment_reminder(uuid, text, numeric, integer) is
  'Logs that a payment reminder was sent to a customer (whatsapp, email or copy) with the overdue amount and invoices in it. A repeat within two minutes by the same person on the same channel is not logged again. Admin, manager and sales.';

create view public.v_last_payment_reminders with (security_invoker = true) as
select distinct on (r.org_id, r.client_id)
       r.org_id, r.client_id, r.sent_at, r.channel, r.overdue_amount, r.invoices,
       p.full_name as sent_by_name,
       count(*) filter (where r.sent_at > now() - interval '30 days') over (partition by r.org_id, r.client_id) as last_30_days
from public.payment_reminders r
left join public.profiles p on p.id = r.sent_by
order by r.org_id, r.client_id, r.sent_at desc;

comment on view public.v_last_payment_reminders is
  'The latest payment reminder per customer, with who sent it and how many were sent in the last 30 days. Reads with the caller''s rights.';

do $$ begin
  execute 'revoke all on public.v_last_payment_reminders from anon';
  execute 'revoke all on function public.log_payment_reminder(uuid, text, numeric, integer) from public, anon';
end $$;
grant select on public.v_last_payment_reminders to authenticated;
grant execute on function public.log_payment_reminder(uuid, text, numeric, integer) to authenticated;
