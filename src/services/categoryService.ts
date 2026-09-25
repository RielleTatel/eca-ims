import { supabase } from '@/lib/supabase'
import type { Category } from '@/types/api'

export interface CategoryInput {
  name: string
  description?: string | null
}

export const categoryService = {
  async list(isActive?: boolean, _signal?: AbortSignal): Promise<Category[]> {
    let query = supabase
      .from('categories')
      .select('id, name, description, is_active, created_at, updated_at')
      .order('name', { ascending: true })

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive)
    }

    const { data, error } = await query

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

  async create(input: CategoryInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        created_by: user?.id,
      })
      .select('id, name, description, is_active, created_at, updated_at')
      .single()

    if (error) {
      throw error
    }

    if (user?.id) {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'CREATE_CATEGORY',
        entity_type: 'categories',
        entity_id: data.id,
        description: `Created category ${data.name}`,
        new_values: data,
      })
    }

    const category: Category = {
      id: data.id,
      name: data.name,
      description: data.description,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }

    return {
      success: true,
      message: 'Category created successfully.',
      data: { category },
    }
  },

  async update(
    id: string,
    input: Partial<CategoryInput> & { isActive?: boolean },
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
      .from('categories')
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
        action: 'UPDATE_CATEGORY',
        entity_type: 'categories',
        entity_id: data.id,
        description: `Updated category ${data.name}`,
        new_values: data,
      })
    }

    const category: Category = {
      id: data.id,
      name: data.name,
      description: data.description,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }

    return {
      success: true,
      message: 'Category updated successfully.',
      data: { category },
    }
  },

  async deactivate(id: string) {
    const res = await this.update(id, { isActive: false })
    return {
      success: true,
      message: 'Category deactivated successfully.',
      data: res.data,
    }
  },
}
