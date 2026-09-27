import { createClient } from '@supabase/supabase-js'

interface Configuration { url: string; anonKey: string; serviceKey: string }
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
class RequestError extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.status = status }
}
function field(body: Record<string, unknown>, name: string, max = 200) {
  const value = body[name]
  if (typeof value !== 'string' || !value || value.length > max) throw new RequestError(`Invalid ${name}.`)
  return value
}
function password(body: Record<string, unknown>) {
  const value = field(body, 'password', 72)
  if (value.length < 12 || new TextEncoder().encode(value).length > 72 || !/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value)) {
    throw new RequestError('Use 12–72 bytes with uppercase, lowercase letters and a number.')
  }
  return value
}
export function createAccountHandler(config: Configuration) {
  return async (request: Request): Promise<Response> => {
    const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
    if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405)
    try {
      const raw = await request.text()
      if (raw.length > 4096) throw new RequestError('Request is too large.', 413)
      let body: Record<string, unknown>
      try { body = JSON.parse(raw) } catch { throw new RequestError('Invalid JSON.') }
      if (!body || Array.isArray(body) || typeof body !== 'object') throw new RequestError('Invalid request.')
      const action = field(body, 'action', 30)
      const admin = createClient(config.url, config.serviceKey, options)
      const anonymous = () => createClient(config.url, config.anonKey, options)
      if (action === 'login') {
        const identifier = field(body, 'identifier').trim().toLowerCase()
        const credential = field(body, 'password', 1024)
        const { data: email, error } = await admin.rpc('resolve_account_login', { p_identifier: identifier })
        if (error) throw new RequestError('Sign-in is temporarily unavailable.', 503)
        if (email === '__RATE_LIMITED__') throw new RequestError('Too many sign-in attempts. Try again in 15 minutes.', 429)
        // Unknown and inactive accounts produce the same response as a bad password.
        const { data, error: loginError } = await anonymous().auth.signInWithPassword({ email: email || 'invalid-account@example.invalid', password: credential })
        if (!email || loginError || !data.session) throw new RequestError('Invalid username/email or password.', 401)
        return respond({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
      }
      const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
      if (!token) throw new RequestError('Sign in to continue.', 401)
      const { data: identity, error: identityError } = await admin.auth.getUser(token)
      if (identityError || !identity.user) throw new RequestError('Sign in to continue.', 401)
      const actor = identity.user
      const { data: profile, error: profileError } = await admin.from('profiles').select('role,is_active,must_change_password,password_operation').eq('id', actor.id).single()
      if (profileError || !profile?.is_active || !['SUPER_ADMIN', 'STAFF'].includes(profile.role)) throw new RequestError('Account is unavailable.', 403)
      const selfChange = action === 'change-password'
      if (!selfChange && (profile.role !== 'SUPER_ADMIN' || profile.must_change_password || profile.password_operation)) throw new RequestError('Super-admin access required.', 403)
      if (action === 'create') {
        const username = field(body, 'username', 50).trim().toLowerCase()
        const email = field(body, 'email').trim().toLowerCase()
        const initialPassword = password(body)
        if (!/^[a-z0-9][a-z0-9_.-]{2,49}$/.test(username)) throw new RequestError('Username must be 3–50 letters, numbers, dots, hyphens or underscores.')
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RequestError('Enter a valid email address.')
        const { data: existing } = await admin.from('profiles').select('id').ilike('username', username).maybeSingle()
        if (existing) throw new RequestError('Username is already in use.')
        const { data, error } = await admin.auth.admin.createUser({ email, password: initialPassword, email_confirm: true })
        if (error || !data.user) throw new RequestError(error?.message || 'Account could not be created.')
        const { error: provisionError } = await admin.rpc('provision_staff', { p_actor: actor.id, p_id: data.user.id, p_username: username })
        if (provisionError) {
          // Only remove the brand-new Auth identity created by this request.
          const { error: cleanupError } = await admin.auth.admin.deleteUser(data.user.id)
          if (cleanupError) throw new RequestError('Account setup failed. An administrator must check the incomplete Auth account before retrying.', 500)
          throw new RequestError('Account setup failed. Check that the username is unique and try again.')
        }
        return respond({ id: data.user.id }, 201)
      }
      if (action === 'reset-password' || selfChange) {
        const nextPassword = password(body)
        const target = selfChange ? actor.id : field(body, 'target', 36)
        if (!/^[0-9a-f-]{36}$/i.test(target)) throw new RequestError('Invalid account ID.')
        const currentPassword = selfChange ? field(body, 'currentPassword', 1024) : null
        if (currentPassword === nextPassword) throw new RequestError('Choose a different password.')
        // Verify before acquiring the lease so incorrect input cannot lock an account.
        if (selfChange) {
          const verifier = anonymous()
          const { error } = await verifier.auth.signInWithPassword({ email: actor.email!, password: currentPassword! })
          await verifier.auth.signOut({ scope: 'local' })
          if (error) throw new RequestError('Current password is incorrect.')
        }
        const { data: operation, error: beginError } = await admin.rpc('begin_password_change', { p_actor: actor.id, p_target: target, p_reset: !selfChange })
        if (beginError) throw new RequestError(beginError.message)
        // Recheck after locking: a concurrent reset may have changed the password.
        if (selfChange) {
          const verifier = anonymous()
          const { error } = await verifier.auth.signInWithPassword({ email: actor.email!, password: currentPassword! })
          await verifier.auth.signOut({ scope: 'local' })
          if (error) throw new RequestError('Password changed during this request. Retry in five minutes.')
        }
        const { error: updateError } = await admin.auth.admin.updateUserById(target, { password: nextPassword })
        if (updateError) throw new RequestError('Password update failed. Retry in five minutes; access remains restricted.')
        const { error: finishError } = await admin.rpc('finish_password_change', { p_actor: actor.id, p_target: target, p_token: operation, p_reset: !selfChange })
        if (finishError) throw new RequestError('Password updated, but access remains restricted. Retry with the new password in five minutes.', 503)
        return respond({ success: true })
      }
      throw new RequestError('Unknown action.')
    } catch (error) {
      return respond({ error: error instanceof RequestError ? error.message : 'Account service is temporarily unavailable. If a password update was in progress, retry in five minutes.' }, error instanceof RequestError ? error.status : 503)
    }
  }
}
