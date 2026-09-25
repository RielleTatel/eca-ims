import { supabase } from '@/lib/supabase'
import type { Committee } from '@/types/api'

export interface CommitteeInput {
  name: string
  description?: string | null
}

export const committeeService = {
  async list(_signal?: AbortSignal): Promise<Committee[]> {
    const { data, error } = await supabase
      .from('committees')
      .select('id, name, description, is_active, created_at, updated_at')
      .order('name', { ascending: true })

    if (error) {
      throw error
    }

    return (data || []).map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      isActive: c.is_active,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }))
  },

  async create(input: CommitteeInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('committees')
      .insert({
        name: input.name.trim(),
        description: input.description?.trim() || null,
      })
      .select('id, name, description, is_active, created_at, updated_at')
      .single()

    if (error) {
      throw error
    }

    if (user?.id) {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        committee_id: data.id,
        action: 'CREATE_COMMITTEE',
        entity_type: 'committees',
        entity_id: data.id,
        description: `Created committee ${data.name}`,
        new_values: data,
      })
    }

    const committee: Committee = {
      id: data.id,
      name: data.name,
      description: data.description,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }

    return {
      success: true,
      message: 'Committee created successfully.',
      data: { committee },
    }
  },

  async update(
    id: string,
    input: Partial<CommitteeInput> & { isActive?: boolean },
  ) {
    const payload: {
      name?: string
      description?: string | null
      is_active?: boolean
      updated_at?: string
    } = {
      updated_at: new Date().toISOString(),
    }

    if (input.name !== undefined) {
      payload.name = input.name.trim()
    }
    if (input.description !== undefined) {
      payload.description = input.description?.trim() || null
    }
    if (input.isActive !== undefined) {
      payload.is_active = input.isActive
    }

    const { data, error } = await supabase
      .from('committees')
      .update(payload)
      .eq('id', id)
      .select('id, name, description, is_active, created_at, updated_at')
      .single()

    if (error) {
      throw error
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user?.id) {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        committee_id: data.id,
        action: 'UPDATE_COMMITTEE',
        entity_type: 'committees',
        entity_id: data.id,
        description: `Updated committee ${data.name}`,
        new_values: data,
      })
    }

    const committee: Committee = {
      id: data.id,
      name: data.name,
      description: data.description,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }

    return {
      success: true,
      message: 'Committee updated successfully.',
      data: { committee },
    }
  },

  async deactivate(id: string) {
    const res = await this.update(id, { isActive: false })
    return {
      success: true,
      message: 'Committee deactivated successfully.',
      data: res.data,
    }
  },
}
