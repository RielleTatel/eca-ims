import { execFile } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir, userInfo } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const directory = await mkdtemp(join(tmpdir(), 'eca-borrowing-db-'))
const command = (name) => process.env.POSTGRES_BIN_DIR ? join(process.env.POSTGRES_BIN_DIR, name) : name
const psqlArgs = ['-X', '-q', '-A', '-t', '-h', directory, '-p', '55439', '-U', userInfo().username, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']
const sql = (source) => exec(command('psql'), [...psqlArgs, '-c', source], { maxBuffer: 8 * 1024 * 1024 })
const file = (path) => exec(command('psql'), [...psqlArgs, '-f', path], { maxBuffer: 8 * 1024 * 1024 })
let started = false

try {
  await exec(command('initdb'), ['-D', join(directory, 'data'), '--auth=trust', '--no-locale'])
  await exec(command('pg_ctl'), ['-D', join(directory, 'data'), '-l', join(directory, 'postgres.log'), '-o', `-F -k ${directory} -h '' -p 55439`, '-w', 'start'])
  started = true
  // Only the Supabase-owned surfaces used by these migrations are stubbed.
  // All tables, constraints, RLS, locking, and workflow RPCs are real PostgreSQL.
  await sql(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage; create schema extensions;
    create extension pgcrypto with schema extensions;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth, public to anon, authenticated;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key, bucket_id text);
    alter table storage.objects enable row level security;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  `)
  const migrations = (await readdir('supabase/migrations')).filter((name) => name.endsWith('.sql')).sort()
  for (const [index, migration] of migrations.entries()) {
    await file(join('supabase/migrations', migration))
    if (index === 0) await file('supabase/tests/legacy-borrowing-fixture.sql')
  }
  await file('supabase/seed.sql')
  const result = await file('supabase/tests/borrowing-tracking.sql')
  for (const line of result.stdout.split('\n')) if (line.startsWith('PASS:')) console.log(line)

  // Two checkouts contend for the last unit. Only one may succeed.
  await sql(`insert into public.items (id, item_code, category_id, item_name, total_quantity, available_quantity, storage_location)
    values ('90000000-0000-0000-0000-000000000099', 'CONCURRENCY', '22222222-2222-2222-2222-222222222201', 'Last microphone', 1, 1, 'Test storage');`)
  const checkout = `select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
    set role authenticated;
    select public.record_borrowing('Concurrent Student', 'TEST-CONCURRENT', null, 'Concurrency verification',
      (now() at time zone 'Asia/Manila')::date, (now() at time zone 'Asia/Manila')::date, null,
      '[{"itemId":"90000000-0000-0000-0000-000000000099","quantity":1}]');`
  // Hold the item lock so both checkout sessions have to contend for it.
  const lockFile = join(directory, 'lock.sql')
  await writeFile(lockFile, `begin; select id from public.items where item_code = 'CONCURRENCY' for update; select pg_sleep(1); commit;`)
  const blocker = file(lockFile)
  await new Promise((resolve) => setTimeout(resolve, 150))
  const outcomes = await Promise.allSettled([sql(checkout), sql(checkout)])
  await blocker
  if (outcomes.filter((outcome) => outcome.status === 'fulfilled').length !== 1) throw new Error('Concurrent checkouts did not produce exactly one success.')
  const rejected = outcomes.find((outcome) => outcome.status === 'rejected')
  if (!rejected.reason.stderr.includes('Insufficient stock')) throw rejected.reason
  await sql(`do $$ begin
    if (select available_quantity from public.items where item_code = 'CONCURRENCY') <> 0
      or (select count(*) from public.borrowing_items where item_id = '90000000-0000-0000-0000-000000000099') <> 1
    then raise exception 'Concurrency left invalid inventory balances.'; end if;
  end $$;`)
  console.log('PASS: concurrent checkout of the last unit')
  console.log('All borrowing database checks passed in an isolated temporary database.')
} catch (error) {
  if (started) {
    const log = await readFile(join(directory, 'postgres.log'), 'utf8').catch(() => '')
    if (log) process.stderr.write(log.slice(-4000))
  }
  console.error(error.stderr ?? error.message)
  process.exitCode = 1
} finally {
  if (started) await exec(command('pg_ctl'), ['-D', join(directory, 'data'), '-m', 'immediate', '-w', 'stop'])
  await rm(directory, { recursive: true, force: true })
}
