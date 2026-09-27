import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DEFAULT_PASSWORD = 'Password123!'

async function setupLocalUsers() {
  console.log('====================================================')
  console.log('  SITEAO OpsTracker - Local Account & Data Provisioner')
  console.log('====================================================\n')

  const { data: usersList, error: listErr } = await supabase.auth.admin.listUsers()
  if (listErr) {
    throw new Error(`Failed to list users: ${listErr.message}`)
  }

  // 1. Provision Super Admin Account
  console.log('👑 Provisioning Super Admin Account...')
  const adminEmail = 'admin@siteao.local'
  let adminUser = usersList?.users?.find((u) => u.email === adminEmail)

  if (!adminUser) {
    const { data: newAdmin, error: adminErr } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { role: 'SUPER_ADMIN', username: 'admin' },
    })
    if (adminErr) {
      throw new Error(`Error creating admin user: ${adminErr.message}`)
    }
    adminUser = newAdmin.user
    console.log(`   ✅ Created Admin user: admin (${adminEmail})`)
  } else {
    // Reset password to guarantee it works
    await supabase.auth.admin.updateUserById(adminUser.id, {
      password: DEFAULT_PASSWORD,
      email_confirm: true,
    })
    console.log(`   ✅ Admin user exists: admin (${adminEmail}) [password verified]`)
  }

  // Upsert Super Admin Profile
  const { error: adminProfErr } = await supabase.from('profiles').upsert({
    id: adminUser.id,
    username: 'admin',
    role: 'SUPER_ADMIN',
    is_active: true,
  })
  if (adminProfErr) {
    throw new Error(`Failed to upsert admin profile: ${adminProfErr.message}`)
  }
  console.log('   ✅ Super Admin profile synchronized.\n')

  // 4. Provision Realistic Inventory Items
  console.log('\n📦 Checking Inventory Items...')
  const { data: categories } = await supabase.from('categories').select('id, name')
  const getCatId = (namePart) =>
    categories?.find((c) => c.name.toLowerCase().includes(namePart.toLowerCase()))?.id ||
    categories?.[0]?.id

  const avId = getCatId('audio')
  const cableId = getCatId('cables')
  const netId = getCatId('computing')
  const furnId = getCatId('furniture')
  const officeId = getCatId('office')

  const sampleItems = [
    // Audio & Visual
    {
      item_code: 'AV-PRJ-001',
      item_name: 'Epson EB-X06 Projector',
      category_id: avId,
      total_quantity: 4,
      available_quantity: 4,
      condition: 'GOOD',
      storage_location: 'Logistics Cabinet A1',
      description: '3600 lumens XGA 3LCD projector with HDMI input',
      created_by: adminUser.id,
      is_active: true,
    },
    {
      item_code: 'AV-MIC-001',
      item_name: 'Sony Wireless Microphone Set (Pair)',
      category_id: avId,
      total_quantity: 6,
      available_quantity: 6,
      condition: 'GOOD',
      storage_location: 'Logistics Cabinet A2',
      description: 'Dual channel UHF handheld wireless microphones with receiver',
      created_by: adminUser.id,
      is_active: true,
    },
    {
      item_code: 'AV-SPK-001',
      item_name: 'Portable PA Speaker 300W with Bluetooth',
      category_id: avId,
      total_quantity: 3,
      available_quantity: 3,
      condition: 'GOOD',
      storage_location: 'Logistics Floor Bay 1',
      description: 'Rechargeable active PA speaker for student hall events',
      created_by: adminUser.id,
      is_active: true,
    },
    // Cables & Adapters
    {
      item_code: 'CBL-HDM-001',
      item_name: 'HDMI High-Speed Cable (10m)',
      category_id: cableId,
      total_quantity: 12,
      available_quantity: 12,
      condition: 'GOOD',
      storage_location: 'Bin C3',
      description: 'Gold-plated 4K 60Hz HDMI display cable',
      created_by: adminUser.id,
      is_active: true,
    },
    {
      item_code: 'CBL-EXT-001',
      item_name: 'Heavy-Duty Extension Cord (15m)',
      category_id: cableId,
      total_quantity: 8,
      available_quantity: 8,
      condition: 'GOOD',
      storage_location: 'Bin C4',
      description: '3-prong grounded heavy-duty 220V extension wheel',
      created_by: adminUser.id,
      is_active: true,
    },
    {
      item_code: 'CBL-HUB-001',
      item_name: 'USB-C Multiport Adapter 7-in-1',
      category_id: cableId,
      total_quantity: 5,
      available_quantity: 5,
      condition: 'GOOD',
      storage_location: 'Bin C1',
      description: 'HDMI 4K, USB 3.0, SD card reader, 100W PD passthrough',
      created_by: adminUser.id,
      is_active: true,
    },
    // Computing & Network
    {
      item_code: 'NET-RTR-001',
      item_name: 'TP-Link Gigabit Wi-Fi 6 Router',
      category_id: netId,
      total_quantity: 3,
      available_quantity: 3,
      condition: 'GOOD',
      storage_location: 'Cabinet B2',
      description: 'AX1800 Dual-Band Gigabit Wi-Fi 6 Router for events',
      created_by: adminUser.id,
      is_active: true,
    },
    {
      item_code: 'NET-CLK-001',
      item_name: 'Logitech Wireless Presentation Remote / Clicker',
      category_id: netId,
      total_quantity: 5,
      available_quantity: 5,
      condition: 'GOOD',
      storage_location: 'Cabinet B1',
      description: 'Red laser pointer with 15m wireless range and timer display',
      created_by: adminUser.id,
      is_active: true,
    },
    // Furniture & Fixtures
    {
      item_code: 'FUR-TBL-001',
      item_name: 'Foldable Seminar Table (6ft)',
      category_id: furnId,
      total_quantity: 10,
      available_quantity: 10,
      condition: 'GOOD',
      storage_location: 'Storage Room Rack A',
      description: 'Heavy-duty HDPE plastic top foldable utility table',
      created_by: adminUser.id,
      is_active: true,
    },
    {
      item_code: 'FUR-BNR-001',
      item_name: 'SITEAO Retractable Roll-Up Banner Stand',
      category_id: furnId,
      total_quantity: 4,
      available_quantity: 4,
      condition: 'GOOD',
      storage_location: 'Storage Room Corner B',
      description: 'Aluminum pull-up banner frame with carrying case',
      created_by: adminUser.id,
      is_active: true,
    },
    // Office Supplies
    {
      item_code: 'OFF-STP-001',
      item_name: 'Heavy-Duty Plier Stapler & Staples',
      category_id: officeId,
      total_quantity: 6,
      available_quantity: 6,
      condition: 'GOOD',
      storage_location: 'Admin Desk Drawer 2',
      description: 'Metal construction stapler handles up to 100 sheets',
      created_by: adminUser.id,
      is_active: true,
    },
  ]

  for (const item of sampleItems) {
    const { error: itemErr } = await supabase
      .from('items')
      .upsert(item, { onConflict: 'item_code', ignoreDuplicates: true })

    if (itemErr) {
      console.error(`   ❌ Failed to upsert ${item.item_code}:`, itemErr.message)
    }
  }

  const { count } = await supabase.from('items').select('*', { count: 'exact', head: true })
  console.log(`   ✅ Inventory populated: ${count} total items registered.\n`)

  console.log('====================================================')
  console.log('  PROVISIONING COMPLETE! You can now log in:')
  console.log('====================================================')
  console.log('Administrator: admin@siteao.local / Password123!')
  console.log('====================================================\n')
}

setupLocalUsers().catch((err) => {
  console.error('Fatal setup error:', err)
  process.exit(1)
})
