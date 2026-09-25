import { supabase } from '@/lib/supabase'
import type { CommitteeAccount } from '@/types/api'

export const committeeAccountService = {
  async list(_signal?: AbortSignal): Promise<CommitteeAccount[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        username,
        role,
        is_active,
        created_at,
        updated_at,
        committee:committees (
          id,
          name
        )
      `)
      .eq('role', 'COMMITTEE')
      .order('username', { ascending: true })

    if (error) {
      throw error
    }

    return (data || []).map((row) => ({
      id: row.id,
      username: row.username,
      role: 'COMMITTEE' as const,
      isActive: row.is_active,
      committee: row.committee as { id: string; name: string } | null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  },

  async create(input: { username: string; password: string; committeeId: string }) {
    const { data, error } = await supabase.rpc('admin_create_committee_account', {
      p_username: input.username.trim(),
      p_password: input.password,
      p_committee_id: input.committeeId,
    })

    if (error) {
      throw error
    }

    const created = data as { id: string; username: string }
    const { data: profile } = await supabase
      .from('profiles')
      .select(`
        id,
        username,
        role,
        is_active,
        created_at,
        updated_at,
        committee:committees (
          id,
          name
        )
      `)
      .eq('id', created.id)
      .single()

    const user: CommitteeAccount = {
      id: profile?.id ?? created.id,
      username: profile?.username ?? created.username,
      role: 'COMMITTEE' as const,
      isActive: profile?.is_active ?? true,
      committee: profile?.committee as { id: string; name: string } | null,
      createdAt: profile?.created_at ?? new Date().toISOString(),
      updatedAt: profile?.updated_at ?? new Date().toISOString(),
    }

    return {
      success: true,
      message: 'Committee account created successfully.',
      data: { user },
    }
  },

  async update(id: string, username: string) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        username: username.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        id,
        username,
        role,
        is_active,
        created_at,
        updated_at,
        committee:committees (
          id,
          name
        )
      `)
      .single()

    if (error) {
      throw error
    }

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()

    if (currentUser?.id) {
      await supabase.from('audit_logs').insert({
        user_id: currentUser.id,
        action: 'UPDATE_COMMITTEE_ACCOUNT',
        entity_type: 'profiles',
        entity_id: id,
        description: `Updated username to ${data.username}`,
        new_values: data,
      })
    }

    const user: CommitteeAccount = {
      id: data.id,
      username: data.username,
      role: 'COMMITTEE' as const,
      isActive: data.is_active,
      committee: data.committee as { id: string; name: string } | null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }

    return {
      success: true,
      message: 'Committee account updated successfully.',
      data: { user },
    }
  },

  async resetPassword(id: string, newPassword: string) {
    const { error } = await supabase.rpc('admin_reset_committee_password', {
      p_user_id: id,
      p_new_password: newPassword,
    })

    if (error) {
      throw error
    }

    return {
      success: true,
      message: 'Password has been successfully updated.',
    }
  },

  async updateStatus(id: string, isActive: boolean) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        id,
        username,
        role,
        is_active,
        created_at,
        updated_at,
        committee:committees (
          id,
          name
        )
      `)
      .single()

    if (error) {
      throw error
    }

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()

    if (currentUser?.id) {
      await supabase.from('audit_logs').insert({
        user_id: currentUser.id,
        action: isActive ? 'ACTIVATE_ACCOUNT' : 'DEACTIVATE_ACCOUNT',
        entity_type: 'profiles',
        entity_id: id,
        description: `${isActive ? 'Activated' : 'Deactivated'} committee account ${data.username}`,
        new_values: data,
      })
    }

    const user: CommitteeAccount = {
      id: data.id,
      username: data.username,
      role: 'COMMITTEE' as const,
      isActive: data.is_active,
      committee: data.committee as { id: string; name: string } | null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }

    return {
      success: true,
      message: `Committee account ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data: { user },
    }
  },
}
