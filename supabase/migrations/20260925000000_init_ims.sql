-- ==============================================================================
-- SITEAO OpsTracker (ECA-IMS) - Supabase Schema Migration
-- Complete Schema with RLS, Constraints, RPCs, Triggers, and Storage Policies
-- ==============================================================================

-- 1. Custom Types & Enums
create type public.user_role as enum ('SUPER_ADMIN', 'COMMITTEE');
create type public.item_condition as enum ('GOOD', 'FAIR', 'DAMAGED', 'UNDER_REPAIR', 'LOST');
create type public.request_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'BORROWED', 'RETURNED');
create type public.return_condition as enum ('GOOD', 'FAIR', 'DAMAGED', 'LOST');
create type public.transaction_type as enum (
  'ITEM_ADDED',
  'QUANTITY_INCREASED',
  'QUANTITY_DECREASED',
  'BORROWED',
  'RETURNED',
  'DAMAGED',
  'LOST',
  'ADJUSTMENT'
);

-- 2. Base Tables

-- Committees
create table public.committees (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) unique not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Profiles (linked to Supabase auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  committee_id uuid unique references public.committees(id) on delete set null,
  username varchar(50) unique not null,
  role public.user_role not null default 'COMMITTEE',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) unique not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- System Settings
create table public.system_settings (
  id varchar(32) primary key default 'siteao',
  siteao_governor_name varchar(150) not null default 'HON. JHERMIE P. LICAROS',
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Items
create table public.items (
  id uuid primary key default gen_random_uuid(),
  item_code varchar(50) unique not null,
  category_id uuid not null references public.categories(id) on delete restrict,
  item_name varchar(150) not null,
  description text,
  total_quantity integer not null check (total_quantity >= 0),
  available_quantity integer not null check (available_quantity >= 0 and available_quantity <= total_quantity),
  condition public.item_condition not null default 'GOOD',
  storage_location varchar(150) not null,
  google_drive_folder_link text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Borrowing Requests
create table public.borrowing_requests (
  id uuid primary key default gen_random_uuid(),
  request_code varchar(50) unique not null,
  committee_id uuid not null references public.committees(id) on delete restrict,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  requester_name varchar(150) not null,
  requester_position varchar(100) not null,
  purpose text not null,
  borrow_date date not null,
  expected_return_date date not null,
  additional_notes text,
  status public.request_status not null default 'PENDING',
  rejection_reason text,
  cancellation_reason text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  rejected_by uuid references public.profiles(id) on delete set null,
  rejected_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete set null,
  cancelled_at timestamptz,
  borrowed_at timestamptz,
  returned_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint check_expected_return_date check (expected_return_date >= borrow_date)
);

-- Borrowing Request Items
create table public.borrowing_request_items (
  id uuid primary key default gen_random_uuid(),
  borrowing_request_id uuid not null references public.borrowing_requests(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete restrict,
  quantity_requested integer not null check (quantity_requested > 0),
  quantity_approved integer check (quantity_approved >= 0),
  quantity_released integer check (quantity_released >= 0),
  quantity_returned integer not null default 0 check (quantity_returned >= 0),
  return_condition public.return_condition,
  return_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (borrowing_request_id, item_id)
);

-- Inventory Transactions (Immutable Ledger)
create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete restrict,
  borrowing_request_id uuid references public.borrowing_requests(id) on delete set null,
  performed_by uuid not null references public.profiles(id) on delete restrict,
  transaction_type public.transaction_type not null,
  quantity integer not null,
  quantity_before integer not null,
  quantity_after integer not null,
  remarks text,
  created_at timestamptz not null default now()
);

-- Audit Logs (Immutable Audit Trail)
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  committee_id uuid references public.committees(id) on delete set null,
  action varchar(100) not null,
  entity_type varchar(100) not null,
  entity_id uuid,
  description text not null,
  old_values jsonb,
  new_values jsonb,
  ip_address varchar(45),
  created_at timestamptz not null default now()
);

-- Indexes for high performance
create index idx_profiles_committee_id on public.profiles(committee_id);
create index idx_items_category_id on public.items(category_id);
create index idx_items_condition on public.items(condition);
create index idx_items_is_active on public.items(is_active);
create index idx_borrowing_requests_committee_id on public.borrowing_requests(committee_id);
create index idx_borrowing_requests_submitted_by on public.borrowing_requests(submitted_by);
create index idx_borrowing_requests_status on public.borrowing_requests(status);
create index idx_borrowing_requests_borrow_date on public.borrowing_requests(borrow_date);
create index idx_borrowing_requests_expected_return_date on public.borrowing_requests(expected_return_date);
create index idx_borrowing_request_items_req on public.borrowing_request_items(borrowing_request_id);
create index idx_borrowing_request_items_item on public.borrowing_request_items(item_id);
create index idx_inventory_transactions_item on public.inventory_transactions(item_id);
create index idx_inventory_transactions_created_at on public.inventory_transactions(created_at desc);
create index idx_audit_logs_user on public.audit_logs(user_id);
create index idx_audit_logs_created_at on public.audit_logs(created_at desc);

-- 3. Security Helper Functions

create or replace function public.is_super_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'SUPER_ADMIN' and is_active = true
  );
