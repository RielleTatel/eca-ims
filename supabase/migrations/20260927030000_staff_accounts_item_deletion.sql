-- Account writes are server-only; operational access is denied until the
-- initial/reset password has been changed through the account endpoint.
alter table public.profiles add column must_change_password boolean not null default false;
alter table public.profiles add column password_operation uuid;
alter table public.profiles add column password_operation_started_at timestamptz;
create unique index profiles_username_lower_unique on public.profiles (lower(username));
revoke insert, update, delete on public.profiles from public, anon, authenticated;
drop policy admin_profiles_insert on public.profiles;
drop policy admin_profiles_update on public.profiles;

create function public.can_operate() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid()
    and role in ('SUPER_ADMIN','STAFF') and is_active
    and not must_change_password and password_operation is null);
$$;
create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_operate() and exists(select 1 from public.profiles where id=auth.uid() and role='SUPER_ADMIN');
$$;

-- Preserve policy predicates (actor, bucket and transaction checks), replacing
-- only the role guard on operational resources. Settings writes stay restricted.
do $$ declare p record; begin
  for p in select * from pg_policies where (schemaname='public' and tablename in
    ('profiles','categories','items','borrowings','borrowing_items','borrowing_returns','inventory_transactions'))
    or (schemaname='public' and tablename='system_settings' and cmd='SELECT')
    or (schemaname='storage' and policyname like 'admin_attachments_%')
  loop
    execute format('alter policy %I on %I.%I%s%s', p.policyname,p.schemaname,p.tablename,
      case when p.qual is null then '' else ' using ('||replace(p.qual,'is_super_admin()','can_operate()')||')' end,
      case when p.with_check is null then '' else ' with check ('||replace(p.with_check,'is_super_admin()','can_operate()')||')' end);
  end loop;
end $$;
alter policy admin_audit_select on public.audit_logs using
  (public.can_operate() and (public.is_super_admin() or entity_type <> 'profiles'));
alter policy admin_audit_insert on public.audit_logs with check
  (public.can_operate() and user_id=auth.uid() and entity_type in ('items','categories')
    or public.is_super_admin() and user_id=auth.uid() and entity_type='system_settings');

create function public.delete_inventory_item(p_item_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_item public.items; v_count integer;
begin
  if not public.can_operate() then raise exception 'Operational access required.'; end if;
  select * into v_item from public.items where id=p_item_id for update;
  if not found then raise exception 'Item not found.'; end if;
  if exists(select 1 from public.borrowing_items where item_id=p_item_id)
    or exists(select 1 from public.inventory_transactions where item_id=p_item_id and borrowing_id is not null)
    or v_item.total_quantity <> v_item.available_quantity + v_item.damaged_quantity
  then raise exception 'Items with borrowing history cannot be permanently deleted. Deactivate the item instead.'; end if;
  delete from public.inventory_transactions where item_id=p_item_id;
  get diagnostics v_count = row_count;
  delete from public.items where id=p_item_id;
  perform public.log_audit_action('DELETE_ITEM','items',p_item_id,'Permanently deleted item '||v_item.item_name,
    to_jsonb(v_item)||jsonb_build_object('deleted_stock_transactions',v_count),null);
end $$;
revoke all on function public.delete_inventory_item(uuid) from public, anon;
grant execute on function public.delete_inventory_item(uuid) to authenticated;

create function public.list_staff_accounts() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'Super-admin access required.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'email',u.email,
    'isActive',p.is_active,'mustChangePassword',p.must_change_password,'createdAt',p.created_at) order by p.created_at desc)
    from public.profiles p join auth.users u on u.id=p.id where p.role='STAFF'),'[]'::jsonb);
end $$;
revoke all on function public.list_staff_accounts() from public, anon;
grant execute on function public.list_staff_accounts() to authenticated;

-- Called only by the trusted Edge Function after Auth validates the caller.
create function public.provision_staff(p_actor uuid,p_id uuid,p_username text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.profiles where id=p_actor and role='SUPER_ADMIN' and is_active
    and not must_change_password and password_operation is null) then raise exception 'Super-admin access required.'; end if;
  if p_username !~ '^[a-z0-9][a-z0-9_.-]{2,49}$' then raise exception 'Invalid username.'; end if;
  insert into public.profiles(id,username,role,is_active,must_change_password) values(p_id,p_username,'STAFF',true,true);
  insert into public.audit_logs(user_id,action,entity_type,entity_id,description)
    values(p_actor,'CREATE_ACCOUNT','profiles',p_id,'Created staff account '||p_username);
