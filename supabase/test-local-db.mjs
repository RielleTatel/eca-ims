import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

// Local-only Supabase demo credentials, shared with the development provisioner.
const setup = await readFile(new URL('./setup-local-dev.mjs', import.meta.url), 'utf8')
const serviceKey = setup.match(/const SERVICE_KEY =\s*'([^']+)'/)?.[1]
if (!serviceKey) throw new Error('Local development service key was not found.')
const url = 'http://127.0.0.1:54321'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, anonKey, options)
const anonymous = createClient(url, anonKey, options)
const fixtures = createClient(url, serviceKey, options)
const itemId = randomUUID()
let borrowingId
let itemCreated = false

function checked(result) {
  if (result.error) throw result.error
  return result.data
}

async function run() {
  const auth = checked(await admin.auth.signInWithPassword({ email: 'admin@siteao.local', password: 'Password123!' }))
  const category = checked(await admin.from('categories').select('id').eq('is_active', true).limit(1).single())
  checked(await fixtures.from('items').insert({ id: itemId, item_code: `TEST-${itemId}`, item_name: 'Automated borrowing fixture', category_id: category.id, total_quantity: 5, available_quantity: 5, storage_location: 'Automated test', created_by: auth.user.id }))
  itemCreated = true
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const borrowing = checked(await admin.rpc('record_borrowing', {
    p_borrower_name: 'Automated Test Student', p_student_id: 'TEST-STUDENT', p_contact_details: null,
    p_purpose: 'Borrowing integration verification', p_borrow_date: today, p_expected_return_date: today,
    p_additional_notes: 'Temporary test record', p_items: [{ itemId, quantity: 3 }],
  }))
  borrowingId = borrowing.id
  assert.equal(checked(await admin.from('items').select('available_quantity').eq('id', itemId).single()).available_quantity, 2)
  assert.equal((await anonymous.from('borrowings').select('id').eq('id', borrowingId)).error?.code, '42501')
  assert.ok((await admin.from('borrowings').update({ status: 'RETURNED' }).eq('id', borrowingId)).error)
  const line = checked(await admin.from('borrowing_items').select('id').eq('borrowing_id', borrowingId).single())
  checked(await admin.rpc('record_borrowing_return', { p_borrowing_id: borrowingId, p_returns: [
    { borrowingItemId: line.id, quantity: 1, condition: 'GOOD' },
    { borrowingItemId: line.id, quantity: 1, condition: 'DAMAGED', notes: 'Test damage' },
  ] }))
  assert.equal(checked(await admin.from('borrowings').select('status').eq('id', borrowingId).single()).status, 'ACTIVE')
  checked(await admin.rpc('record_borrowing_return', { p_borrowing_id: borrowingId, p_returns: [{ borrowingItemId: line.id, quantity: 1, condition: 'LOST' }] }))
  const details = checked(await admin.from('borrowings').select(`
    status, recorder:profiles!borrowings_recorded_by_fkey(username),
    items:borrowing_items(id, item:items(item_name, category:categories(name)), returns:borrowing_returns(quantity, condition, recorder:profiles!borrowing_returns_recorded_by_fkey(username)))
  `).eq('id', borrowingId).single())
  assert.equal(details.status, 'RETURNED')
  assert.equal(details.items[0].returns.length, 3)
  const stock = checked(await admin.from('items').select('total_quantity, available_quantity, damaged_quantity').eq('id', itemId).single())
  assert.deepEqual(stock, { total_quantity: 4, available_quantity: 3, damaged_quantity: 1 })
  checked(await admin.rpc('repair_inventory_units', { p_item_id: itemId, p_quantity: 1 }))
  assert.equal(checked(await admin.from('items').select('available_quantity').eq('id', itemId).single()).available_quantity, 4)
  assert.ok(checked(await admin.rpc('get_dashboard_metrics')).summary)
  console.log('PASS: Supabase admin authentication, checkout, private records, direct-write protection, mixed/partial returns, stock balances, repair, embedded history, and dashboard.')
}

async function cleanup() {
  if (borrowingId) {
    const lines = checked(await fixtures.from('borrowing_items').select('id').eq('borrowing_id', borrowingId))
    if (lines.length) checked(await fixtures.from('borrowing_returns').delete().in('borrowing_item_id', lines.map((line) => line.id)))
    checked(await fixtures.from('inventory_transactions').delete().eq('borrowing_id', borrowingId))
    checked(await fixtures.from('audit_logs').delete().eq('entity_id', borrowingId))
    checked(await fixtures.from('borrowing_items').delete().eq('borrowing_id', borrowingId))
    checked(await fixtures.from('borrowings').delete().eq('id', borrowingId))
  }
  if (itemCreated) {
    checked(await fixtures.from('inventory_transactions').delete().eq('item_id', itemId))
    checked(await fixtures.from('audit_logs').delete().eq('entity_id', itemId))
    checked(await fixtures.from('items').delete().eq('id', itemId))
  }
}

try { await run() }
catch (error) { console.error('Local Supabase verification failed:', error.message); process.exitCode = 1 }
finally { await cleanup().catch((error) => { console.error('Temporary test fixture cleanup failed:', error.message); process.exitCode = 1 }) }
