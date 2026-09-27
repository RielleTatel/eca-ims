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

Also apply `supabase/migrations/20260927010000_application_table_permissions.sql`. It explicitly grants the browser role the reads and admin configuration writes required by the application, while retaining row-level security and RPC-only borrowing/stock changes. Newer projects may not automatically grant table privileges; without this migration, pages fail with `42501: permission denied for table ...`. This permissions migration can be reapplied before later migrations; do not reapply it after the staff migration, which further restricts account writes and grants staff access. If earlier migrations were run manually in SQL Editor, reconcile their migration history before using CLI deployment so existing schema migrations are not rerun.

The tracking migration preserves borrowing IDs and inventory transaction links. Existing approved/borrowed records become active loans without another stock deduction. Completed records remain completed; pending/rejected/cancelled requests become read-only archived history. Original request metadata is retained, and imported records visibly indicate missing student IDs rather than inventing them. Former accounts are disabled and retained solely as historical actors. Committee tables and old request RPCs are removed.

See [borrowing design and migration notes](docs/borrowing-tracking.md).

For staff account management and permanent inventory deletion, apply `20260927020000_staff_role.sql` and then `20260927030000_staff_accounts_item_deletion.sql` in separate committed migrations. Deploy the account endpoint **before deploying this frontend**, because username/email login now uses it:

```bash
npx supabase functions deploy account-management --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

The endpoint validates JWTs itself for protected actions; only login is public. Supabase provides the function's server-side service key. No service key belongs in `.env` variables prefixed with `VITE_`. Staff accounts are created directly by a super admin with an initial password, with no invitation email. See [account and deletion specification](docs/admin-accounts-and-item-deletion.md) for authorization and rollout details.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm run test:db
npm run test:accounts
npm run test:local
```

`test:db` requires PostgreSQL's `initdb`, `pg_ctl`, and `psql` on PATH (or `POSTGRES_BIN_DIR`). It creates a private temporary PostgreSQL instance, applies the real migrations to upgrade fixtures, tests authorization/atomicity/stock accounting/concurrent checkouts, then shuts down and removes its own temporary database. It does not connect to your application database. Only Supabase's auth and storage surfaces are stubbed.

The default database test does not grant client table privileges implicitly. Run `TEST_LEGACY_DEFAULT_GRANTS=1 npm run test:db` to also verify projects with older, broad default grants; the permissions migration must produce the same restricted access in either environment.

`test:accounts` tests the account HTTP handler against a mocked external Supabase boundary, including authorization, credential validation and failure handling. It does not replace a deployed Auth integration smoke test.

`test:local` requires the running, migrated local Supabase stack and provisioned demo admin. It checks the actual Auth/PostgREST/RPC integration with a temporary inventory fixture and removes its test data afterward.

## Project layout

- `src/pages/borrowings`: borrowing list, checkout form, details, and returns.
- `src/services/borrowingService.ts`: typed queries and workflow RPC calls.
- `src/lib/database.types.ts`: schema types corresponding to the current migrations.
- `supabase/migrations`: ordered schema and permissions migrations.
- `supabase/tests`: migration and borrowing regression fixtures.

Deploy the frontend as a Vite static application (`npm run build`, output `dist`). Apply database migrations separately and configure the public Supabase URL/key for the intended environment.
