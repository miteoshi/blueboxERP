-- ─────────────────────────────────────────────────────────────
-- Stock moves only through documents
--
-- receive / reserve / release / consume / produce / dispatch_inventory are
-- the building blocks that goods receipts, purchase-order receipts, delivery
-- challans, production orders and sales-order reservations call. Signed-in
-- users could also call them directly through the API and move stock with
-- no document behind it (a store user could "receive" stock without a GRN).
-- The app never calls them directly, and the document functions run with
-- the owner's rights, so they keep working without this grant.
--
-- check_bom_availability has no caller in the app or the database.
--
-- adjust_inventory (Stock Adjustment page, with a reason) and
-- reconcile_inventory_balance (admin, Settings) stay callable.
-- ─────────────────────────────────────────────────────────────

revoke execute on function public.receive_inventory(uuid, uuid, numeric, numeric, text, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.reserve_inventory(uuid, uuid, numeric, text, uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.release_inventory(uuid, uuid, numeric, text) from public, anon, authenticated;
revoke execute on function public.consume_inventory(uuid, uuid, numeric, uuid, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.produce_inventory(uuid, uuid, numeric, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.dispatch_inventory(uuid, uuid, numeric, numeric, uuid, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.check_bom_availability(uuid) from public, anon, authenticated;