$$;

create or replace function public.get_user_committee_id()
returns uuid language sql stable security definer as $$
  select committee_id from public.profiles
  where id = auth.uid() and is_active = true;
$$;

create or replace function public.get_current_username()
returns text language sql stable security definer as $$
  select username from public.profiles where id = auth.uid();
$$;

-- 4. Enable Row Level Security (RLS) on ALL tables

alter table public.committees enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.system_settings enable row level security;
alter table public.items enable row level security;
alter table public.borrowing_requests enable row level security;
alter table public.borrowing_request_items enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.audit_logs enable row level security;

-- Committees Policies
create policy "Authenticated users can view committees"
  on public.committees for select
  to authenticated
  using (true);

create policy "Super Admins can insert committees"
  on public.committees for insert
  to authenticated
  with check (public.is_super_admin());

create policy "Super Admins can update committees"
  on public.committees for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Profiles Policies
create policy "Users can view their own profile or Super Admins can view all"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_super_admin());

create policy "Super Admins can insert profiles"
  on public.profiles for insert
  to authenticated
  with check (public.is_super_admin());

create policy "Super Admins can update profiles"
  on public.profiles for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Categories Policies
create policy "Authenticated users can view active categories or Super Admin views all"
  on public.categories for select
  to authenticated
  using (is_active = true or public.is_super_admin());

create policy "Super Admins can manage categories"
  on public.categories for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- System Settings Policies
create policy "Authenticated users can view system settings"
  on public.system_settings for select
  to authenticated
  using (true);

create policy "Super Admins can update system settings"
  on public.system_settings for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Items Policies
create policy "Authenticated users can view active items or Super Admin views all"
  on public.items for select
  to authenticated
  using (is_active = true or public.is_super_admin());

create policy "Super Admins can insert items"
  on public.items for insert
  to authenticated
  with check (public.is_super_admin());

create policy "Super Admins can update items"
  on public.items for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Borrowing Requests Policies
create policy "Super Admins can view all requests, Committees only view their own"
  on public.borrowing_requests for select
  to authenticated
  using (
    public.is_super_admin() or
    committee_id = public.get_user_committee_id()
  );

create policy "Committee users can submit borrowing requests for their committee"
  on public.borrowing_requests for insert
  to authenticated
  with check (
    committee_id = public.get_user_committee_id() and
    submitted_by = auth.uid()
  );

create policy "Super Admins can update borrowing requests"
  on public.borrowing_requests for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Borrowing Request Items Policies
create policy "Users can view items of requests they can see"
  on public.borrowing_request_items for select
  to authenticated
  using (
    exists (
      select 1 from public.borrowing_requests r
      where r.id = borrowing_request_items.borrowing_request_id
      and (public.is_super_admin() or r.committee_id = public.get_user_committee_id())
    )
  );

create policy "Committees can insert request items for their own pending requests"
  on public.borrowing_request_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.borrowing_requests r
      where r.id = borrowing_request_items.borrowing_request_id
      and r.committee_id = public.get_user_committee_id()
      and r.submitted_by = auth.uid()
    )
  );

create policy "Super Admins can update request items"
  on public.borrowing_request_items for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Inventory Transactions & Audit Logs (Read-only for Super Admin, direct client writes blocked)
create policy "Super Admins can view inventory transactions"
  on public.inventory_transactions for select
  to authenticated
  using (public.is_super_admin());

create policy "Super Admins can view audit logs"
  on public.audit_logs for select
  to authenticated
  using (public.is_super_admin());

-- 5. Stored Procedures / RPCs for Complex Multi-Step Transactions

