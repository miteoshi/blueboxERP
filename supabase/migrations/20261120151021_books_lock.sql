-- ─────────────────────────────────────────────────────────────
-- Closing the books up to a date.
--
-- books_lock          one row per organisation: the last day that is closed,
--                     who closed it and why. Set or cleared by an admin
--                     through set_books_lock(); every change is audited.
-- _guard_books_lock() trigger on each dated table: a row dated on or before
--                     the lock cannot be added, and its accounting fields
--                     (date, amounts, status, …) cannot be changed — which
--                     also stops cancelling it. Fields that later documents
--                     update on old rows (amount paid, balance due, an
--                     e-way bill number) are left open.
--
-- Arguments to the trigger: the date column, then the guarded columns.
-- Refusals raise P0013.
-- ─────────────────────────────────────────────────────────────

create table public.books_lock (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null unique references public.organizations(id),
  locked_until  date not null,
  reason        text,
  updated_by    uuid references public.profiles(id),
  updated_at    timestamptz not null default now()
);
create index books_lock_updated_by_idx on public.books_lock (updated_by);

comment on table public.books_lock is
  'The last day of the closed period, per organisation. Nothing dated on or before it can be added or changed. Written through set_books_lock().';

create trigger trg_aud_books_lock after insert or update or delete on public.books_lock
  for each row execute function public.write_audit_log();

alter table public.books_lock enable row level security;
create policy "members read the books lock" on public.books_lock for select to authenticated
  using (org_id = (select public.my_org()));

do $$ begin
  execute 'revoke all on public.books_lock from anon';
  execute 'revoke insert, update, delete, truncate, references, trigger on public.books_lock from authenticated';
end $$;
grant select on public.books_lock to authenticated;

