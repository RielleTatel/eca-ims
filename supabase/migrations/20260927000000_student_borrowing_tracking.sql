-- Replace committee requests with administrator-recorded student checkouts.
-- Preserve existing IDs, stock balances, transactions, and historical actors.

drop function public.create_borrowing_request(text, text, text, date, date, text, jsonb);
drop function public.approve_borrowing_request(uuid, text);
drop function public.reject_borrowing_request(uuid, text);
drop function public.return_borrowing_request(uuid, public.return_condition, text);
drop function public.admin_create_committee_account(text, text, uuid);
drop function public.admin_reset_committee_password(uuid, text);
drop function public.get_dashboard_metrics();
drop function public.log_audit_action(text, text, uuid, text, uuid, jsonb, jsonb);

-- Remove ownership policies before removing their committee dependencies.
do $$
declare v_policy record;
begin
  for v_policy in select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in (
      'borrowing_requests', 'borrowing_request_items', 'profiles', 'categories',
      'items', 'system_settings', 'inventory_transactions', 'audit_logs')
  loop
    execute format('drop policy %I on public.%I', v_policy.policyname, v_policy.tablename);
  end loop;
end;
$$;
drop function public.get_user_committee_id();
drop policy "Super Admins can upload attachments" on storage.objects;
drop policy "Super Admins can update/delete attachments" on storage.objects;
drop policy "Authenticated users can view attachments" on storage.objects;

alter table public.borrowing_requests add column legacy_metadata jsonb;
update public.borrowing_requests r set legacy_metadata = to_jsonb(r) - 'legacy_metadata'
  || jsonb_build_object('committee_name', c.name)
from public.committees c where c.id = r.committee_id;

alter table public.borrowing_requests rename to borrowings;
alter table public.borrowings rename column request_code to borrowing_code;
alter table public.borrowings rename column requester_name to borrower_name;
alter table public.borrowings rename column submitted_by to recorded_by;
alter table public.borrowings rename constraint borrowing_requests_submitted_by_fkey to borrowings_recorded_by_fkey;
alter table public.borrowings add column student_id varchar(100);
alter table public.borrowings add column contact_details varchar(200);
alter table public.borrowings add column is_legacy boolean not null default true;
alter table public.borrowings alter column is_legacy set default false;
alter table public.borrowings drop column committee_id;
alter table public.borrowings drop column requester_position;
alter table public.borrowings drop column rejection_reason;
alter table public.borrowings drop column cancellation_reason;
alter table public.borrowings drop column approved_by;
alter table public.borrowings drop column approved_at;
alter table public.borrowings drop column rejected_by;
alter table public.borrowings drop column rejected_at;
alter table public.borrowings drop column cancelled_by;
alter table public.borrowings drop column cancelled_at;
alter table public.borrowings drop column submitted_at;

create type public.borrowing_status as enum ('ACTIVE', 'RETURNED', 'ARCHIVED');
alter table public.borrowings alter column status drop default;
alter table public.borrowings alter column status type public.borrowing_status using
  (case when status::text in ('APPROVED', 'BORROWED') then 'ACTIVE'
    when status::text = 'RETURNED' then 'RETURNED' else 'ARCHIVED' end)::public.borrowing_status;
alter table public.borrowings alter column status set default 'ACTIVE';
drop type public.request_status;
alter table public.borrowings add constraint borrowing_student_required
  check (is_legacy or (length(trim(borrower_name)) >= 2 and length(trim(student_id)) > 0 and student_id is not null));