-- Helper to record audit log inside security definer functions
create or replace function public.log_audit_action(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_description text,
  p_committee_id uuid default null,
  p_old_values jsonb default null,
  p_new_values jsonb default null
)
returns void language plpgsql security definer as $$
begin
  insert into public.audit_logs (
    user_id, committee_id, action, entity_type, entity_id, description, old_values, new_values
  ) values (
    auth.uid(), p_committee_id, p_action, p_entity_type, p_entity_id, p_description, p_old_values, p_new_values
  );
end;
$$;

-- Atomic RPC: Create Borrowing Request
create or replace function public.create_borrowing_request(
  p_requester_name text,
  p_requester_position text,
  p_purpose text,
  p_borrow_date date,
  p_expected_return_date date,
  p_additional_notes text,
  p_items jsonb
)
returns jsonb language plpgsql security definer as $$
declare
  v_committee_id uuid;
  v_request_id uuid;
  v_request_code text;
  v_item jsonb;
  v_item_id uuid;
  v_qty int;
  v_db_item record;
begin
  -- Validate committee identity
  v_committee_id := public.get_user_committee_id();
  if v_committee_id is null then
    raise exception 'A verified committee account is required to submit borrowing requests.';
  end if;

  if p_expected_return_date < p_borrow_date then
    raise exception 'Expected return date cannot be before borrow date.';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'At least one item must be requested.';
  end if;

  -- Generate readable unique request code
  v_request_code := 'BR-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));

  -- Insert Request
  insert into public.borrowing_requests (
    request_code, committee_id, submitted_by, requester_name, requester_position,
    purpose, borrow_date, expected_return_date, additional_notes, status
  ) values (
    v_request_code, v_committee_id, auth.uid(), p_requester_name, p_requester_position,
    p_purpose, p_borrow_date, p_expected_return_date, p_additional_notes, 'PENDING'
  ) returning id into v_request_id;

  -- Insert Items & Validate
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_item_id := (v_item->>'itemId')::uuid;
    v_qty := (v_item->>'quantity')::int;

    if v_qty <= 0 then
      raise exception 'Quantity requested must be greater than zero.';
    end if;

    select * into v_db_item from public.items where id = v_item_id and is_active = true;
    if v_db_item.id is null then
      raise exception 'Item not found or inactive: %', v_item_id;
    end if;

    if v_db_item.available_quantity < v_qty then
      raise exception 'Requested quantity (%) exceeds available stock (%) for %', v_qty, v_db_item.available_quantity, v_db_item.item_name;
    end if;

    insert into public.borrowing_request_items (
      borrowing_request_id, item_id, quantity_requested
    ) values (
      v_request_id, v_item_id, v_qty
    );
  end loop;

  -- Audit Log
  perform public.log_audit_action(
    'CREATE_BORROW_REQUEST',
    'borrowing_requests',
    v_request_id,
    'Submitted borrowing request ' || v_request_code || ' for committee',
    v_committee_id
  );

  return jsonb_build_object(
    'success', true,
    'id', v_request_id,
    'requestCode', v_request_code
  );
end;
$$;

-- Atomic RPC: Approve Borrowing Request
create or replace function public.approve_borrowing_request(
  p_request_id uuid,
  p_remarks text default null
)
returns jsonb language plpgsql security definer as $$
declare
  v_req record;
  v_item record;
begin
  if not public.is_super_admin() then
    raise exception 'Unauthorized: Super Admin permissions required.';
  end if;

  select * into v_req from public.borrowing_requests
  where id = p_request_id for update;

  if v_req.id is null then
    raise exception 'Borrowing request not found.';
  end if;

  if v_req.status != 'PENDING' then
    raise exception 'Only PENDING requests can be approved.';
  end if;

  for v_item in
    select bri.item_id, bri.quantity_requested, i.item_name, i.available_quantity
    from public.borrowing_request_items bri
    join public.items i on i.id = bri.item_id
    where bri.borrowing_request_id = p_request_id
    for update of i
  loop
    if v_item.available_quantity < v_item.quantity_requested then
      raise exception 'Insufficient available stock for % (Available: %, Requested: %)',
        v_item.item_name, v_item.available_quantity, v_item.quantity_requested;
    end if;

    -- Decrement available stock
    update public.items
    set available_quantity = available_quantity - v_item.quantity_requested,
        updated_at = now()
    where id = v_item.item_id;

    -- Ledger Entry
    insert into public.inventory_transactions (
      item_id, borrowing_request_id, performed_by, transaction_type,
      quantity, quantity_before, quantity_after, remarks
    ) values (
      v_item.item_id, p_request_id, auth.uid(), 'BORROWED',
      v_item.quantity_requested, v_item.available_quantity,
      v_item.available_quantity - v_item.quantity_requested, p_remarks
    );
  end loop;

  update public.borrowing_requests
  set status = 'APPROVED',
      approved_by = auth.uid(),
      approved_at = now(),
      borrowed_at = now(),
      updated_at = now()
  where id = p_request_id;

  perform public.log_audit_action(
    'APPROVE_BORROW_REQUEST',
    'borrowing_requests',
    p_request_id,
    'Approved request ' || v_req.request_code,
    v_req.committee_id
  );

  return jsonb_build_object('success', true);