-- ── Setting the lock ──────────────────────────────────────────
create function public.set_books_lock(p_locked_until date, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := public.my_org();
  v_old date;
begin
  perform public.assert_my_role('admin');
  select locked_until into v_old from public.books_lock where org_id = v_org;
  if p_locked_until is null then
    if v_old is null then
      raise exception 'The books are not closed' using errcode = 'P0008';
    end if;
    if nullif(trim(p_reason), '') is null then
      raise exception 'Give a reason for reopening the books' using errcode = '22023';
    end if;
    delete from public.books_lock where org_id = v_org;
    return jsonb_build_object('locked_until', null, 'previous', v_old);
  end if;
  if p_locked_until >= current_date then
    raise exception 'Close the books up to a day before today' using errcode = '22023';
  end if;
  if v_old is not null and p_locked_until < v_old and nullif(trim(p_reason), '') is null then
    raise exception 'Give a reason for reopening from % back to %', to_char(v_old, 'DD Mon YYYY'), to_char(p_locked_until, 'DD Mon YYYY')
      using errcode = '22023';
  end if;
  insert into public.books_lock (org_id, locked_until, reason, updated_by)
  values (v_org, p_locked_until, nullif(trim(p_reason), ''), auth.uid())
  on conflict (org_id) do update
  set locked_until = excluded.locked_until, reason = excluded.reason, updated_by = excluded.updated_by, updated_at = now();
  return jsonb_build_object('locked_until', p_locked_until, 'previous', v_old);
end;
$function$;

comment on function public.set_books_lock(date, text) is
  'Closes the books up to a day before today, or reopens them (p_locked_until null, or an earlier day) with a reason. Admin only; every change is in the audit log.';

-- ── The guard ─────────────────────────────────────────────────
create function public._guard_books_lock()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_new  jsonb := to_jsonb(NEW);
  v_old  jsonb;
  v_lock date;
  v_dnew date;
  v_dold date;
  i      integer;
begin
  select locked_until into v_lock from public.books_lock where org_id = (v_new ->> 'org_id')::uuid;
  if v_lock is null then
    return NEW;
  end if;
  v_dnew := (v_new ->> TG_ARGV[0])::date;
  if TG_OP = 'INSERT' then
    if v_dnew <= v_lock then
      raise exception 'The books are closed up to %: nothing dated on or before then can be added', to_char(v_lock, 'DD Mon YYYY')
        using errcode = 'P0013';
    end if;
    return NEW;
  end if;

  v_old := to_jsonb(OLD);
  v_dold := (v_old ->> TG_ARGV[0])::date;
  if coalesce(v_dold > v_lock, true) and coalesce(v_dnew > v_lock, true) then
    return NEW;
  end if;
  for i in 1 .. TG_NARGS - 1 loop
    if (v_old -> TG_ARGV[i]) is distinct from (v_new -> TG_ARGV[i]) then
      raise exception 'The books are closed up to %: % dated % cannot be changed or cancelled', to_char(v_lock, 'DD Mon YYYY'),
        coalesce(v_new ->> 'invoice_no', v_new ->> 'credit_note_no', v_new ->> 'receipt_no', v_new ->> 'bill_no', v_new ->> 'payment_no',
                 v_new ->> 'debit_note_no', v_new ->> 'expense_no', v_new ->> 'income_no', v_new ->> 'transfer_no', v_new ->> 'entry_no',
                 v_new ->> 'asset_no', v_new ->> 'name', 'an entry'),
        to_char(least(v_dold, v_dnew), 'DD Mon YYYY')
        using errcode = 'P0013';
    end if;
  end loop;
  return NEW;
end;
$function$;

comment on function public._guard_books_lock() is
  'Trigger: refuses rows dated on or before the books lock, and changes to the guarded columns of such rows. TG_ARGV[0] is the date column, the rest the guarded columns. Raises P0013.';

do $$ begin
  execute 'revoke all on function public._guard_books_lock() from public, anon, authenticated';
end $$;

create trigger trg_books_lock before insert or update on public.sales_invoices for each row
  execute function public._guard_books_lock('invoice_date', 'invoice_date', 'status', 'client_id', 'reverse_charge', 'is_interstate', 'taxable_value', 'cgst_amount', 'sgst_amount', 'igst_amount', 'round_off', 'total_amount');
create trigger trg_books_lock before insert or update on public.credit_notes for each row
  execute function public._guard_books_lock('note_date', 'note_date', 'status', 'invoice_id', 'client_id', 'taxable_value', 'cgst_amount', 'sgst_amount', 'igst_amount', 'round_off', 'total_amount');
create trigger trg_books_lock before insert or update on public.customer_receipts for each row
  execute function public._guard_books_lock('receipt_date', 'receipt_date', 'status', 'client_id', 'amount', 'mode');
create trigger trg_books_lock before insert or update on public.supplier_bills for each row
  execute function public._guard_books_lock('bill_date', 'bill_date', 'status', 'supplier_id', 'supplier_gstin', 'is_interstate', 'taxable_value', 'cgst_amount', 'sgst_amount', 'igst_amount', 'round_off', 'total_amount');
create trigger trg_books_lock before insert or update on public.supplier_payments for each row
  execute function public._guard_books_lock('payment_date', 'payment_date', 'status', 'supplier_id', 'amount', 'mode');
create trigger trg_books_lock before insert or update on public.debit_notes for each row
  execute function public._guard_books_lock('note_date', 'note_date', 'status', 'bill_id', 'supplier_id', 'supplier_gstin', 'taxable_value', 'cgst_amount', 'sgst_amount', 'igst_amount', 'round_off', 'total_amount');
create trigger trg_books_lock before insert or update on public.expenses for each row
  execute function public._guard_books_lock('expense_date', 'expense_date', 'status', 'head_id', 'amount', 'mode');
create trigger trg_books_lock before insert or update on public.other_income for each row
  execute function public._guard_books_lock('income_date', 'income_date', 'status', 'head_id', 'amount', 'mode');
create trigger trg_books_lock before insert or update on public.money_transfers for each row
  execute function public._guard_books_lock('transfer_date', 'transfer_date', 'status', 'direction', 'amount');
create trigger trg_books_lock before insert or update on public.gst_payments for each row
  execute function public._guard_books_lock('payment_date', 'payment_date', 'status', 'igst', 'cgst', 'sgst', 'interest', 'late_fee', 'mode');
create trigger trg_books_lock before insert or update on public.funding_entries for each row
  execute function public._guard_books_lock('entry_date', 'entry_date', 'status', 'account_id', 'direction', 'amount', 'interest', 'mode');
create trigger trg_books_lock before insert or update on public.stock_movements for each row
  execute function public._guard_books_lock('movement_date', 'movement_date', 'item_id', 'movement_type', 'qty', 'rate_at_time');
create trigger trg_books_lock before insert or update on public.money_openings for each row
  execute function public._guard_books_lock('as_of', 'as_of', 'amount');
create trigger trg_books_lock before insert or update on public.gst_openings for each row
  execute function public._guard_books_lock('as_of', 'as_of', 'payable_igst', 'payable_cgst', 'payable_sgst', 'credit_igst', 'credit_cgst', 'credit_sgst');
create trigger trg_books_lock before insert or update on public.funding_accounts for each row
  execute function public._guard_books_lock('opening_as_of', 'opening_as_of', 'opening_balance');
-- An asset bought before the lock keeps its cost and method; cancelling it sets cancel_reason
create trigger trg_books_lock before insert or update on public.fixed_assets for each row
  execute function public._guard_books_lock('purchase_date', 'purchase_date', 'cost', 'salvage_value', 'method', 'useful_life_years', 'wdv_rate', 'pay_mode', 'cancel_reason');
-- A sale or scrapping dated before the lock cannot be recorded or undone
create trigger trg_books_lock_disposal before update on public.fixed_assets for each row
  execute function public._guard_books_lock('disposed_on', 'disposed_on', 'sale_amount', 'sale_mode');

do $$ begin
  execute 'revoke all on function public.set_books_lock(date, text) from public, anon';
end $$;
grant execute on function public.set_books_lock(date, text) to authenticated;