alter table public.borrowing_request_items rename to borrowing_items;
alter table public.borrowing_items rename column borrowing_request_id to borrowing_id;
alter table public.borrowing_items rename column quantity_requested to quantity_borrowed;
alter table public.borrowing_items rename constraint borrowing_request_items_borrowing_request_id_fkey to borrowing_items_borrowing_id_fkey;
alter table public.borrowing_items rename constraint borrowing_request_items_item_id_fkey to borrowing_items_item_id_fkey;
alter table public.borrowing_items drop column quantity_approved;
alter table public.borrowing_items drop column quantity_released;
alter table public.borrowing_items add column quantity_lost integer not null default 0;
alter table public.borrowing_items add column quantity_damaged integer not null default 0;
update public.borrowing_items set quantity_lost = quantity_returned, quantity_returned = 0 where return_condition = 'LOST';
update public.borrowing_items set quantity_damaged = quantity_returned where return_condition = 'DAMAGED';
alter table public.borrowing_items add constraint borrowing_item_resolved_quantity
  check (quantity_lost >= 0 and quantity_returned + quantity_lost <= quantity_borrowed
    and quantity_damaged >= 0 and quantity_damaged <= quantity_returned);

alter table public.inventory_transactions rename column borrowing_request_id to borrowing_id;
alter table public.inventory_transactions rename constraint inventory_transactions_borrowing_request_id_fkey to inventory_transactions_borrowing_id_fkey;
alter table public.audit_logs drop column committee_id;
alter table public.profiles drop column committee_id;
drop table public.committees;

-- Keep former accounts as inactive historical actors, never promote them.
create type public.account_role as enum ('SUPER_ADMIN', 'ARCHIVED');
alter table public.profiles alter column role drop default;
alter table public.profiles alter column role type public.account_role using
  (case when role::text = 'SUPER_ADMIN' then 'SUPER_ADMIN' else 'ARCHIVED' end)::public.account_role;
update public.profiles set is_active = false where role = 'ARCHIVED';
alter table public.profiles alter column role set default 'ARCHIVED';
alter table public.profiles add constraint archived_account_inactive check (role <> 'ARCHIVED' or not is_active);
drop type public.user_role;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'SUPER_ADMIN' and is_active);
$$;

-- Recreate the application policies for its administrator-only access model.
create policy admin_profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_super_admin());
create policy admin_profiles_insert on public.profiles for insert to authenticated with check (public.is_super_admin());
create policy admin_profiles_update on public.profiles for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy admin_categories_select on public.categories for select to authenticated using (public.is_super_admin());
create policy admin_categories_manage on public.categories for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy admin_items_select on public.items for select to authenticated using (public.is_super_admin());
create policy admin_items_insert on public.items for insert to authenticated with check (public.is_super_admin());
create policy admin_items_update on public.items for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy admin_settings_update on public.system_settings for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy admin_settings_select on public.system_settings for select to authenticated using (public.is_super_admin());
create policy admin_transactions_select on public.inventory_transactions for select to authenticated using (public.is_super_admin());
create policy admin_audit_select on public.audit_logs for select to authenticated using (public.is_super_admin());
create policy admin_attachments_insert on storage.objects for insert to authenticated with check (bucket_id = 'inventory-attachments' and public.is_super_admin());
create policy admin_attachments_delete on storage.objects for delete to authenticated using (bucket_id = 'inventory-attachments' and public.is_super_admin());
create policy admin_attachments_select on storage.objects for select to authenticated using (bucket_id = 'inventory-attachments' and public.is_super_admin());
create policy admin_borrowings_select on public.borrowings for select to authenticated using (public.is_super_admin());
create policy admin_borrowing_items_select on public.borrowing_items for select to authenticated using (public.is_super_admin());
-- No INSERT/UPDATE/DELETE policies: checkout and return must use atomic RPCs.
revoke insert, update, delete on public.borrowings, public.borrowing_items from anon, authenticated;

-- Damaged returns remain on hand, but cannot be borrowed until repaired.
alter table public.items add column damaged_quantity integer not null default 0;
alter table public.items add constraint item_stock_partition check
  (damaged_quantity >= 0 and available_quantity + damaged_quantity <= total_quantity);
revoke update, delete on public.items from anon, authenticated;