end $$;
create function public.set_staff_active(p_target uuid,p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if not public.is_super_admin() then raise exception 'Super-admin access required.'; end if;
  select username into v_name from public.profiles where id=p_target and role='STAFF' for update;
  if not found then raise exception 'Staff account not found.'; end if;
  update public.profiles set is_active=p_active where id=p_target;
  perform public.log_audit_action(case when p_active then 'REACTIVATE_ACCOUNT' else 'DEACTIVATE_ACCOUNT' end,
    'profiles',p_target,case when p_active then 'Reactivated ' else 'Deactivated ' end||v_name,null,null);
end $$;
revoke all on function public.set_staff_active(uuid,boolean) from public, anon;
grant execute on function public.set_staff_active(uuid,boolean) to authenticated;

-- A lease serializes Auth password updates. During the lease, even an existing
-- JWT cannot access inventory. Failed/ambiguous Auth requests leave a safe gate;
-- the same workflow can retry after five minutes. No password is stored here.
create function public.begin_password_change(p_actor uuid,p_target uuid,p_reset boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_target public.profiles; v_token uuid := gen_random_uuid();
begin
  if p_reset then
    if not exists(select 1 from public.profiles where id=p_actor and role='SUPER_ADMIN' and is_active
      and not must_change_password and password_operation is null) then raise exception 'Super-admin access required.'; end if;
  elsif p_actor <> p_target then raise exception 'Cannot change another account password.'; end if;
  select * into v_target from public.profiles where id=p_target for update;
  if not found or v_target.role not in ('STAFF','SUPER_ADMIN') or (not p_reset and not v_target.is_active)
    or (p_reset and v_target.role <> 'STAFF') then raise exception 'Account not available.'; end if;
  if v_target.password_operation is not null and v_target.password_operation_started_at > now()-interval '5 minutes'
    then raise exception 'A password update is in progress. Retry in five minutes.'; end if;
  update public.profiles set password_operation=v_token,password_operation_started_at=now(),must_change_password=true where id=p_target;
  return v_token;
end $$;
create function public.finish_password_change(p_actor uuid,p_target uuid,p_token uuid,p_reset boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set must_change_password=p_reset,password_operation=null,password_operation_started_at=null
    where id=p_target and password_operation=p_token;
  if not found then raise exception 'Password operation expired. Retry the password change.'; end if;
  insert into public.audit_logs(user_id,action,entity_type,entity_id,description)
    values(p_actor,case when p_reset then 'RESET_ACCOUNT_PASSWORD' else 'CHANGE_PASSWORD' end,'profiles',p_target,
      case when p_reset then 'Reset staff password; change required at next sign-in' else 'Account password changed' end);
end $$;

-- Username resolution never reaches the browser. The gateway limits attempts
-- for both existing and unknown identifiers before checking credentials.
create schema if not exists private;
create table private.login_attempts (identifier text primary key, started_at timestamptz not null, attempts integer not null);
revoke all on private.login_attempts from public, anon, authenticated;
create function public.resolve_account_login(p_identifier text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_key text := md5(lower(trim(p_identifier))); v_attempts integer; v_email text;
begin
  delete from private.login_attempts where started_at < now()-interval '1 day';
  insert into private.login_attempts values(v_key,now(),1)
    on conflict(identifier) do update set
      attempts=case when private.login_attempts.started_at < now()-interval '15 minutes' then 1 else private.login_attempts.attempts+1 end,
      started_at=case when private.login_attempts.started_at < now()-interval '15 minutes' then now() else private.login_attempts.started_at end
    returning attempts into v_attempts;
  -- Return a sentinel instead of raising, so the rate-limit write commits.
  if v_attempts > 10 then return '__RATE_LIMITED__'; end if;
  select u.email into v_email from public.profiles p join auth.users u on u.id=p.id
    where p.is_active and p.role in ('STAFF','SUPER_ADMIN')
    and (lower(p.username)=lower(trim(p_identifier)) or lower(u.email)=lower(trim(p_identifier))) limit 1;
  return v_email;
end $$;
do $$ declare f regprocedure; begin
  foreach f in array array['public.provision_staff(uuid,uuid,text)'::regprocedure,
    'public.begin_password_change(uuid,uuid,boolean)'::regprocedure,
    'public.finish_password_change(uuid,uuid,uuid,boolean)'::regprocedure,
    'public.resolve_account_login(text)'::regprocedure] loop
    execute format('revoke all on function %s from public, anon, authenticated',f);
    execute format('grant execute on function %s to service_role',f);
  end loop;
end $$;

create or replace function public.log_audit_action(p_action text, p_entity_type text, p_entity_id uuid,
  p_description text, p_old_values jsonb default null, p_new_values jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_operate() then raise exception 'Operational access required.'; end if;
  insert into public.audit_logs (user_id, action, entity_type, entity_id, description, old_values, new_values)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_description, p_old_values, p_new_values);
end;
$$;

-- Existing stock workflows retain their locking and validation.
create or replace function public.record_borrowing(p_borrower_name text, p_student_id text, p_contact_details text,
  p_purpose text, p_borrow_date date, p_expected_return_date date, p_additional_notes text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_code text; v_line record; v_item record;
begin
  if not public.can_operate() then raise exception 'Operational access required.'; end if;
  if p_borrower_name is null or length(trim(p_borrower_name)) < 2
    or p_student_id is null or length(trim(p_student_id)) = 0 then
    raise exception 'Student full name and student ID are required.';
  end if;
  if p_purpose is null or length(trim(p_purpose)) < 5 then raise exception 'Purpose must contain at least 5 characters.'; end if;
  if p_borrow_date is null or p_expected_return_date is null
    or p_borrow_date > (now() at time zone 'Asia/Manila')::date or p_expected_return_date < p_borrow_date then
    raise exception 'Checkout must be today or earlier, and expected return cannot precede checkout.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'At least one item is required.'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'At least one item is required.'; end if;
  if exists (select 1 from jsonb_to_recordset(p_items) as x("itemId" uuid, quantity numeric)
    where x."itemId" is null or quantity is null or quantity <= 0 or quantity <> trunc(quantity)) then
    raise exception 'Every item requires a positive whole quantity.';
  end if;
  if (select count(distinct x."itemId") from jsonb_to_recordset(p_items) as x("itemId" uuid)) <> jsonb_array_length(p_items) then
    raise exception 'An item may only appear once in a checkout.';
  end if;
  v_code := 'BR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  insert into public.borrowings (borrowing_code, borrower_name, student_id, contact_details,
    recorded_by, purpose, borrow_date, expected_return_date, additional_notes, borrowed_at, is_legacy)
  values (v_code, trim(p_borrower_name), trim(p_student_id), nullif(trim(p_contact_details), ''),
    auth.uid(), trim(p_purpose), p_borrow_date, p_expected_return_date, nullif(trim(p_additional_notes), ''), now(), false)
  returning id into v_id;
  -- Consistent lock ordering across checkouts, returns, and repairs.
  for v_line in select * from jsonb_to_recordset(p_items) as x("itemId" uuid, quantity int) order by "itemId"
  loop
    select i.* into v_item from public.items i where i.id = v_line."itemId" for update;
    if not found then raise exception 'Inventory item not found.'; end if;
    if not v_item.is_active or v_item.condition not in ('GOOD', 'FAIR')
      or not exists (select 1 from public.categories where id = v_item.category_id and is_active) then
      raise exception '% is unavailable for borrowing.', v_item.item_name;
    end if;
    if v_item.available_quantity < v_line.quantity then raise exception 'Insufficient stock for %.', v_item.item_name; end if;
    insert into public.borrowing_items (borrowing_id, item_id, quantity_borrowed) values (v_id, v_item.id, v_line.quantity);
    update public.items set available_quantity = available_quantity - v_line.quantity, updated_at = now() where id = v_item.id;
    insert into public.inventory_transactions (item_id, borrowing_id, performed_by, transaction_type, quantity, quantity_before, quantity_after, remarks)
    values (v_item.id, v_id, auth.uid(), 'BORROWED', v_line.quantity, v_item.available_quantity,
      v_item.available_quantity - v_line.quantity, 'Checkout ' || v_code || ' to ' || trim(p_borrower_name));
  end loop;
  perform public.log_audit_action('RECORD_BORROWING', 'borrowings', v_id, 'Recorded checkout ' || v_code,
    null, jsonb_build_object('borrowerName', trim(p_borrower_name), 'studentId', trim(p_student_id), 'items', p_items));
  return jsonb_build_object('id', v_id, 'borrowingCode', v_code);
end;
$$;

create or replace function public.record_borrowing_return(p_borrowing_id uuid, p_returns jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_borrowing record; v_line record; v_bi record; v_item record; v_total int; v_status public.borrowing_status;
begin
  if not public.can_operate() then raise exception 'Operational access required.'; end if;
  select * into v_borrowing from public.borrowings where id = p_borrowing_id for update;
  if not found then raise exception 'Borrowing record not found.'; end if;
  if v_borrowing.status <> 'ACTIVE' then raise exception 'Only active borrowings can receive returns.'; end if;
  if p_returns is null or jsonb_typeof(p_returns) <> 'array' then raise exception 'At least one return is required.'; end if;
  if jsonb_array_length(p_returns) = 0 then raise exception 'At least one return is required.'; end if;
  if exists (select 1 from jsonb_to_recordset(p_returns) as x("borrowingItemId" uuid, quantity numeric, condition text)
    where "borrowingItemId" is null or quantity is null or quantity <= 0 or quantity <> trunc(quantity)
      or condition is null or condition not in ('GOOD', 'FAIR', 'DAMAGED', 'LOST')) then
    raise exception 'Each return needs an item, a positive whole quantity, and a valid condition.';
  end if;
  -- Lock all affected inventory items in the same order as checkout.
  perform i.id from public.items i join public.borrowing_items bi on bi.item_id = i.id
    where bi.borrowing_id = p_borrowing_id order by i.id for update of i;
  for v_bi in select bi.* from public.borrowing_items bi where bi.borrowing_id = p_borrowing_id order by bi.item_id for update
  loop
    select coalesce(sum(x.quantity), 0) into v_total
    from jsonb_to_recordset(p_returns) as x("borrowingItemId" uuid, quantity int) where x."borrowingItemId" = v_bi.id;
    if v_total > v_bi.quantity_borrowed - v_bi.quantity_returned - v_bi.quantity_lost then
      raise exception 'Returned or lost quantities exceed the outstanding quantity.';
    end if;
  end loop;
  for v_line in select * from jsonb_to_recordset(p_returns) as x("borrowingItemId" uuid, quantity int, condition public.return_condition, notes text)
  loop
    select * into v_bi from public.borrowing_items where id = v_line."borrowingItemId" and borrowing_id = p_borrowing_id;
    if not found then raise exception 'Return item does not belong to this borrowing.'; end if;
    select * into v_item from public.items where id = v_bi.item_id;
    update public.borrowing_items set
      quantity_returned = quantity_returned + case when v_line.condition <> 'LOST' then v_line.quantity else 0 end,
      quantity_lost = quantity_lost + case when v_line.condition = 'LOST' then v_line.quantity else 0 end,
      quantity_damaged = quantity_damaged + case when v_line.condition = 'DAMAGED' then v_line.quantity else 0 end,
      updated_at = now() where id = v_bi.id;
    update public.items set
      available_quantity = available_quantity + case when v_line.condition in ('GOOD', 'FAIR') then v_line.quantity else 0 end,
      damaged_quantity = damaged_quantity + case when v_line.condition = 'DAMAGED' then v_line.quantity else 0 end,
      total_quantity = total_quantity - case when v_line.condition = 'LOST' then v_line.quantity else 0 end,
      updated_at = now() where id = v_item.id;
    insert into public.borrowing_returns (borrowing_item_id, quantity, condition, notes, recorded_by)
    values (v_bi.id, v_line.quantity, v_line.condition, nullif(trim(v_line.notes), ''), auth.uid());
    insert into public.inventory_transactions (item_id, borrowing_id, performed_by, transaction_type, quantity, quantity_before, quantity_after, remarks)
    values (v_item.id, p_borrowing_id, auth.uid(),
      (case when v_line.condition in ('GOOD', 'FAIR') then 'RETURNED' else v_line.condition::text end)::public.transaction_type,
      v_line.quantity,
      case when v_line.condition = 'LOST' then v_item.total_quantity else v_item.available_quantity end,
      case when v_line.condition = 'LOST' then v_item.total_quantity - v_line.quantity
        when v_line.condition = 'DAMAGED' then v_item.available_quantity else v_item.available_quantity + v_line.quantity end,
      nullif(trim(v_line.notes), ''));
  end loop;
  v_status := case when exists (select 1 from public.borrowing_items where borrowing_id = p_borrowing_id
    and quantity_returned + quantity_lost < quantity_borrowed) then 'ACTIVE'::public.borrowing_status else 'RETURNED'::public.borrowing_status end;
  update public.borrowings set status = v_status, returned_at = case when v_status = 'RETURNED' then now() else null end,
    updated_at = now() where id = p_borrowing_id;
  perform public.log_audit_action('RECORD_RETURN', 'borrowings', p_borrowing_id,
    'Recorded return for ' || v_borrowing.borrowing_code, null, p_returns);
  return jsonb_build_object('id', p_borrowing_id, 'status', v_status);
end;
$$;

create or replace function public.update_borrowing_details(p_borrowing_id uuid, p_borrower_name text, p_student_id text,
  p_contact_details text, p_expected_return_date date, p_purpose text, p_additional_notes text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_before public.borrowings;
begin
  if not public.can_operate() then raise exception 'Operational access required.'; end if;
  select * into v_before from public.borrowings where id = p_borrowing_id for update;
  if not found then raise exception 'Borrowing record not found.'; end if;
  if v_before.status = 'ARCHIVED' then raise exception 'Archived requests are read-only.'; end if;
  if p_borrower_name is null or length(trim(p_borrower_name)) < 2 or p_student_id is null or length(trim(p_student_id)) = 0
    or p_purpose is null or length(trim(p_purpose)) < 5 or p_expected_return_date is null or p_expected_return_date < v_before.borrow_date then
    raise exception 'Provide student name, ID, purpose, and a valid expected return date.';
  end if;
  update public.borrowings set borrower_name = trim(p_borrower_name), student_id = trim(p_student_id),
    contact_details = nullif(trim(p_contact_details), ''), expected_return_date = p_expected_return_date,
    purpose = trim(p_purpose), additional_notes = nullif(trim(p_additional_notes), ''), is_legacy = false, updated_at = now()
    where id = p_borrowing_id;
  perform public.log_audit_action('UPDATE_BORROWING', 'borrowings', p_borrowing_id,
    'Updated borrowing ' || v_before.borrowing_code, to_jsonb(v_before),
    (select to_jsonb(b) from public.borrowings b where id = p_borrowing_id));
  return jsonb_build_object('id', p_borrowing_id);
end;
$$;

create or replace function public.repair_inventory_units(p_item_id uuid, p_quantity int)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item public.items;
begin
  if not public.can_operate() then raise exception 'Operational access required.'; end if;
  select * into v_item from public.items where id = p_item_id for update;
  if not found then raise exception 'Item not found.'; end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > v_item.damaged_quantity then raise exception 'Invalid repaired quantity.'; end if;
  update public.items set damaged_quantity = damaged_quantity - p_quantity,
    available_quantity = available_quantity + p_quantity, updated_at = now() where id = p_item_id;
  insert into public.inventory_transactions (item_id, performed_by, transaction_type, quantity, quantity_before, quantity_after, remarks)
  values (p_item_id, auth.uid(), 'ADJUSTMENT', p_quantity, v_item.available_quantity, v_item.available_quantity + p_quantity, 'Damaged units repaired');
  perform public.log_audit_action('REPAIR_ITEM', 'items', p_item_id, 'Repaired units of ' || v_item.item_name,
    null, jsonb_build_object('quantity', p_quantity));
end;
$$;

create or replace function public.update_inventory_item(p_item_id uuid, p_input jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item public.items; v_new_total int; v_delta int; v_active boolean;
begin
  if not public.can_operate() then raise exception 'Operational access required.'; end if;
  select * into v_item from public.items where id = p_item_id for update;
  if not found then raise exception 'Inventory item not found.'; end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' then raise exception 'Item details are required.'; end if;
  if p_input ? 'totalQuantity' and ((p_input->>'totalQuantity')::numeric < 0
    or (p_input->>'totalQuantity')::numeric <> trunc((p_input->>'totalQuantity')::numeric)
    or p_input->>'totalQuantity' is null) then raise exception 'Stock must be a non-negative whole quantity.'; end if;
  v_new_total := coalesce((p_input->>'totalQuantity')::int, v_item.total_quantity);
  v_delta := v_new_total - v_item.total_quantity;
  if v_item.available_quantity + v_delta < 0 then raise exception 'Stock cannot be reduced below borrowed and damaged units.'; end if;
  v_active := coalesce((p_input->>'isActive')::boolean, v_item.is_active);
  if not v_active and v_item.total_quantity - v_item.available_quantity - v_item.damaged_quantity > 0 then
    raise exception 'Item cannot be deactivated while units are borrowed.';
  end if;
  update public.items set
    category_id = coalesce((p_input->>'categoryId')::uuid, category_id),
    item_name = coalesce(nullif(trim(p_input->>'itemName'), ''), item_name),
    description = case when p_input ? 'description' then nullif(trim(p_input->>'description'), '') else description end,
    condition = coalesce((p_input->>'condition')::public.item_condition, condition),
    storage_location = coalesce(nullif(trim(p_input->>'storageLocation'), ''), storage_location),
    google_drive_folder_link = case when p_input ? 'googleDriveFolderLink' then nullif(trim(p_input->>'googleDriveFolderLink'), '') else google_drive_folder_link end,
    total_quantity = v_new_total, available_quantity = available_quantity + v_delta,
    is_active = v_active, updated_by = auth.uid(), updated_at = now() where id = p_item_id;
  if v_delta <> 0 then
    insert into public.inventory_transactions (item_id, performed_by, transaction_type, quantity, quantity_before, quantity_after, remarks)
    values (p_item_id, auth.uid(), case when v_delta > 0 then 'QUANTITY_INCREASED'::public.transaction_type else 'QUANTITY_DECREASED'::public.transaction_type end,
      abs(v_delta), v_item.total_quantity, v_new_total, 'Administrator stock adjustment');
  end if;
  perform public.log_audit_action('UPDATE_ITEM', 'items', p_item_id, 'Updated item ' || v_item.item_name,
    to_jsonb(v_item), (select to_jsonb(i) from public.items i where id = p_item_id));
end;
$$;

create or replace function public.get_dashboard_metrics() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_summary jsonb; v_activity jsonb;
begin
  if not public.can_operate() then raise exception 'Operational access required.'; end if;
  select jsonb_build_object('totalInventoryItems', count(*), 'totalInventoryQuantity', coalesce(sum(total_quantity),0),
    'availableQuantity', coalesce(sum(available_quantity),0), 'damagedQuantity', coalesce(sum(damaged_quantity),0),
    'borrowedQuantity', coalesce(sum(total_quantity - available_quantity - damaged_quantity),0)) into v_summary from public.items where is_active;
  v_summary := v_summary || jsonb_build_object(
    'activeBorrowings', (select count(*) from public.borrowings where status = 'ACTIVE'),
    'overdueBorrowings', (select count(*) from public.borrowings where status = 'ACTIVE' and expected_return_date < (now() at time zone 'Asia/Manila')::date),
    'returnedToday', (select count(*) from public.borrowings where status = 'RETURNED' and (returned_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date));
  select coalesce(jsonb_agg(jsonb_build_object('id', al.id, 'action', al.action, 'message', al.description,
    'entityType', al.entity_type, 'entityId', al.entity_id, 'actor', case when p.id is null then null else jsonb_build_object('id', p.id, 'username', p.username) end,
    'createdAt', al.created_at) order by al.created_at desc), '[]'::jsonb) into v_activity
  from (select * from public.audit_logs where public.is_super_admin() or entity_type <> 'profiles' order by created_at desc limit 8) al left join public.profiles p on p.id = al.user_id;
  return jsonb_build_object('summary', v_summary, 'recentActivity', v_activity, 'generatedAt', now());
end;
$$;

notify pgrst, 'reload schema';
