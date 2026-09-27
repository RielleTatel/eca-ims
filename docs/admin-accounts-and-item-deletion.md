# Staff accounts and permanent item deletion

Approved on 2026-09-27. This local document is the implementation specification; no GitHub tickets are used.

## Behavior

- SUPER_ADMIN creates STAFF accounts with username, email, and an initial password. No email invitation is sent.
- Both roles sign in using username or email. New and reset staff accounts must change their password before accessing operations.
- Only super admins list/manage staff accounts, reset passwords, deactivate/reactivate accounts, or change organization settings. Historical actors are retained.
- Staff can manage inventory, categories and borrowing, and view transactions, reports and operational audit logs.
- Both roles can permanently delete an inventory item after confirmation, only if it has never had borrowing history. Active, completed and archived borrowing history all prevent deletion.
- Deletion atomically removes the item and its stock transactions and retains a deletion audit record. Deactivation remains available.

## Verification boundaries

Database RPCs and authenticated table access cover authorization, password gates, account lifecycle, audit visibility and deletion integrity. The account HTTP endpoint covers credential handling and server authorization. Typechecking and production build cover frontend integration.

## Progress

- [x] Database authorization and deletion
- [x] Protected account endpoint and password lifecycle
- [x] Accounts, password and inventory UI
- [ ] Verification and Standards/Spec review
- [ ] Commit to the current branch

## Deployment

Apply migrations in timestamp order. The STAFF enum migration must commit before the following migration. Deploy the `account-management` Edge Function with JWT verification disabled at the gateway: the public login action and protected actions perform their own authorization. Never put a service-role key in Vite environment variables. See the final verification notes below for deployment status.


## Verification and rollout status

- Typechecking (including the account handler), ESLint, and production build passed. Vite reports the existing large-bundle warning.
- Full database regressions passed with both closed client grants and legacy broad defaults. The database tests use real PostgreSQL RLS, constraints and RPCs, with minimal Auth/storage fixtures.
- All 14 account HTTP tests passed against a mocked external Supabase API. A local Supabase stack is not running, so actual Auth/Edge deployment smoke testing remains a rollout step.
- These new staff migrations and Edge Function have **not** been applied to the hosted project. The earlier application-table permissions fix was applied separately.
- Apply `20260927020000_staff_role.sql` and commit it, then apply `20260927030000_staff_accounts_item_deletion.sql`. If `20260927010000_application_table_permissions.sql` is still pending in another environment, apply it first. Do not rerun the original schema or borrowing migration against an existing installation.
- Deploy `account-management` using the command in README before deploying the frontend. For local development run `npx supabase functions serve account-management --no-verify-jwt` alongside Vite if the local function is not being served.
- Smoke test with a temporary staff account: create, username/email login, mandatory password change, inventory access, reset, deactivate/reactivate, and denial of account management. Delete test inventory only if it has no borrowing history.

Password updates use a database lease to prevent concurrent resets/changes. During a failed or ambiguous Auth update, access remains restricted; retry after five minutes. Passwords are never written to application tables or audit logs. Login is limited to ten attempts per normalized identifier per fifteen minutes (successful attempts also count).

Function packaging follows [Supabase's per-function deno.json guidance](https://supabase.com/changelog/30291-use-deno-json-configuration-file-in-edge-functions). Public login and protected account actions share a gateway; protected actions validate the supplied token with Auth and check the database profile.