end;
$$;

-- Atomic RPC: Reject Borrowing Request
create or replace function public.reject_borrowing_request(
  p_request_id uuid,
  p_reason text
)
returns jsonb language plpgsql security definer as $$
declare
  v_req record;
begin
  if not public.is_super_admin() then
    raise exception 'Unauthorized: Super Admin permissions required.';
  end if;

  select * into v_req from public.borrowing_requests
  where id = p_request_id for update;

  if v_req.id is null then
    raise exception 'Borrowing request not found.';
  end if;

  if v_req.status != 'PENDING' then
    raise exception 'Only PENDING requests can be rejected.';
  end if;

  update public.borrowing_requests
  set status = 'REJECTED',
      rejected_by = auth.uid(),
      rejected_at = now(),
      rejection_reason = p_reason,
      updated_at = now()
  where id = p_request_id;

  perform public.log_audit_action(
    'REJECT_BORROW_REQUEST',
    'borrowing_requests',
    p_request_id,
    'Rejected request ' || v_req.request_code || '. Reason: ' || p_reason,
    v_req.committee_id
  );

  return jsonb_build_object('success', true);
end;
$$;

-- Atomic RPC: Return Borrowing Request
create or replace function public.return_borrowing_request(
  p_request_id uuid,
  p_condition public.return_condition,
  p_notes text default null
)
returns jsonb language plpgsql security definer as $$
declare
  v_req record;
  v_item record;
  v_before_avail int;
  v_before_total int;
begin
  if not public.is_super_admin() then
    raise exception 'Unauthorized: Super Admin permissions required.';
  end if;

  select * into v_req from public.borrowing_requests
  where id = p_request_id for update;

  if v_req.id is null then
    raise exception 'Borrowing request not found.';
  end if;

  if v_req.status not in ('APPROVED', 'BORROWED') then
    raise exception 'Only APPROVED or BORROWED requests can be returned.';
  end if;

  for v_item in
    select bri.id as bri_id, bri.item_id, bri.quantity_requested, i.item_name,
           i.available_quantity, i.total_quantity
    from public.borrowing_request_items bri
    join public.items i on i.id = bri.item_id
    where bri.borrowing_request_id = p_request_id
    for update of i
  loop
    v_before_avail := v_item.available_quantity;
    v_before_total := v_item.total_quantity;

    if p_condition in ('GOOD', 'FAIR') then
      -- Items returned in working condition: available quantity increases back
      update public.items
      set available_quantity = available_quantity + v_item.quantity_requested,
          updated_at = now()
      where id = v_item.item_id;

      insert into public.inventory_transactions (
        item_id, borrowing_request_id, performed_by, transaction_type,
        quantity, quantity_before, quantity_after, remarks
      ) values (
        v_item.item_id, p_request_id, auth.uid(), 'RETURNED',
        v_item.quantity_requested, v_before_avail,
        v_before_avail + v_item.quantity_requested, p_notes
      );
    elsif p_condition = 'DAMAGED' then
      -- Damaged items: total quantity reduced, condition updated
      update public.items
      set total_quantity = greatest(0, total_quantity - v_item.quantity_requested),
          condition = 'DAMAGED',
          updated_at = now()
      where id = v_item.item_id;

      insert into public.inventory_transactions (
        item_id, borrowing_request_id, performed_by, transaction_type,
        quantity, quantity_before, quantity_after, remarks
      ) values (
        v_item.item_id, p_request_id, auth.uid(), 'DAMAGED',
        v_item.quantity_requested, v_before_total,
        greatest(0, v_before_total - v_item.quantity_requested), p_notes
      );
    elsif p_condition = 'LOST' then
      -- Lost items: total quantity reduced, condition updated
      update public.items
      set total_quantity = greatest(0, total_quantity - v_item.quantity_requested),
          condition = 'LOST',
          updated_at = now()
      where id = v_item.item_id;

      insert into public.inventory_transactions (
        item_id, borrowing_request_id, performed_by, transaction_type,
        quantity, quantity_before, quantity_after, remarks
      ) values (
        v_item.item_id, p_request_id, auth.uid(), 'LOST',
        v_item.quantity_requested, v_before_total,
        greatest(0, v_before_total - v_item.quantity_requested), p_notes
      );
    end if;

    update public.borrowing_request_items
    set quantity_returned = v_item.quantity_requested,
        return_condition = p_condition,
        return_notes = p_notes,
        updated_at = now()
    where id = v_item.bri_id;
  end loop;

  update public.borrowing_requests
  set status = 'RETURNED',
      returned_at = now(),
      updated_at = now()
  where id = p_request_id;

  perform public.log_audit_action(
    'PROCESS_RETURN',
    'borrowing_requests',
    p_request_id,
    'Processed return for ' || v_req.request_code || ' as ' || p_condition,
    v_req.committee_id
  );

  return jsonb_build_object('success', true);
