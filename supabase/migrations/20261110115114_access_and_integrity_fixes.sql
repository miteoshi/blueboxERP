-- ─────────────────────────────────────────────────────────────
-- Access and integrity fixes
--
-- 1. Deactivated users and suspended companies lose access in the
--    database, not only in the app shell: my_org() / my_role() /
--    assert_my_role() return nothing for an inactive profile or a
--    company whose access_status is not 'active'.
-- 2. A company always keeps at least one active admin.
-- 3. Colleagues in the same company can read each other's profile
--    (names on "created by"); one SELECT policy instead of two.
-- 4. Audit log entries carry the company of the row they record
--    (backfilled), and only admins can read the audit log.
-- 5. Document numbering can only be advanced by the workflows that
--    issue documents, not called directly (no gaps in GST series).
-- 6. Role alignment with the app: managers can record GRNs and edit
--    items, suppliers and BOMs; production orders are created by admins
--    and managers.
-- 7. Stock row locks wait briefly instead of failing at once when two
--    people work on the same item.
-- 8. Signed-out (anon) users get no table privileges; no one gets
--    TRUNCATE / TRIGGER / REFERENCES (TRUNCATE ignores RLS).
-- ─────────────────────────────────────────────────────────────

-- ── 1. Active user in an active company ──────────────────────
create or replace function public.my_org()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  select p.org_id
  from public.profiles p
  join public.organizations o on o.id = p.org_id
  where p.id = auth.uid() and p.is_active and o.access_status = 'active'
$function$;

create or replace function public.my_role()
returns public.user_role
language sql
stable
security definer
set search_path to 'public'
as $function$
  select p.role
  from public.profiles p
  join public.organizations o on o.id = p.org_id
  where p.id = auth.uid() and p.is_active and o.access_status = 'active'
$function$;

-- Used by the app shell to route suspended companies; must not go through
-- my_org(), which now returns nothing for them.
create or replace function public.org_is_active()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select o.access_status = 'active'
  from public.profiles p
  join public.organizations o on o.id = p.org_id
  where p.id = auth.uid()
$function$;

create or replace function public.assert_my_role(variadic p_roles public.user_role[])
returns void
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_role public.user_role := public.my_role();
begin
  if v_role is null or not (v_role = any (p_roles)) then
    raise exception 'Unauthorized: your role (%) cannot perform this action', coalesce(v_role::text, 'none')
      using errcode = 'P0005';
  end if;
end;
$function$;

-- ── 2. Never leave a company without an active admin ──────────
create or replace function public.guard_last_admin()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Only signed-in app users are held to this; the project owner (SQL
  -- editor) and the service role can still clean up. current_user can't be
  -- used here: in a SECURITY DEFINER function it is always the owner.
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  if old.role = 'admin' and old.is_active and old.org_id is not null
     and (tg_op = 'DELETE'
          or new.role <> 'admin'
          or not new.is_active
          or new.org_id is distinct from old.org_id) then
    -- Serialise admin changes within the company
    perform 1 from public.organizations where id = old.org_id for update;
    if not exists (
      select 1 from public.profiles
      where org_id = old.org_id and role = 'admin' and is_active and id <> old.id
    ) then
      raise exception 'The company needs at least one active admin — make someone else admin first'
        using errcode = 'P0008';
    end if;
  end if;

  return coalesce(new, old);
end;
$function$;

do $$ begin
  execute 'revoke execute on function public.guard_last_admin() from public, anon, authenticated';
end $$;

create trigger trg_guard_last_admin
  before update or delete on public.profiles
  for each row execute function public.guard_last_admin();

-- ── 3. Colleagues can read each other's profile ───────────────
do $$ begin
  execute 'drop policy "org admin reads all" on public.profiles';
  execute 'drop policy "own profile" on public.profiles';
end $$;
create policy "org members read profiles" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or org_id = (select public.my_org()));

-- ── 4. Audit log ──────────────────────────────────────────────
-- Every audited table has an org_id column.
create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_logs (org_id, table_name, record_id, action, old_values, new_values, changed_by)
  values (
    (v_row ->> 'org_id')::uuid,
    tg_table_name,
    (v_row ->> 'id')::uuid,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) end,
    auth.uid()
  );
  return coalesce(new, old);