create table public.borrowing_returns (
  id uuid primary key default gen_random_uuid(),
  borrowing_item_id uuid not null references public.borrowing_items(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  condition public.return_condition not null,
  notes text,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index borrowing_returns_item_idx on public.borrowing_returns(borrowing_item_id);
alter table public.borrowing_returns enable row level security;
create policy admin_returns_select on public.borrowing_returns for select to authenticated using (public.is_super_admin());
revoke insert, update, delete on public.borrowing_returns from anon, authenticated;
insert into public.borrowing_returns (borrowing_item_id, quantity, condition, notes, recorded_by, created_at)
select bi.id, bi.quantity_returned + bi.quantity_lost, bi.return_condition, bi.return_notes,
  b.recorded_by, coalesce(b.returned_at, bi.updated_at)
from public.borrowing_items bi join public.borrowings b on b.id = bi.borrowing_id
where bi.return_condition is not null and bi.quantity_returned + bi.quantity_lost > 0;
alter table public.borrowing_items drop column return_condition;
alter table public.borrowing_items drop column return_notes;

create function public.log_audit_action(p_action text, p_entity_type text, p_entity_id uuid,
  p_description text, p_old_values jsonb default null, p_new_values jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'Administrator access required.'; end if;
  insert into public.audit_logs (user_id, action, entity_type, entity_id, description, old_values, new_values)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_description, p_old_values, p_new_values);
end;
$$;
revoke all on function public.log_audit_action(text, text, uuid, text, jsonb, jsonb) from public, anon, authenticated;

create function public.record_borrowing(p_borrower_name text, p_student_id text, p_contact_details text,
  p_purpose text, p_borrow_date date, p_expected_return_date date, p_additional_notes text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_code text; v_line record; v_item record;
begin
  if not public.is_super_admin() then raise exception 'Administrator access required.'; end if;
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

create function public.record_borrowing_return(p_borrowing_id uuid, p_returns jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_borrowing record; v_line record; v_bi record; v_item record; v_total int; v_status public.borrowing_status;
begin
  if not public.is_super_admin() then raise exception 'Administrator access required.'; end if;
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

create function public.update_borrowing_details(p_borrowing_id uuid, p_borrower_name text, p_student_id text,
  p_contact_details text, p_expected_return_date date, p_purpose text, p_additional_notes text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_before public.borrowings;
begin
  if not public.is_super_admin() then raise exception 'Administrator access required.'; end if;
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

create function public.repair_inventory_units(p_item_id uuid, p_quantity int)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item public.items;
begin
  if not public.is_super_admin() then raise exception 'Administrator access required.'; end if;
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

-- Stock edits share the checkout lock, preventing stale frontend quantities
-- from overwriting a simultaneous checkout or return.
create function public.update_inventory_item(p_item_id uuid, p_input jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item public.items; v_new_total int; v_delta int; v_active boolean;
begin
  if not public.is_super_admin() then raise exception 'Administrator access required.'; end if;
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

create function public.get_dashboard_metrics() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_summary jsonb; v_activity jsonb;
begin
  if not public.is_super_admin() then raise exception 'Administrator access required.'; end if;
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
  from (select * from public.audit_logs order by created_at desc limit 8) al left join public.profiles p on p.id = al.user_id;
  return jsonb_build_object('summary', v_summary, 'recentActivity', v_activity, 'generatedAt', now());
end;
$$;

revoke all on function public.record_borrowing(text, text, text, text, date, date, text, jsonb) from public, anon;
revoke all on function public.record_borrowing_return(uuid, jsonb) from public, anon;
revoke all on function public.update_borrowing_details(uuid, text, text, text, date, text, text) from public, anon;
revoke all on function public.repair_inventory_units(uuid, int) from public, anon;
revoke all on function public.update_inventory_item(uuid, jsonb) from public, anon;
revoke all on function public.get_dashboard_metrics() from public, anon;
grant execute on function public.record_borrowing(text, text, text, text, date, date, text, jsonb) to authenticated;
grant execute on function public.record_borrowing_return(uuid, jsonb) to authenticated;
grant execute on function public.update_borrowing_details(uuid, text, text, text, date, text, text) to authenticated;
grant execute on function public.repair_inventory_units(uuid, int) to authenticated;
grant execute on function public.update_inventory_item(uuid, jsonb) to authenticated;
grant execute on function public.get_dashboard_metrics() to authenticated;
