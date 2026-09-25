# SITEAO OpsTracker (ECA-IMS)

SITEAO OpsTracker is an inventory and borrowing management system for student organizations, built with **React** and **Supabase**.

## Architecture

The project is structured as a **single-directory unified React + Supabase application**:

```text
eca-ims/
├── src/                          # React application (Vite, TypeScript, Tailwind CSS, Radix UI)
│   ├── components/               # UI and domain components
│   ├── context/                  # AuthContext with native Supabase Auth listener
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client (anon key only)
│   │   └── database.types.ts     # Supabase TypeScript schema definitions
│   ├── services/                 # Supabase query and atomic RPC wrappers
│   ├── pages/                    # React Router pages
│   └── types/                    # Domain data types
├── supabase/
│   ├── migrations/               # SQL schema, RLS policies, RPC stored procedures, triggers
│   │   └── 20260925000000_init_ims.sql
│   └── seed.sql                  # Seed data for system settings, committees, categories
├── index.html
├── package.json
└── vite.config.ts
```

## Security & Architecture Highlights

- **Row Level Security (RLS):** Enabled on every database table. Authorization is enforced strictly by PostgreSQL policies (`auth.uid()`, `is_super_admin()`, and `committee_id`).
- **Secret Isolation:** Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are used on the frontend. Privileged database actions are performed via `SECURITY DEFINER` functions; the `service_role` key is never exposed to the client.
- **Atomic Multi-Step Operations:** Critical inventory workflows (request creation, stock allocation upon approval, condition adjustment upon return) are executed inside atomic PostgreSQL stored procedures (`create_borrowing_request`, `approve_borrowing_request`, `return_borrowing_request`).
- **Server-Side Constraints:** Stock integrity is guaranteed via database check constraints (`check (available_quantity <= total_quantity)`), foreign keys, and unique indexes.
- **Tamper-Resistant Auditing:** All modifications produce immutable records in `public.audit_logs` and `public.inventory_transactions`.
- **Client-Side PDF & CSV Export:** Reports are generated directly in the browser via `jspdf` and CSV encoders, removing the need for a heavy server-side headless browser.

## Getting Started

### 1. Configure Supabase

1. Create a project in [Supabase](https://supabase.com).
2. Open the **SQL Editor** in the Supabase Dashboard.
3. Run [`supabase/migrations/20260925000000_init_ims.sql`](file:///Users/tatelgabrielle/Desktop/PROJECTS/eca-ims/supabase/migrations/20260925000000_init_ims.sql) to create the schema, tables, RLS policies, and RPCs.
4. Run [`supabase/seed.sql`](file:///Users/tatelgabrielle/Desktop/PROJECTS/eca-ims/supabase/seed.sql) to seed default system settings, committees, and categories.
5. Create your initial Super Admin user in **Authentication > Users** (e.g. email `admin@siteao.local`), then in the SQL Editor insert a matching profile:
   ```sql
   insert into public.profiles (id, username, role, is_active)
   values ('<USER_AUTH_UUID>', 'admin', 'SUPER_ADMIN', true);
   ```

### 2. Environment Variables

Create `.env` in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-publishable-key
```

### 3. Install & Run Locally

```bash
npm install
npm run dev
```

### 4. Build & Typecheck

```bash
npm run typecheck
npm run build
```

## Deployment

Deploy the root directory to **Vercel** or **Cloudflare Pages**:
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment Variables:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
