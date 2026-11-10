-- ─────────────────────────────────────────────────────────────
-- RLS and index performance (Supabase performance advisor)
--
-- 1. multiple_permissive_policies (108 warnings): every "… manages …"
--    policy was FOR ALL TO public, so on SELECT it was evaluated in
--    addition to the table's read policy. Each FOR ALL policy is split
--    into INSERT / UPDATE / DELETE policies with the same condition. The
--    rows anyone can read or write do not change: each "manages"
--    condition is the read condition plus a role check, so dropping it
--    from SELECT removes nothing a user could see.
--
-- 2. auth_rls_initplan: my_org(), my_role() and auth.uid() in policies
--    are wrapped as (select …) so Postgres evaluates them once per
--    statement instead of once per row.
--
-- 3. All policies apply TO authenticated instead of TO public. anon
--    never matched them (my_org() is null without a signed-in user) and
--    service_role / SECURITY DEFINER functions bypass RLS.
--
-- 4. unindexed_foreign_keys (64): an index for every foreign key whose
--    columns are not the leading columns of an existing index.
-- ─────────────────────────────────────────────────────────────

do $rls$
declare
  r       record;
  v_qual  text;
  v_check text;
  v_pat   constant text := '(my_org\(\)|my_role\(\)|auth\.uid\(\))';
begin
  for r in
    select tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and permissive = 'PERMISSIVE'
      and (coalesce(qual, '') ~ v_pat or coalesce(with_check, '') ~ v_pat)
  loop
    v_qual  := regexp_replace(r.qual, v_pat, '(select \1)', 'g');
    v_check := regexp_replace(r.with_check, v_pat, '(select \1)', 'g');

    execute format('drop policy %I on public.%I', r.policyname, r.tablename);

    if r.cmd = 'ALL' then
      -- FOR ALL without WITH CHECK uses USING for new rows too
      execute format('create policy %I on public.%I for insert to authenticated with check (%s)',
                     left(r.policyname || ' (insert)', 63), r.tablename, coalesce(v_check, v_qual));
      execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
                     left(r.policyname || ' (update)', 63), r.tablename, v_qual, coalesce(v_check, v_qual));
      execute format('create policy %I on public.%I for delete to authenticated using (%s)',
                     left(r.policyname || ' (delete)', 63), r.tablename, v_qual);
    elsif r.cmd = 'INSERT' then
      execute format('create policy %I on public.%I for insert to authenticated with check (%s)',
                     r.policyname, r.tablename, v_check);
    elsif r.cmd = 'UPDATE' then
      execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
                     r.policyname, r.tablename, v_qual, coalesce(v_check, v_qual));
    else
      execute format('create policy %I on public.%I for %s to authenticated using (%s)',
                     r.policyname, r.tablename, lower(r.cmd), v_qual);
    end if;
  end loop;
end
$rls$;

do $idx$
declare
  r      record;
  v_name text;
begin
  for r in
    select c.conrelid::regclass as tbl,
           cl.relname as tname,
           c.conname,
           string_agg(quote_ident(a.attname), ', ' order by k.ord) as cols,
           string_agg(a.attname, '_' order by k.ord) as col_names,
           c.conkey
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    cross join lateral unnest(c.conkey) with ordinality as k(attnum, ord)
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f' and n.nspname = 'public'
    group by c.conrelid, cl.relname, c.conname, c.conkey
  loop
    -- Skip when an existing index already starts with the FK columns
    if exists (
      select 1 from pg_index i
      where i.indrelid = r.tbl::oid
        and (i.indkey::int2[])[0:cardinality(r.conkey) - 1] = r.conkey
    ) then
      continue;
    end if;
    v_name := left(r.tname || '_' || r.col_names, 58) || '_fkix';
    execute format('create index if not exists %I on %s (%s)', v_name, r.tbl, r.cols);
  end loop;
end
$idx$;
