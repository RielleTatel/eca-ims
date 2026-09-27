-- Commit separately before using the new enum value.
alter type public.account_role add value if not exists 'STAFF';
