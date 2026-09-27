import type { AuthUser, LoginCredentials } from '@/context/auth-context'
import { accountAction } from '@/services/accountService'
import { supabase } from '@/lib/supabase'

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthUser> {
    const tokens = await accountAction<{ access_token: string; refresh_token: string }>({
      action: 'login', identifier: credentials.username.trim(), password: credentials.password,
    })
    const { error } = await supabase.auth.setSession(tokens)
    if (error) throw error

    const user = await this.getCurrentUser()
    if (!user) {
      await supabase.auth.signOut()
      throw new Error('Account profile not found or account is deactivated.')
    }

    return user
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      return null
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select(`
        id,
        username,
        role,
        is_active,
        must_change_password,
        password_operation
      `)
      .eq('id', authUser.id)
      .single()

    if (error || !profile || !profile.is_active || (profile.role !== 'SUPER_ADMIN' && profile.role !== 'STAFF')) {
      return null
    }

    return {
      id: profile.id,
      username: profile.username,
      role: profile.role,
      mustChangePassword: profile.must_change_password || Boolean(profile.password_operation),
    }
  },

  async refreshSession(): Promise<AuthUser | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return null
    }

    return this.getCurrentUser()
  },

  async logout(): Promise<void> {
    await supabase.auth.signOut()
  },
}
