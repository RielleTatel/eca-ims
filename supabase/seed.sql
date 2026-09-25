-- ==============================================================================
-- SITEAO OpsTracker (ECA-IMS) - Supabase Seed Data
-- Default System Settings, Committees, Categories
-- ==============================================================================

-- 1. System Settings
insert into public.system_settings (id, siteao_governor_name)
values ('siteao', 'HON. JHERMIE P. LICAROS')
on conflict (id) do update set
  siteao_governor_name = excluded.siteao_governor_name;

-- 2. Default Committees
insert into public.committees (id, name, description, is_active)
values
  ('11111111-1111-1111-1111-111111111101', 'Executive Committee', 'Student Organization Executive Leadership', true),
  ('11111111-1111-1111-1111-111111111102', 'Logistics Committee', 'Equipment handling, logistics and inventory management', true),
  ('11111111-1111-1111-1111-111111111103', 'Finance Committee', 'Budgeting and fiscal documentation', true),
  ('11111111-1111-1111-1111-111111111104', 'Documentation Committee', 'Media, photo, video, and documentation', true),
  ('11111111-1111-1111-1111-111111111105', 'Academics Committee', 'Academic events and student learning initiatives', true)
on conflict (name) do nothing;

-- 3. Default Categories
insert into public.categories (id, name, description, is_active)
values
  ('22222222-2222-2222-2222-222222222201', 'Audio & Visual', 'Projectors, speakers, microphones, and displays', true),
  ('22222222-2222-2222-2222-222222222202', 'Cables & Adapters', 'HDMI, VGA, extension cords, power strips', true),
  ('22222222-2222-2222-2222-222222222203', 'Computing & Network', 'Routers, switches, keyboards, mice, peripherals', true),
  ('22222222-2222-2222-2222-222222222204', 'Furniture & Fixtures', 'Tables, chairs, whiteboards, banners', true),
  ('22222222-2222-2222-2222-222222222205', 'Office Supplies', 'Pens, markers, staplers, clipboards', true)
on conflict (name) do nothing;
