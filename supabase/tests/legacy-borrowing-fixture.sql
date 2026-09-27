-- Upgrade fixtures: an outstanding loan, a completed loan, and an unused request.
insert into auth.users (id) values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into public.committees (id, name) values ('10000000-0000-0000-0000-000000000001', 'Historical group');
insert into public.profiles (id, username, role, committee_id) values
  ('00000000-0000-0000-0000-000000000001', 'admin', 'SUPER_ADMIN', null),
  ('00000000-0000-0000-0000-000000000002', 'former-account', 'COMMITTEE', '10000000-0000-0000-0000-000000000001');
insert into public.categories (id, name) values ('22222222-2222-2222-2222-222222222201', 'Audio & Visual');
insert into public.items (id, item_code, category_id, item_name, total_quantity, available_quantity, storage_location)
values ('90000000-0000-0000-0000-000000000001', 'LEGACY', '22222222-2222-2222-2222-222222222201', 'Legacy chairs', 20, 17, 'Storage');
insert into public.borrowing_requests (id, request_code, committee_id, submitted_by, requester_name, requester_position, purpose, borrow_date, expected_return_date, status, borrowed_at, returned_at)
values
  ('80000000-0000-0000-0000-000000000001', 'BR-LEGACY-ACTIVE', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Existing Borrower', 'Student', 'Previous event', current_date, current_date, 'APPROVED', now(), null),
  ('80000000-0000-0000-0000-000000000002', 'BR-LEGACY-RETURNED', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Previous Borrower', 'Student', 'Previous event', current_date, current_date, 'RETURNED', now(), now()),
  ('80000000-0000-0000-0000-000000000003', 'BR-LEGACY-PENDING', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Unused Request', 'Student', 'Previous event', current_date, current_date, 'PENDING', null, null);
insert into public.borrowing_request_items (borrowing_request_id, item_id, quantity_requested, quantity_returned, return_condition)
values
  ('80000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 3, 0, null),
  ('80000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', 2, 2, 'GOOD'),
  ('80000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000001', 1, 0, null);
