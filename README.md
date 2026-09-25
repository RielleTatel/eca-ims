# SITEAO OpsTracker (ECA-IMS)

SITEAO OpsTracker is an inventory and equipment borrowing management system designed for student organizations, built with **React**, **TypeScript**, **Vite**, and **Supabase** (PostgreSQL + PostgREST + Native Auth + Row Level Security).

---

## 🏗️ Architecture

The repository is structured as a **single-directory unified React + Supabase application**:

```text
eca-ims/
├── src/                          # React frontend application (Vite, TypeScript, Tailwind CSS, Radix UI)
│   ├── components/               # Reusable UI & domain-specific widgets
│   ├── context/                  # AuthContext with native Supabase Auth listener
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client (anon key only)
│   │   └── database.types.ts     # Auto-generated Supabase database TypeScript definitions
│   ├── services/                 # Supabase query & atomic RPC stored procedure wrappers
│   ├── pages/                    # React Router page components (Inventory, Requests, History, Settings)
│   └── types/                    # Domain models and API interfaces
├── supabase/
│   ├── config.toml               # Local Supabase CLI configuration
│   ├── migrations/               # Production SQL migrations (schema, tables, RLS policies, RPCs, triggers)
│   │   └── 20260925000000_init_ims.sql
│   ├── seed.sql                  # Default system settings, committees, and item categories
│   ├── setup-local-dev.mjs       # Automated local account & realistic item provisioner
│   └── test-local-db.mjs         # End-to-end automated verification script
├── .env                          # Active environment configuration (points to local Supabase by default)
├── .env.cloud                    # Pre-configured cloud Supabase credentials backup
├── index.html                    # Single-page application entry point
├── package.json
└── vite.config.ts
```

### Security & Architecture Principles
- **Direct Database RLS:** Authorization is strictly enforced at the database layer via PostgreSQL Row Level Security (`auth.uid()`, `is_super_admin()`, and committee memberships).
- **Zero Exposed Secrets:** Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are packaged into the frontend. Privileged operations execute via database-level `SECURITY DEFINER` procedures; the `service_role` key is never exposed to the client.
- **Atomic Multi-Step Workflows:** Transactions (request submission, stock reservation upon approval, condition inspection upon return) are executed inside ACID-compliant PostgreSQL functions (`create_borrowing_request`, `approve_borrowing_request`, `return_borrowing_request`).
- **Audit Trails:** Every state mutation produces immutable rows in `public.audit_logs` and `public.inventory_transactions`.
- **Client-Side Export:** Audit summaries, request acknowledgments, and inventory reports generate on-the-fly in the browser via `jspdf` and CSV formatters.

---

## 🚀 Quickstart: Local Development

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **Docker Desktop** (must be running for local Supabase)

### 2. Start the Local Supabase Stack
In the project root, start the local Supabase containers (PostgreSQL, PostgREST, Auth, Studio, Mailpit):

```bash
npx supabase start
```

This will automatically start all containers, apply the database migration (`supabase/migrations/20260925000000_init_ims.sql`), and load the base seed data (`supabase/seed.sql`).

### 3. Provision Local Test Accounts & Inventory
Run the automated provisioning script to create the Super Admin and all 5 Committee accounts, along with realistic inventory items across all categories:

```bash
node supabase/setup-local-dev.mjs
```

### 4. Start the React Frontend
Install dependencies (if not already done) and start the Vite development server:

```bash
npm install
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 🔑 Pre-Seeded Local Accounts

All accounts are created with the default password: **`Password123!`**

| Role | Username | Email / Login | Assigned Committee | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | `admin` | `admin@siteao.local` | *(System Administrator)* | Full administrative access, approve/reject requests, restock inventory, manage committee accounts & system settings |
| **Committee** | `executive` | `executive@siteao.local` | Executive Committee | View active items, submit borrowing requests, view request history |
| **Committee** | `logistics` | `logistics@siteao.local` | Logistics Committee | View active items, submit borrowing requests, view request history |
| **Committee** | `finance` | `finance@siteao.local` | Finance Committee | View active items, submit borrowing requests, view request history |
| **Committee** | `documentation` | `documentation@siteao.local` | Documentation Committee | View active items, submit borrowing requests, view request history |
| **Committee** | `academics` | `academics@siteao.local` | Academics Committee | View active items, submit borrowing requests, view request history |

> **Note:** The login form accepts either the short **Username** (e.g., `admin`, `logistics`) or the full **Email** (e.g., `admin@siteao.local`).

---

## 🌐 Local Service Ports & Endpoints

| Service | URL / Connection String | Purpose |
| :--- | :--- | :--- |
| **Web Application** | `http://localhost:5173` | React frontend application |
| **Supabase Studio** | `http://127.0.0.1:54323` | Web GUI for inspecting local Postgres tables, SQL queries, and Auth users |
| **API Gateway (Kong)** | `http://127.0.0.1:54321` | PostgREST API and GoTrue Auth endpoints |
| **PostgreSQL Database** | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` | Direct PostgreSQL connection for `psql` or GUI clients (DBeaver, TablePlus) |
| **Mailpit (Inbucket)** | `http://127.0.0.1:54324` | Local email inbox to inspect password reset or confirmation emails |

---

## 🧪 Automated Local E2E Verification

You can run the end-to-end integration test anytime to verify that database triggers, RPCs, stock decrementing, and auth policies are working properly:

```bash
node supabase/test-local-db.mjs
```

What the test verifies:
1. Super Admin authentication.
2. Direct profile and inventory queries via PostgREST.
3. Dashboard metric calculation RPC (`get_dashboard_metrics`).
4. Committee authentication & borrowing request submission (`create_borrowing_request`).
5. Request approval and automatic inventory quantity decrement (`approve_borrowing_request`).
6. Item return inspection and stock replenishment (`return_borrowing_request`).

---

## 🔄 Switching Between Local and Cloud Supabase

The application uses Vite environment variables in `.env`:

### Running on Local Supabase (Default)
In `.env`:
```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

### Running on Cloud Supabase
To connect to the remote Supabase project:
1. Copy the contents of `.env.cloud` into `.env` (or copy `.env.cloud` over `.env`).
2. Restart the Vite dev server (`npm run dev`).

---

## 🛠️ Common Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Vite development server on port 5173 |
| `npm run build` | Builds the production bundle into the `dist/` directory |
| `npm run typecheck` | Runs the TypeScript compiler check across the entire project |
| `npx supabase start` | Boots the local Supabase Docker containers |
| `npx supabase stop` | Stops the local Supabase Docker containers |
| `npx supabase status` | Displays URLs and API keys for the running local Supabase stack |
| `node supabase/setup-local-dev.mjs` | Provisions local demo accounts and seed inventory items |
| `node supabase/test-local-db.mjs` | Runs automated end-to-end verification against the local database |

---

## 📦 Production Deployment

Deploy the root directory to any static hosting provider (**Vercel**, **Cloudflare Pages**, or **Netlify**):
- **Framework Preset:** Vite
- **Root Directory:** `./`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment Variables:**
  - `VITE_SUPABASE_URL`: Your cloud Supabase project URL (`https://<project-ref>.supabase.co`)
  - `VITE_SUPABASE_ANON_KEY`: Your cloud Supabase project anonymous/publishable key