end;
$$;

-- Atomic RPC: Get Aggregated Dashboard Metrics
create or replace function public.get_dashboard_metrics()
returns jsonb language plpgsql security definer as $$
declare
  v_role public.user_role;
  v_committee_id uuid;
  v_total_items int;
  v_total_qty int;
  v_avail_qty int;
  v_borrowed_qty int;
  v_pending_reqs int;
  v_active_borrowings int;
  v_overdue_borrowings int;
  v_returned_today int;
  v_active_committees int;
  v_active_accounts int;
  v_active_categories int;
  v_recent_activity jsonb;
begin
  select role, committee_id into v_role, v_committee_id
  from public.profiles where id = auth.uid() and is_active = true;

  if v_role is null then
    raise exception 'User profile not found.';
  end if;

  if v_role = 'SUPER_ADMIN' then
    select
      count(*),
      coalesce(sum(total_quantity), 0),
      coalesce(sum(available_quantity), 0)
    into v_total_items, v_total_qty, v_avail_qty
    from public.items where is_active = true;

    v_borrowed_qty := greatest(0, v_total_qty - v_avail_qty);

    select count(*) into v_pending_reqs
    from public.borrowing_requests where status = 'PENDING';

    select count(*) into v_active_borrowings
    from public.borrowing_requests where status in ('APPROVED', 'BORROWED');

    select count(*) into v_overdue_borrowings
    from public.borrowing_requests
    where status in ('APPROVED', 'BORROWED') and expected_return_date < current_date;

    select count(*) into v_returned_today
    from public.borrowing_requests
    where status = 'RETURNED' and returned_at::date = current_date;

    select count(*) into v_active_committees
    from public.committees where is_active = true;

    select count(*) into v_active_accounts
    from public.profiles where role = 'COMMITTEE' and is_active = true;

    select count(*) into v_active_categories
    from public.categories where is_active = true;

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', al.id,
        'action', al.action,
        'message', al.description,
        'entityType', al.entity_type,
        'entityId', al.entity_id,
        'actor', jsonb_build_object('id', p.id, 'username', p.username),
        'committee', case when c.id is not null then jsonb_build_object('id', c.id, 'name', c.name) else null end,
        'createdAt', al.created_at
      ) order by al.created_at desc
    ), '[]'::jsonb) into v_recent_activity
    from (
      select * from public.audit_logs order by created_at desc limit 8
    ) al
    left join public.profiles p on p.id = al.user_id
    left join public.committees c on c.id = al.committee_id;

    return jsonb_build_object(
      'summary', jsonb_build_object(
        'totalInventoryItems', v_total_items,
        'totalInventoryQuantity', v_total_qty,
        'availableQuantity', v_avail_qty,
        'borrowedQuantity', v_borrowed_qty,
        'pendingRequests', v_pending_reqs,
        'approvedOrActiveBorrowings', v_active_borrowings,
        'overdueBorrowings', v_overdue_borrowings,
        'returnedToday', v_returned_today,
        'activeCommittees', v_active_committees,
        'activeCommitteeAccounts', v_active_accounts,
        'activeCategories', v_active_categories
      ),
      'recentActivity', v_recent_activity,
      'generatedAt', now()
    );
  else
    -- COMMITTEE role summary
    select
      count(*),
      coalesce(sum(available_quantity), 0)
    into v_total_items, v_avail_qty
    from public.items where is_active = true and available_quantity > 0;

    select count(*) into v_pending_reqs
    from public.borrowing_requests
    where committee_id = v_committee_id and status = 'PENDING';

    select count(*) into v_active_borrowings
    from public.borrowing_requests
    where committee_id = v_committee_id and status in ('APPROVED', 'BORROWED');

    select count(*) into v_overdue_borrowings
    from public.borrowing_requests
    where committee_id = v_committee_id and status in ('APPROVED', 'BORROWED')
      and expected_return_date < current_date;

    select count(*) into v_returned_today
    from public.borrowing_requests
    where committee_id = v_committee_id and status = 'RETURNED';

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', al.id,
        'action', al.action,
        'message', al.description,
        'entityType', al.entity_type,
        'entityId', al.entity_id,
        'actor', jsonb_build_object('id', p.id, 'username', p.username),
        'committee', case when c.id is not null then jsonb_build_object('id', c.id, 'name', c.name) else null end,
        'createdAt', al.created_at
      ) order by al.created_at desc
    ), '[]'::jsonb) into v_recent_activity
    from (
      select * from public.audit_logs
      where committee_id = v_committee_id
      order by created_at desc limit 8
    ) al
    left join public.profiles p on p.id = al.user_id
    left join public.committees c on c.id = al.committee_id;

    return jsonb_build_object(
      'summary', jsonb_build_object(
        'availableInventoryItems', v_total_items,
        'availableQuantity', v_avail_qty,
        'myPendingRequests', v_pending_reqs,
        'myApprovedOrActiveBorrowings', v_active_borrowings,
        'myOverdueBorrowings', v_overdue_borrowings,
        'myReturnedRequests', v_returned_today,
        'myTotalRequests', v_pending_reqs + v_active_borrowings + v_returned_today
      ),
      'recentActivity', v_recent_activity,
      'generatedAt', now()
    );
  end if;
