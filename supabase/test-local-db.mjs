import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

async function runLocalE2ETest() {
  console.log('🧪 Starting Local Supabase PostgreSQL E2E Verification...\n')

  // 1. Initialize Client
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 2. Test Admin Login
  console.log('1️⃣ Testing Admin Authentication...')
  const { data: adminAuth, error: adminAuthErr } = await client.auth.signInWithPassword({
    email: 'admin@siteao.local',
    password: 'Password123!',
  })
  if (adminAuthErr) {
    throw new Error(`Admin login failed: ${adminAuthErr.message}`)
  }
  console.log('   ✅ Admin logged in successfully! User ID:', adminAuth.user.id)

  // 3. Query Profiles as Admin
  console.log('\n2️⃣ Querying Profiles Table...')
  const { data: profiles, error: profErr } = await client.from('profiles').select('id, username, role')
  if (profErr) {
    throw new Error(`Query profiles failed: ${profErr.message}`)
  }
  console.log(`   ✅ Retrieved ${profiles.length} profiles:`, profiles.map((p) => `${p.username} (${p.role})`).join(', '))

  // 4. Query Items Table
  console.log('\n3️⃣ Querying Items Table from local Postgres...')
  const { data: items, error: itemsErr } = await client
    .from('items')
    .select('id, item_code, item_name, available_quantity, total_quantity')
  if (itemsErr) {
    throw new Error(`Query items failed: ${itemsErr.message}`)
  }
  console.log(`   ✅ Retrieved ${items.length} items from local database:`)
  items.forEach((it) => console.log(`      - [${it.item_code}] ${it.item_name} (Qty: ${it.available_quantity}/${it.total_quantity})`))

  // 5. Test RPC `get_dashboard_metrics`
  console.log('\n4️⃣ Testing RPC: get_dashboard_metrics...')
  const { data: metrics, error: rpcErr } = await client.rpc('get_dashboard_metrics')
  if (rpcErr) {
    throw new Error(`get_dashboard_metrics RPC failed: ${rpcErr.message}`)
  }
  console.log('   ✅ Dashboard metrics returned successfully:', metrics)

  // 6. Test Committee Login & Borrowing
  console.log('\n5️⃣ Testing Committee Authentication & Request Submission...')
  const committeeClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: commAuth, error: commAuthErr } = await committeeClient.auth.signInWithPassword({
    email: 'logistics@siteao.local',
    password: 'Password123!',
  })
  if (commAuthErr) {
    throw new Error(`Committee login failed: ${commAuthErr.message}`)
  }
  console.log('   ✅ Logistics Committee logged in successfully!')

  const targetItem = items[0]
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  console.log(`   Submitting borrowing request for 1 unit of "${targetItem.item_name}"...`)
  const { data: requestResult, error: borrowErr } = await committeeClient.rpc('create_borrowing_request', {
    p_requester_name: 'Juan Dela Cruz',
    p_requester_position: 'Logistics Head',
    p_purpose: 'Local Postgres Verification Test',
    p_borrow_date: today,
    p_expected_return_date: tomorrow,
    p_additional_notes: 'Created via local automated verification',
    p_items: [{ itemId: targetItem.id, quantity: 1 }],
  })

  if (borrowErr) {
    throw new Error(`create_borrowing_request RPC failed: ${borrowErr.message}`)
  }
  const newRequestId = requestResult?.id
  console.log('   ✅ Borrowing request created! Request ID:', newRequestId)

  // 7. Approve as Admin
  console.log('\n6️⃣ Approving Request via Admin RPC...')
  const { error: approveErr } = await client.rpc('approve_borrowing_request', {
    p_request_id: newRequestId,
    p_remarks: 'Approved locally by automated test',
  })
  if (approveErr) {
    throw new Error(`approve_borrowing_request RPC failed: ${approveErr.message}`)
  }
  console.log('   ✅ Request approved!')

  // 8. Verify Inventory Decremented
  console.log('\n7️⃣ Verifying Inventory Balance in PostgreSQL...')
  const { data: updatedItem, error: checkErr } = await client
    .from('items')
    .select('item_code, available_quantity, total_quantity')
    .eq('id', targetItem.id)
    .single()
  if (checkErr) {
    throw new Error(`Failed to check updated item: ${checkErr.message}`)
  }
  console.log(`   ✅ Item "${updatedItem.item_code}" available quantity updated to: ${updatedItem.available_quantity} (Initial was ${targetItem.available_quantity})`)

  if (updatedItem.available_quantity !== targetItem.available_quantity - 1) {
    throw new Error('Stock balance did not decrement properly!')
  }

  // 9. Return Request to restore balance
  console.log('\n8️⃣ Testing Return Request RPC...')
  const { error: returnErr } = await client.rpc('return_borrowing_request', {
    p_request_id: newRequestId,
    p_condition: 'GOOD',
    p_notes: 'Returned during automated test',
  })
  if (returnErr) {
    throw new Error(`return_borrowing_request RPC failed: ${returnErr.message}`)
  }
  console.log('   ✅ Items returned and restocked!')

  const { data: restoredItem } = await client
    .from('items')
    .select('available_quantity')
    .eq('id', targetItem.id)
    .single()
  console.log(`   ✅ Item restored available quantity: ${restoredItem?.available_quantity}`)

  console.log('\n🎉 ALL LOCAL POSTGRESQL & SUPABASE TESTS PASSED 100% SUCCESSFULLY!')
}

runLocalE2ETest().catch((err) => {
  console.error('\n❌ Local Verification Failed:', err)
  process.exit(1)
})