end;
$function$;

update public.audit_logs
set org_id = coalesce((new_values ->> 'org_id')::uuid, (old_values ->> 'org_id')::uuid)
where org_id is null
  and coalesce(new_values ->> 'org_id', old_values ->> 'org_id') is not null;

do $$ begin
  execute 'drop policy "org reads audit" on public.audit_logs';
end $$;
create policy "admins read audit log" on public.audit_logs for select to authenticated
  using (org_id = (select public.my_org()) and (select public.my_role()) = 'admin');

do $$ begin
  execute 'revoke insert, update, delete on public.audit_logs from authenticated';
end $$;

-- ── 5. Document numbering only through the workflows ──────────
-- Callers (create_quotation, convert_quotation_to_sales_order,
-- create_delivery_challan, create_inbound_receipt, create_production_order,
-- create_sales_invoice, record_customer_receipt, create_credit_note) are
-- SECURITY DEFINER and keep working.
do $$ begin
  execute 'revoke execute on function public.next_org_seq(uuid, text) from public, anon, authenticated';
  execute 'revoke execute on function public.next_dc_no(uuid)  from public, anon, authenticated';
  execute 'revoke execute on function public.next_grn_no(uuid) from public, anon, authenticated';
  execute 'revoke execute on function public.next_prd_no(uuid) from public, anon, authenticated';
  execute 'revoke execute on function public.next_qt_no(uuid)  from public, anon, authenticated';
  execute 'revoke execute on function public.next_so_no(uuid)  from public, anon, authenticated';
end $$;

-- ── 6. Role alignment ─────────────────────────────────────────
alter policy "org store manages items (insert)" on public.items
  with check (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'store'));
alter policy "org store manages items (update)" on public.items
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'store'))
  with check (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'store'));
alter policy "org store manages items (delete)" on public.items
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'store'));

alter policy "org admin manages sup (insert)" on public.suppliers
  with check (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'store'));
alter policy "org admin manages sup (update)" on public.suppliers
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'store'))
  with check (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'store'));
alter policy "org admin manages sup (delete)" on public.suppliers
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'store'));

alter policy "org prod manages bom (insert)" on public.bom
  with check (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'production'));
alter policy "org prod manages bom (update)" on public.bom
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'production'))
  with check (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'production'));
alter policy "org prod manages bom (delete)" on public.bom
  using (org_id = (select public.my_org()) and (select public.my_role()) in ('admin', 'manager', 'production'));

-- One-line changes to existing functions, applied to their live definitions
do $fix$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_functiondef('public.create_inbound_receipt'::regproc);
  v_new := replace(v_def, $q$assert_my_role('admin', 'store')$q$, $q$assert_my_role('admin', 'manager', 'store')$q$);
  if v_new = v_def then
    raise exception 'create_inbound_receipt: role check not found';
  end if;
  execute v_new;

  v_def := pg_get_functiondef('public.create_production_order'::regproc);
  v_new := replace(v_def, $q$assert_my_role('admin', 'manager', 'production')$q$, $q$assert_my_role('admin', 'manager')$q$);
  if v_new = v_def then
    raise exception 'create_production_order: role check not found';
  end if;
  execute v_new;

  -- ── 7. Wait for a stock row lock instead of failing immediately
  v_def := pg_get_functiondef('public.lock_inventory_balance'::regproc);
  v_new := replace(v_def, 'for update nowait', 'for update');
  if v_new = v_def then
    raise exception 'lock_inventory_balance: nowait not found';
  end if;
  execute v_new;
end
$fix$;

-- ── 8. Table privileges ───────────────────────────────────────
do $$ begin
  execute 'revoke all on all tables in schema public from anon';
  execute 'revoke all on all sequences in schema public from anon';
  execute 'revoke truncate, references, trigger on all tables in schema public from authenticated';
  execute 'revoke execute on function public.my_org(), public.my_role(), public.org_is_active() from anon';
  execute 'alter default privileges for role postgres in schema public revoke all on tables from anon';
  execute 'alter default privileges for role postgres in schema public revoke all on sequences from anon';
  execute 'alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from authenticated';
end $$;