-- Atomic RPC: Admin Create Committee Account
create or replace function public.admin_create_committee_account(
  p_username text,
  p_password text,
  p_committee_id uuid
)
returns jsonb language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_email text;
begin
  if not public.is_super_admin() then
    raise exception 'Unauthorized: Super Admin permissions required.';
  end if;

  if exists (select 1 from public.profiles where username = p_username) then
    raise exception 'Username is already taken.';
  end if;

  if exists (select 1 from public.profiles where committee_id = p_committee_id) then
    raise exception 'This committee already has an active account.';
  end if;

  v_user_id := gen_random_uuid();
  v_email := lower(p_username) || '@siteao.local';

  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
  ) values (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('username', p_username, 'role', 'COMMITTEE'),
    now(),
    now(),
    'authenticated',
    'authenticated'
  );

  insert into public.profiles (
    id, committee_id, username, role, is_active
  ) values (
    v_user_id, p_committee_id, p_username, 'COMMITTEE', true
  );

  perform public.log_audit_action(
    'CREATE_COMMITTEE_ACCOUNT',
    'profiles',
    v_user_id,
    'Created committee account ' || p_username,
    p_committee_id
  );

  return jsonb_build_object('id', v_user_id, 'username', p_username);
end;
$$;

-- Atomic RPC: Admin Reset Committee Password
create or replace function public.admin_reset_committee_password(
  p_user_id uuid,
  p_new_password text
)
returns jsonb language plpgsql security definer as $$
begin
  if not public.is_super_admin() then
    raise exception 'Unauthorized: Super Admin permissions required.';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  where id = p_user_id;

  perform public.log_audit_action(
    'RESET_PASSWORD',
    'profiles',
    p_user_id,
    'Reset password for committee account'
  );

  return jsonb_build_object('success', true);
end;
$$;

-- 6. Storage Buckets & Policies (Private attachments for inventory items / receipts)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inventory-attachments',
  'inventory-attachments',
  false,
  10485760, -- 10MB limit
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

create policy "Authenticated users can view attachments"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'inventory-attachments');

create policy "Super Admins can upload attachments"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'inventory-attachments' and public.is_super_admin());

create policy "Super Admins can update/delete attachments"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'inventory-attachments' and public.is_super_admin());
