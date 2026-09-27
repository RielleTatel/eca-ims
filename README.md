# ECA Inventory Management System

ECA-IMS tracks council inventory and equipment lent to individual students. Any student may borrow equipment in person. ECA administrators record checkouts and returns; students do not need an account or submit requests.

Built with React, TypeScript, Vite, and Supabase (PostgreSQL, Auth, and row-level security).

## Borrowing workflow

1. An administrator selects available equipment and quantities.
2. They enter the student's full name, student ID, optional contact information, purpose, checkout date, expected return date, and optional notes.
3. Recording the checkout immediately deducts available stock and creates an active borrowing record.
4. The administrator records returned quantities per item and condition. Partial returns leave the borrowing active.
5. When all units have been returned or accounted for as lost, the borrowing is completed.

Good/fair returns restore available stock. Damaged returns remain in total stock but are unavailable until an administrator records a repair from the item's details page. Lost units reduce total stock. Borrowings past their expected return date appear as overdue. Administrators can correct student details and extend the due date, with an audit trail.

There are no committee workspaces, student accounts, request submissions, or approval/rejection steps. Borrower information is visible only to active administrators.

## Local development

Requirements: Node.js compatible with Vite 8, Docker Desktop, and the Supabase CLI.

```bash
npm install
npx supabase start
npm run supabase:seed
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in a local `.env` file using your local Supabase connection details. See `.env.example`. Never expose a service-role key in the frontend.

The local setup script creates `admin@siteao.local` with the demo password `Password123!`. The login accepts `admin` or the full email. Existing inventory is preserved when the setup script is rerun. These credentials are for local development only.

## Upgrade existing installations

Apply **all pending migrations in order**, including `supabase/migrations/20260927000000_student_borrowing_tracking.sql`, before serving the updated frontend. For a running local stack use `npx supabase migration up`. For a linked hosted project use your normal migration deployment process, such as `npx supabase db push`. Do not reset an existing database to upgrade it.

The tracking migration preserves borrowing IDs and inventory transaction links. Existing approved/borrowed records become active loans without another stock deduction. Completed records remain completed; pending/rejected/cancelled requests become read-only archived history. Original request metadata is retained, and imported records visibly indicate missing student IDs rather than inventing them. Former accounts are disabled and retained solely as historical actors. Committee tables and old request RPCs are removed.

See [borrowing design and migration notes](docs/borrowing-tracking.md).

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm run test:db
npm run test:local
```

`test:db` requires PostgreSQL's `initdb`, `pg_ctl`, and `psql` on PATH (or `POSTGRES_BIN_DIR`). It creates a private temporary PostgreSQL instance, applies the real migrations to upgrade fixtures, tests authorization/atomicity/stock accounting/concurrent checkouts, then shuts down and removes its own temporary database. It does not connect to your application database. Only Supabase's auth and storage surfaces are stubbed.

`test:local` requires the running, migrated local Supabase stack and provisioned demo admin. It checks the actual Auth/PostgREST/RPC integration with a temporary inventory fixture and removes its test data afterward.

## Project layout

- `src/pages/borrowings`: borrowing list, checkout form, details, and returns.
- `src/services/borrowingService.ts`: typed queries and workflow RPC calls.
- `src/lib/database.types.ts`: schema types corresponding to the current migrations.
- `supabase/migrations`: ordered schema and permissions migrations.
- `supabase/tests`: migration and borrowing regression fixtures.

Deploy the frontend as a Vite static application (`npm run build`, output `dist`). Apply database migrations separately and configure the public Supabase URL/key for the intended environment.
