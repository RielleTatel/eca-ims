-- Exercise the operations the browser actually performs, without assuming
-- hosted Supabase projects automatically grant privileges to client roles.
begin;
create function pg_temp.assert_access(p_value boolean, p_message text) returns void language plpgsql as $$
begin if p_value is distinct from true then raise exception '%', p_message; end if; end $$;
create function pg_temp.expect_access_denied(p_sql text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when insufficient_privilege then return;
  end;
  raise exception 'Expected access denial: %', p_sql;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select pg_temp.assert_access((select count(*) > 0 from public.categories), 'Admin cannot read categories');
select pg_temp.assert_access((select count(*) > 0 from public.items i join public.categories c on c.id = i.category_id), 'Inventory relationship read failed');
select pg_temp.assert_access((select count(*) > 0 from public.borrowings b
  join public.profiles p on p.id = b.recorded_by
  join public.borrowing_items bi on bi.borrowing_id = b.id
  join public.items i on i.id = bi.item_id
  join public.categories c on c.id = i.category_id
  left join public.borrowing_returns r on r.borrowing_item_id = bi.id), 'Borrowing relationship read failed');
select count(*) from public.inventory_transactions;
select count(*) from public.audit_logs;
select count(*) from public.system_settings;
select 'PASS: authenticated page reads and embedded relationships' as result;

-- Category creation/editing, item registration and its ledger/audit entries,
-- and settings upsert remain direct browser operations protected by RLS.
insert into public.categories (id, name, created_by)
values ('22222222-2222-2222-2222-222222222299', 'Access test category', auth.uid());
update public.categories set description = 'Updated through authenticated role'
where id = '22222222-2222-2222-2222-222222222299';
insert into public.items (id, item_code, category_id, item_name, total_quantity, available_quantity, storage_location, created_by, updated_by)
values ('90000000-0000-0000-0000-000000000098', 'ACCESS-TEST', '22222222-2222-2222-2222-222222222299', 'Access test item', 7, 7, 'Test storage', auth.uid(), auth.uid());
insert into public.inventory_transactions (item_id, performed_by, transaction_type, quantity, quantity_before, quantity_after, remarks)
values ('90000000-0000-0000-0000-000000000098', auth.uid(), 'ITEM_ADDED', 7, 0, 7, 'Initial item stock registration');
insert into public.audit_logs (user_id, action, entity_type, entity_id, description)
values (auth.uid(), 'CREATE_ITEM', 'items', '90000000-0000-0000-0000-000000000098', 'Access test item creation');
insert into public.system_settings (id, siteao_governor_name, updated_by)
values ('siteao', 'Access test governor', auth.uid())
on conflict (id) do update set siteao_governor_name = excluded.siteao_governor_name, updated_by = excluded.updated_by;
select pg_temp.assert_access((select siteao_governor_name = 'Access test governor' from public.system_settings where id = 'siteao'), 'Settings upsert failed');

select pg_temp.expect_access_denied($q$update public.items set available_quantity = 0 where item_code = 'ACCESS-TEST'$q$);
select pg_temp.expect_access_denied($q$delete from public.categories where name = 'Access test category'$q$);
select pg_temp.expect_access_denied($q$update public.audit_logs set description = 'Rewritten history'$q$);
select pg_temp.expect_access_denied($q$update public.inventory_transactions set quantity = 99$q$);
select pg_temp.expect_access_denied($q$insert into public.audit_logs (user_id, action, entity_type, description) values ('00000000-0000-0000-0000-000000000002', 'CREATE_ITEM', 'items', 'Wrong actor')$q$);
select pg_temp.expect_access_denied($q$insert into public.inventory_transactions (item_id, performed_by, transaction_type, quantity, quantity_before, quantity_after) values ('90000000-0000-0000-0000-000000000098', auth.uid(), 'BORROWED', 1, 7, 6)$q$);
select 'PASS: admin configuration writes, immutable history, and RPC-only stock updates' as result;

-- A disabled former account still has table privileges, but RLS denies
-- inventory access and mutations while permitting its own profile read.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select pg_temp.assert_access((select count(*) = 0 from public.categories), 'Non-admin can read categories');
select pg_temp.assert_access((select count(*) = 0 from public.items), 'Non-admin can read inventory');
select pg_temp.assert_access((select count(*) = 0 from public.borrowings), 'Non-admin can read borrowings');
select pg_temp.assert_access((select count(*) = 1 from public.profiles), 'Non-admin can read other profiles');
select pg_temp.expect_access_denied($q$insert into public.categories (name) values ('Unauthorized category')$q$);
select pg_temp.expect_access_denied($q$insert into public.system_settings (id) values ('unauthorized')$q$);
select pg_temp.expect_access_denied($q$insert into public.audit_logs (user_id, action, entity_type, description) values (auth.uid(), 'CREATE_ITEM', 'items', 'Unauthorized log')$q$);
select pg_temp.expect_access_denied($q$insert into public.profiles (id, username, role, is_active) values (auth.uid(), 'unauthorized-admin', 'SUPER_ADMIN', true)$q$);
reset role;
set local role anon;
do $$ declare v_table text; begin
  foreach v_table in array array['profiles','categories','items','borrowings','borrowing_items','borrowing_returns','inventory_transactions','audit_logs','system_settings'] loop
    perform pg_temp.expect_access_denied(format('select count(*) from public.%I', v_table));
  end loop;
end $$;
select 'PASS: anonymous denial and non-admin row-level security' as result;
reset role;
rollback;
