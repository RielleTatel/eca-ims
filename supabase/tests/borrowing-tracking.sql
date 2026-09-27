begin;
create function pg_temp.assert_true(p_value boolean, p_message text) returns void language plpgsql as $$
begin if p_value is distinct from true then raise exception '%', p_message; end if; end $$;
create function pg_temp.expect_error(p_sql text, p_message text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if position(p_message in sqlerrm) = 0 then raise; end if;
    return;
  end;
  raise exception 'Expected failure: %', p_message;
end $$;

select pg_temp.assert_true((select status = 'ACTIVE' and is_legacy and student_id is null from public.borrowings where borrowing_code = 'BR-LEGACY-ACTIVE'), 'Legacy active loan not preserved');
select pg_temp.assert_true((select available_quantity = 17 from public.items where item_code = 'LEGACY'), 'Migration deducted legacy stock twice');
select pg_temp.assert_true((select status = 'ARCHIVED' from public.borrowings where borrowing_code = 'BR-LEGACY-PENDING'), 'Unused request was not archived');
select pg_temp.assert_true((select count(*) = 1 from public.borrowing_returns), 'Historical returns not preserved');
select pg_temp.assert_true((select role = 'ARCHIVED' and not is_active from public.profiles where username = 'former-account'), 'Former account was not disabled');
select pg_temp.assert_true(to_regclass('public.committees') is null and to_regprocedure('public.create_borrowing_request(text,text,text,date,date,text,jsonb)') is null, 'Old committee/request API remains');
select 'PASS: data-preserving upgrade' as result;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select pg_temp.assert_true((select count(*) = 0 from public.borrowings), 'Former account can read student data');
select pg_temp.expect_error($q$select public.record_borrowing('Student', 'ID-1', null, 'Unauthorized test', current_date, current_date, null, '[]')$q$, 'Administrator access required');
reset role;
set local role anon;
select pg_temp.assert_true((select count(*) = 0 from public.borrowings), 'Anonymous access exposes student data');
select pg_temp.expect_error($q$select public.record_borrowing('Student', 'ID-1', null, 'Unauthorized test', current_date, current_date, null, '[]')$q$, 'permission denied');
reset role;

insert into public.items (id, item_code, category_id, item_name, total_quantity, available_quantity, storage_location) values
  ('90000000-0000-0000-0000-000000000002', 'TEST-CHAIRS', '22222222-2222-2222-2222-222222222201', 'Test chairs', 10, 10, 'Storage'),
  ('90000000-0000-0000-0000-000000000003', 'TEST-MIC', '22222222-2222-2222-2222-222222222201', 'Test microphone', 2, 2, 'Storage'),
  ('90000000-0000-0000-0000-000000000004', 'TEST-DAMAGED', '22222222-2222-2222-2222-222222222201', 'Unavailable equipment', 2, 2, 'Storage');
update public.items set condition = 'DAMAGED' where item_code = 'TEST-DAMAGED';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select pg_temp.expect_error($q$insert into public.borrowing_items (borrowing_id, item_id, quantity_borrowed) values ('80000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002', 1)$q$, 'permission denied');
select pg_temp.expect_error($q$update public.borrowings set status = 'RETURNED'$q$, 'permission denied');
select pg_temp.expect_error($q$update public.items set available_quantity = 999$q$, 'permission denied');
select pg_temp.expect_error($q$select public.log_audit_action('FAKE', 'borrowings', null, 'Fake audit')$q$, 'permission denied');
select 'PASS: admin-only RPC access and blocked direct writes' as result;

do $$
declare v_date date := (now() at time zone 'Asia/Manila')::date;
begin
  perform pg_temp.expect_error(format('select public.record_borrowing(%L,%L,null,%L,%L,%L,null,%L)', 'A Student','ID-1','Validation test',v_date,v_date,'[]'), 'At least one item');
  perform pg_temp.expect_error(format('select public.record_borrowing(%L,%L,null,%L,%L,%L,null,null)', 'A Student','ID-1','Validation test',v_date,v_date), 'At least one item');
  perform pg_temp.expect_error(format('select public.record_borrowing(%L,%L,null,%L,%L,%L,null,%L)', 'A Student','','Validation test',v_date,v_date,'[{"itemId":"90000000-0000-0000-0000-000000000002","quantity":1}]'), 'Student full name');
  perform pg_temp.expect_error(format('select public.record_borrowing(%L,%L,null,%L,%L,%L,null,%L)', 'A Student','ID-1','Validation test',v_date+1,v_date+1,'[{"itemId":"90000000-0000-0000-0000-000000000002","quantity":1}]'), 'Checkout must');
  perform pg_temp.expect_error(format('select public.record_borrowing(%L,%L,null,%L,%L,%L,null,%L)', 'A Student','ID-1','Validation test',v_date,v_date-1,'[{"itemId":"90000000-0000-0000-0000-000000000002","quantity":1}]'), 'Checkout must');
  perform pg_temp.expect_error(format('select public.record_borrowing(%L,%L,null,%L,%L,%L,null,%L)', 'A Student','ID-1','Validation test',v_date,v_date,'[{"itemId":"90000000-0000-0000-0000-000000000002","quantity":1.5}]'), 'positive whole');
  perform pg_temp.expect_error(format('select public.record_borrowing(%L,%L,null,%L,%L,%L,null,%L)', 'A Student','ID-1','Validation test',v_date,v_date,'[{"itemId":"90000000-0000-0000-0000-000000000002","quantity":1},{"itemId":"90000000-0000-0000-0000-000000000002","quantity":1}]'), 'only appear once');
  perform pg_temp.expect_error(format('select public.record_borrowing(%L,%L,null,%L,%L,%L,null,%L)', 'A Student','ID-1','Validation test',v_date,v_date,'[{"itemId":"90000000-0000-0000-0000-000000000004","quantity":1}]'), 'unavailable for borrowing');
  -- First item has stock, second does not: both stock and header must roll back.
  perform pg_temp.expect_error(format('select public.record_borrowing(%L,%L,null,%L,%L,%L,null,%L)', 'Rollback Student','ROLLBACK','Validation test',v_date,v_date,'[{"itemId":"90000000-0000-0000-0000-000000000002","quantity":2},{"itemId":"90000000-0000-0000-0000-000000000003","quantity":3}]'), 'Insufficient stock');
  perform pg_temp.assert_true((select available_quantity = 10 from public.items where item_code = 'TEST-CHAIRS'), 'Failed checkout partially deducted stock');
  perform pg_temp.assert_true((select count(*) = 0 from public.borrowings where student_id = 'ROLLBACK'), 'Failed checkout left a header');
end $$;
select 'PASS: checkout validation and transaction rollback' as result;

do $$
declare v_id uuid; v_chairs uuid; v_mic uuid; v_date date := (now() at time zone 'Asia/Manila')::date;
begin
  v_id := (public.record_borrowing('Ana Student', 'STUDENT-100', '09123456789', 'School activity', v_date-2, v_date-1, 'Test checkout',
    '[{"itemId":"90000000-0000-0000-0000-000000000002","quantity":5},{"itemId":"90000000-0000-0000-0000-000000000003","quantity":1}]')->>'id')::uuid;
  select id into v_chairs from public.borrowing_items where borrowing_id = v_id and item_id = '90000000-0000-0000-0000-000000000002';
  select id into v_mic from public.borrowing_items where borrowing_id = v_id and item_id = '90000000-0000-0000-0000-000000000003';
  perform pg_temp.assert_true((select available_quantity = 5 from public.items where item_code = 'TEST-CHAIRS'), 'Checkout did not deduct stock');
  perform pg_temp.expect_error($q$select public.update_inventory_item('90000000-0000-0000-0000-000000000002','{"totalQuantity":4}')$q$, 'below borrowed');
  perform pg_temp.expect_error($q$select public.update_inventory_item('90000000-0000-0000-0000-000000000002','{"isActive":false}')$q$, 'while units are borrowed');
  perform public.update_inventory_item('90000000-0000-0000-0000-000000000003', '{"totalQuantity":3}');
  perform pg_temp.assert_true((select total_quantity = 3 and available_quantity = 2 from public.items where item_code = 'TEST-MIC'), 'Restock did not preserve outstanding loan');
  perform pg_temp.assert_true((public.get_dashboard_metrics()->'summary'->>'overdueBorrowings')::int = 1, 'Overdue metric incorrect');
  perform pg_temp.expect_error(format('select public.record_borrowing_return(%L,%L)', v_id, jsonb_build_array(jsonb_build_object('borrowingItemId',v_chairs,'quantity',6,'condition','GOOD'))), 'exceed the outstanding');
  perform pg_temp.expect_error(format('select public.record_borrowing_return(%L,%L)', v_id, jsonb_build_array(jsonb_build_object('borrowingItemId',v_chairs,'quantity',1,'condition',null))), 'valid condition');
  perform public.record_borrowing_return(v_id, jsonb_build_array(
    jsonb_build_object('borrowingItemId',v_chairs,'quantity',2,'condition','GOOD'),
    jsonb_build_object('borrowingItemId',v_chairs,'quantity',1,'condition','DAMAGED','notes','Broken leg')));
  perform pg_temp.assert_true((select status = 'ACTIVE' and returned_at is null from public.borrowings where id = v_id), 'Partial return closed borrowing');
  perform pg_temp.assert_true((select available_quantity = 7 and damaged_quantity = 1 and total_quantity = 10 and condition = 'GOOD' from public.items where item_code = 'TEST-CHAIRS'), 'Mixed return stock or item condition incorrect');
  perform pg_temp.expect_error(format('select public.record_borrowing_return(%L,%L)', v_id, jsonb_build_array(
    jsonb_build_object('borrowingItemId',v_chairs,'quantity',2,'condition','GOOD'), jsonb_build_object('borrowingItemId',v_chairs,'quantity',1,'condition','LOST'))), 'exceed the outstanding');
  perform pg_temp.expect_error(format('select public.record_borrowing_return(%L,%L)', v_id, jsonb_build_array(
    jsonb_build_object('borrowingItemId',v_mic,'quantity',1,'condition','GOOD'), jsonb_build_object('borrowingItemId','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','quantity',1,'condition','GOOD'))), 'does not belong');
  perform pg_temp.assert_true((select available_quantity = 2 from public.items where item_code = 'TEST-MIC'), 'Failed return was not atomic');
  perform public.record_borrowing_return(v_id, jsonb_build_array(
    jsonb_build_object('borrowingItemId',v_chairs,'quantity',1,'condition','FAIR'),
    jsonb_build_object('borrowingItemId',v_chairs,'quantity',1,'condition','LOST'),
    jsonb_build_object('borrowingItemId',v_mic,'quantity',1,'condition','GOOD')));
  perform pg_temp.assert_true((select status = 'RETURNED' and returned_at is not null from public.borrowings where id = v_id), 'Final return did not close borrowing');
  perform pg_temp.assert_true((select quantity_returned = 4 and quantity_lost = 1 and quantity_damaged = 1 from public.borrowing_items where id = v_chairs), 'Returned/lost counters incorrect');
  perform pg_temp.assert_true((select total_quantity = 9 and available_quantity = 8 and damaged_quantity = 1 from public.items where item_code = 'TEST-CHAIRS'), 'Final stock balance incorrect');
  perform pg_temp.expect_error(format('select public.record_borrowing_return(%L,%L)', v_id, jsonb_build_array(jsonb_build_object('borrowingItemId',v_chairs,'quantity',1,'condition','GOOD'))), 'Only active');
  perform public.repair_inventory_units('90000000-0000-0000-0000-000000000002', 1);
  perform pg_temp.assert_true((select total_quantity = 9 and available_quantity = 9 and damaged_quantity = 0 from public.items where item_code = 'TEST-CHAIRS'), 'Repair stock balance incorrect');
  perform public.update_borrowing_details(v_id, 'Ana Corrected', 'STUDENT-100', null, v_date+7, 'School activity', 'Corrected name');
  perform pg_temp.assert_true((select borrower_name = 'Ana Corrected' and expected_return_date = v_date+7 from public.borrowings where id = v_id), 'Detail edit failed');
  perform pg_temp.assert_true((select count(*) = 5 from public.borrowing_returns r join public.borrowing_items bi on bi.id = r.borrowing_item_id where bi.borrowing_id = v_id), 'Return history incomplete');
  perform pg_temp.assert_true((select count(*) = 2 from public.inventory_transactions where borrowing_id = v_id and transaction_type = 'BORROWED'), 'Checkout ledger incomplete');
  perform pg_temp.assert_true((select count(*) = 2 from public.audit_logs where entity_id = v_id and action = 'RECORD_RETURN'), 'Return audit incomplete');
end $$;
select 'PASS: partial/mixed returns, lost units, repairs, detail edits, history, and audit ledger' as result;

-- Returning a migrated outstanding loan replenishes exactly its prior deduction.
select public.record_borrowing_return('80000000-0000-0000-0000-000000000001',
  (select jsonb_agg(jsonb_build_object('borrowingItemId',id,'quantity',3,'condition','GOOD')) from public.borrowing_items where borrowing_id = '80000000-0000-0000-0000-000000000001'));
select pg_temp.assert_true((select available_quantity = 20 from public.items where item_code = 'LEGACY'), 'Legacy loan return balance incorrect');
select pg_temp.expect_error($q$select public.update_borrowing_details('80000000-0000-0000-0000-000000000003','A Student','ID-1',null,current_date,'Archived request',null)$q$, 'read-only');
select 'PASS: migrated loan return and read-only archived history' as result;
reset role;
rollback;
