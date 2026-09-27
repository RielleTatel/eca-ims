-- Do not depend on a project's default privileges. Both table grants and
-- row-level policies are required for authenticated browser requests.
-- Reapplicable before later migrations; never reapply out of timestamp order.
do $$
declare v_table text;
begin
  foreach v_table in array array[
    'profiles', 'categories', 'items', 'system_settings', 'borrowings',
    'borrowing_items', 'borrowing_returns', 'inventory_transactions', 'audit_logs'
  ] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_table and c.relrowsecurity
    ) then
      raise exception 'Expected row-level security on public.% before granting access', v_table;
    end if;
  end loop;
end;
$$;

grant usage on schema public to authenticated, service_role;
revoke all on table public.profiles, public.categories, public.items,
  public.system_settings, public.borrowings, public.borrowing_items,
  public.borrowing_returns, public.inventory_transactions, public.audit_logs
  from public, anon, authenticated;

-- RLS permits inventory and borrowing reads only for active admins; users may
-- also read their own profile so the login flow can check account status.
grant select on table public.profiles, public.categories, public.items,
  public.system_settings, public.borrowings, public.borrowing_items,
  public.borrowing_returns, public.inventory_transactions, public.audit_logs
  to authenticated;
grant insert, update on table public.profiles, public.categories, public.system_settings
  to authenticated;
grant insert on table public.items, public.inventory_transactions, public.audit_logs
  to authenticated;

-- Server-only provisioning uses a service key; it is never exposed to browsers.
grant all on table public.profiles, public.categories, public.items,
  public.system_settings, public.borrowings, public.borrowing_items,
  public.borrowing_returns, public.inventory_transactions, public.audit_logs
  to service_role;

-- The settings screen uses INSERT ... ON CONFLICT UPDATE, which requires both
-- insertion and update policies even when the settings row already exists.
drop policy if exists admin_settings_insert on public.system_settings;
create policy admin_settings_insert on public.system_settings
  for insert to authenticated with check (public.is_super_admin());

-- Item registration still creates its initial ledger entry from the browser.
-- Borrowing movements and stock edits remain exclusively handled by RPCs.
drop policy if exists admin_transactions_insert on public.inventory_transactions;
create policy admin_transactions_insert on public.inventory_transactions
  for insert to authenticated with check (
    public.is_super_admin() and performed_by = auth.uid()
    and transaction_type = 'ITEM_ADDED' and borrowing_id is null
  );
drop policy if exists admin_audit_insert on public.audit_logs;
create policy admin_audit_insert on public.audit_logs
  for insert to authenticated with check (
    public.is_super_admin() and user_id = auth.uid()
  );

-- There are deliberately no direct stock update, borrowing write, history
-- update, or client delete grants. Their existing RPC safeguards stay intact.
notify pgrst, 'reload schema';
