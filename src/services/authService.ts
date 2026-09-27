import type { AuthUser, LoginCredentials } from '@/context/auth-context'
import { supabase } from '@/lib/supabase'

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthUser> {
    const rawInput = credentials.username.trim()
    const email = rawInput.includes('@')
      ? rawInput.toLowerCase()
      : `${rawInput.toLowerCase()}@siteao.local`

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: credentials.password,
    })

    if (authError || !authData.user) {
      throw new Error(authError?.message || 'Invalid username or password.')
    }

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
        is_active
      `)
      .eq('id', authUser.id)
      .single()

    if (error || !profile || !profile.is_active || profile.role !== 'SUPER_ADMIN') {
      return null
    }

    return {
      id: profile.id,
      username: profile.username,
      role: profile.role,
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
