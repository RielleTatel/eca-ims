begin;
create function pg_temp.check_true(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception '%', message; end if; end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
set local role authenticated;
insert into public.items (id,item_code,category_id,item_name,total_quantity,available_quantity,storage_location)
values ('90000000-0000-0000-0000-000000000080','DELETE-TEST','22222222-2222-2222-2222-222222222201','Disposable test',2,2,'Test');
insert into public.inventory_transactions (item_id,performed_by,transaction_type,quantity,quantity_before,quantity_after)
values ('90000000-0000-0000-0000-000000000080',auth.uid(),'ITEM_ADDED',2,0,2);
select public.delete_inventory_item('90000000-0000-0000-0000-000000000080');
select pg_temp.check_true(not exists(select 1 from public.items where item_code='DELETE-TEST'), 'Item still visible');
select pg_temp.check_true(not exists(select 1 from public.inventory_transactions where item_id='90000000-0000-0000-0000-000000000080'), 'Stock transactions remain');
select pg_temp.check_true(exists(select 1 from public.audit_logs where action='DELETE_ITEM' and entity_id='90000000-0000-0000-0000-000000000080'), 'Deletion audit missing');
select 'PASS: permanent deletion removes item and stock transactions, retaining audit';
reset role;
-- Independent active, returned and archived borrowing references.
insert into public.items(id,item_code,category_id,item_name,total_quantity,available_quantity,storage_location)
select ('90000000-0000-0000-0000-00000000008'||n)::uuid,'HISTORY-'||n,'22222222-2222-2222-2222-222222222201','History fixture',1,1,'Test'
from generate_series(1,3) n;
insert into public.borrowing_items(borrowing_id,item_id,quantity_borrowed,quantity_returned)
select ('80000000-0000-0000-0000-00000000000'||n)::uuid,('90000000-0000-0000-0000-00000000008'||n)::uuid,1,case when n=2 then 1 else 0 end
from generate_series(1,3) n;
create function pg_temp.must_fail(command text, message text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when others then
    if position(message in sqlerrm)>0 then return; end if;
    raise exception 'Unexpected failure: %',sqlerrm;
  end;
  raise exception 'Expected failure: %',command;
end $$;
set local role authenticated;
select pg_temp.must_fail(format('select public.delete_inventory_item(%L)',('90000000-0000-0000-0000-00000000008'||n)::uuid),'borrowing history') from generate_series(1,3) n;
select 'PASS: active, returned and archived borrowing history each block deletion';
reset role;
insert into auth.users(id,email) values('00000000-0000-0000-0000-000000000080','staff@example.test');
set local role service_role;
select public.provision_staff('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000080','test.staff');
select pg_temp.check_true(public.resolve_account_login('TEST.STAFF')='staff@example.test','Case-insensitive username login failed');
select pg_temp.check_true(public.resolve_account_login('STAFF@EXAMPLE.TEST')='staff@example.test','Email login failed');
select public.resolve_account_login('unknown') from generate_series(1,10);
select pg_temp.check_true(public.resolve_account_login('unknown')='__RATE_LIMITED__','Login rate limit failed');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000080',true);
set local role authenticated;
select pg_temp.check_true((select count(*)=1 from public.profiles),'Own profile unavailable');
select pg_temp.check_true((select count(*)=0 from public.items),'Initial password allowed inventory access');
select pg_temp.must_fail('select public.get_dashboard_metrics()','access required');
select pg_temp.must_fail('select public.delete_inventory_item(''90000000-0000-0000-0000-000000000081'')','access required');
select pg_temp.must_fail('update public.profiles set must_change_password=false','permission denied');
select pg_temp.must_fail('select public.finish_password_change(auth.uid(),auth.uid(),gen_random_uuid(),false)','permission denied');
select 'PASS: initial password cannot access operations or bypass password gate';
reset role;
set local role service_role;
select public.begin_password_change('00000000-0000-0000-0000-000000000080','00000000-0000-0000-0000-000000000080',false) as operation \gset
select pg_temp.must_fail('select public.begin_password_change(''00000000-0000-0000-0000-000000000080'',''00000000-0000-0000-0000-000000000080'',false)','in progress');
select public.finish_password_change('00000000-0000-0000-0000-000000000080','00000000-0000-0000-0000-000000000080',:'operation',false);
reset role;
set local role authenticated;
select pg_temp.check_true((select count(*)>0 from public.items),'Staff inventory access failed');
select pg_temp.check_true(not exists(select 1 from public.audit_logs where entity_type='profiles'),'Staff can read account audits');
select pg_temp.check_true(not exists(select 1 from jsonb_array_elements(public.get_dashboard_metrics()->'recentActivity') a where a->>'action' in ('CREATE_ACCOUNT','CHANGE_PASSWORD')),'Dashboard leaked account audits');
select pg_temp.must_fail('select public.list_staff_accounts()','Super-admin access required');
select pg_temp.must_fail('select public.set_staff_active(auth.uid(),false)','Super-admin access required');
select pg_temp.must_fail('insert into public.system_settings(id) values(''staff-unauthorized'')','row-level security');
select pg_temp.must_fail('update public.profiles set role=''SUPER_ADMIN''','permission denied');
select pg_temp.must_fail('insert into public.audit_logs(user_id,action,entity_type,description) values(auth.uid(),''CREATE_ACCOUNT'',''profiles'',''Fake'')','row-level security');
insert into public.categories(id,name) values('22222222-2222-2222-2222-222222222280','Staff category');
update public.categories set description='Staff edit' where id='22222222-2222-2222-2222-222222222280';
insert into public.items(id,item_code,category_id,item_name,total_quantity,available_quantity,storage_location)
values('90000000-0000-0000-0000-000000000080','STAFF-DELETE','22222222-2222-2222-2222-222222222280','Staff item',2,2,'Test');
select public.update_inventory_item('90000000-0000-0000-0000-000000000080','{"itemName":"Staff updated item"}');
select public.delete_inventory_item('90000000-0000-0000-0000-000000000080');
select pg_temp.check_true(not exists(select 1 from public.items where item_code='STAFF-DELETE'),'Staff deletion failed');
select public.record_borrowing('Student Test','TEST-STAFF',null,'Staff checkout',current_date,current_date,null,'[{"itemId":"90000000-0000-0000-0000-000000000081","quantity":1}]')->>'id' as borrowing \gset
select public.record_borrowing_return(:'borrowing',jsonb_build_array(jsonb_build_object('borrowingItemId',(select id from public.borrowing_items where borrowing_id=:'borrowing'),'quantity',1,'condition','GOOD')));
select 'PASS: staff operations work; account management, settings and account audits remain restricted';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select pg_temp.check_true(jsonb_array_length(public.list_staff_accounts())=1,'Admin cannot list staff');
select public.set_staff_active('00000000-0000-0000-0000-000000000080',false);
select pg_temp.must_fail('select public.set_staff_active(auth.uid(),false)','Staff account not found');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000080',true);
select pg_temp.check_true((select count(*)=0 from public.items),'Disabled staff retained access');
reset role;
set local role service_role;
select pg_temp.check_true(public.resolve_account_login('test.staff') is null,'Disabled staff can log in');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select public.set_staff_active('00000000-0000-0000-0000-000000000080',true);
reset role;
set local role service_role;
select public.begin_password_change('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000080',true) as reset_operation \gset
select public.finish_password_change('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000080',:'reset_operation',true);
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000080',true);
set local role authenticated;
select pg_temp.check_true((select count(*)=0 from public.items),'Password reset did not revoke operational access');
select 'PASS: deactivation blocks existing sessions; reactivation and password resets preserve mandatory change';
reset role;
rollback;
