import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAccountHandler } from '../functions/account-management/handler.ts'

const actorId = '00000000-0000-0000-0000-000000000001'
const targetId = '00000000-0000-0000-0000-000000000002'
const strongPassword = 'Test-only-password42'
const handler = createAccountHandler({ url: 'https://auth.example.test', anonKey: 'test-anon', serviceKey: 'test-service' })
const profile = { role: 'SUPER_ADMIN', is_active: true, must_change_password: false, password_operation: null }
// Mock the external Supabase HTTP boundary, not internal account-service helpers.
function boundary(t, overrides = {}) {
  const writes = []
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url)
    const path = url.pathname
    const method = init?.method || 'GET'
    const body = init?.body ? JSON.parse(init.body) : undefined
    if (method !== 'GET') writes.push({ path, body, method })
    const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
    if (path === '/auth/v1/user') return response({ id: actorId, email: 'admin@example.test' })
    if (path === '/rest/v1/profiles') return response(url.searchParams.get('select') === 'id' ? null : { ...profile, ...overrides.profile })
    if (path === '/rest/v1/rpc/resolve_account_login') return response(overrides.email === undefined ? 'staff@example.test' : overrides.email)
    if (path === '/auth/v1/token') return overrides.badPassword ? response({ msg: 'Invalid login credentials' }, 400) : response({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, token_type: 'bearer', user: { id: actorId } })
    if (path === '/auth/v1/logout') return response({})
    if (path === '/auth/v1/admin/users' && method === 'POST') return response({ id: targetId })
    if (path === `/auth/v1/admin/users/${targetId}` && method === 'DELETE') return response({})
    if (path === '/rest/v1/rpc/provision_staff') return overrides.provisionFail ? response({ message: 'Duplicate username' }, 400) : response(null)
    if (path === '/rest/v1/rpc/begin_password_change') return overrides.leaseFail ? response({ message: 'Account not available.' }, 400) : response('00000000-0000-0000-0000-000000000099')
    if (path.startsWith('/auth/v1/admin/users/') && method === 'PUT') return overrides.updateFail ? response({ msg: 'Failed' }, 500) : response({ id: targetId })
    if (path === '/rest/v1/rpc/finish_password_change') return response(null)
    throw new Error(`Unexpected external request ${method} ${path}`)
  })
  return writes
}
async function invoke(body, authenticated = true) {
  return handler(new Request('https://function.example.test', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: 'Bearer user-token' } : {}) }, body: JSON.stringify(body) }))
}

test('account creation requires an authenticated caller', async () => {
  const response = await invoke({ action: 'create' }, false)
  assert.equal(response.status, 401)
})
for (const denied of [{ role: 'STAFF' }, { is_active: false }, { must_change_password: true }, { password_operation: 'in-progress' }]) {
  test(`account administration rejects ${JSON.stringify(denied)}`, async (t) => {
    const writes = boundary(t, { profile: denied })
    const response = await invoke({ action: 'create', username: 'new.staff', email: 'new@example.test', password: strongPassword })
    assert.equal(response.status, 403)
    assert.deepEqual(writes, [])
  })
}
test('super admin directly creates a confirmed account without sending an invitation', async (t) => {
  const writes = boundary(t)
  const response = await invoke({ action: 'create', username: 'New.Staff', email: 'NEW@example.test', password: strongPassword, role: 'SUPER_ADMIN' })
  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), { id: targetId })
  assert.deepEqual(writes.find((write) => write.path === '/auth/v1/admin/users').body, { email: 'new@example.test', password: strongPassword, email_confirm: true })
  assert.deepEqual(writes.find((write) => write.path.endsWith('/provision_staff')).body, { p_actor: actorId, p_id: targetId, p_username: 'new.staff' })
  assert.equal(writes.some((write) => write.path.includes('invite')), false)
})
test('failed profile provisioning compensates only the new Auth identity', async (t) => {
  const writes = boundary(t, { provisionFail: true })
  assert.equal((await invoke({ action: 'create', username: 'new.staff', email: 'new@example.test', password: strongPassword })).status, 400)
  assert.deepEqual(writes.filter((write) => write.method === 'DELETE').map((write) => write.path), [`/auth/v1/admin/users/${targetId}`])
})
test('username login returns session tokens without exposing resolved email', async (t) => {
  boundary(t)
  const response = await invoke({ action: 'login', identifier: 'STAFF', password: strongPassword }, false)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { access_token: 'access', refresh_token: 'refresh' })
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
})
test('unknown users receive the same generic login failure', async (t) => {
  boundary(t, { email: null })
  const response = await invoke({ action: 'login', identifier: 'unknown', password: strongPassword }, false)
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: 'Invalid username/email or password.' })
})
test('rate limiting stops requests before password verification', async (t) => {
  const writes = boundary(t, { email: '__RATE_LIMITED__' })
  assert.equal((await invoke({ action: 'login', identifier: 'staff', password: strongPassword }, false)).status, 429)
  assert.equal(writes.some((write) => write.path === '/auth/v1/token'), false)
})
test('mandatory password change remains available to staff but requires the current password', async (t) => {
  const writes = boundary(t, { profile: { role: 'STAFF', must_change_password: true }, badPassword: true })
  const response = await invoke({ action: 'change-password', currentPassword: 'wrong-password', password: strongPassword })
  assert.equal(response.status, 400)
  assert.equal(writes.some((write) => write.path.includes('begin_password_change') || write.method === 'PUT'), false)
})
test('successful first password change clears the gate only after Auth changes the password', async (t) => {
  const writes = boundary(t, { profile: { role: 'STAFF', must_change_password: true } })
  assert.equal((await invoke({ action: 'change-password', currentPassword: 'Old-password42', password: strongPassword })).status, 200)
  const update = writes.findIndex((write) => write.method === 'PUT')
  const finish = writes.findIndex((write) => write.path.endsWith('/finish_password_change'))
  assert.ok(update >= 0 && finish > update)
  assert.equal(writes[finish].body.p_reset, false)
  assert.equal(writes[finish].body.p_target, actorId)
})
test('failed Auth reset does not clear the password gate', async (t) => {
  const writes = boundary(t, { updateFail: true })
  assert.equal((await invoke({ action: 'reset-password', target: targetId, password: strongPassword })).status, 400)
  assert.equal(writes.some((write) => write.path.endsWith('/finish_password_change')), false)
})
test('database rejection prevents resetting protected accounts', async (t) => {
  const writes = boundary(t, { leaseFail: true })
  assert.equal((await invoke({ action: 'reset-password', target: actorId, password: strongPassword })).status, 400)
  assert.equal(writes.some((write) => write.method === 'PUT'), false)
})
