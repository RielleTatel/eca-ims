import { supabase } from '@/lib/supabase'
import type { SystemSettings } from '@/types/api'

export interface SystemSettingsInput {
  siteaoGovernorName: string
}

export const systemSettingsService = {
  async get(_signal?: AbortSignal): Promise<SystemSettings> {
    const { data, error } = await supabase
      .from('system_settings')
      .select(`
        id,
        siteao_governor_name,
        updated_at,
        updater:profiles (
          id,
          username
        )
      `)
      .eq('id', 'siteao')
      .single()

    if (error || !data) {
      return {
        id: 'siteao',
        siteaoGovernorName: 'HON. JHERMIE P. LICAROS',
        updatedAt: null,
        updater: null,
      }
    }

    const updater = data.updater as unknown as { id: string; username: string } | null

    return {
      id: data.id,
      siteaoGovernorName: data.siteao_governor_name,
      updatedAt: data.updated_at,
      updater,
    }
  },

  async update(input: SystemSettingsInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('system_settings')
      .upsert({
        id: 'siteao',
        siteao_governor_name: input.siteaoGovernorName.trim(),
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      })
      .select(`
        id,
        siteao_governor_name,
        updated_at,
        updater:profiles (
          id,
          username
        )
      `)
      .single()

    if (error) {
      throw error
    }

    if (user?.id) {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'UPDATE_SYSTEM_SETTINGS',
        entity_type: 'system_settings',
        entity_id: null,
        description: `Updated Governor signature name to ${data.siteao_governor_name}`,
        new_values: data,
      })
    }

    const updater = data.updater as unknown as { id: string; username: string } | null
    const settings: SystemSettings = {
      id: data.id,
      siteaoGovernorName: data.siteao_governor_name,
      updatedAt: data.updated_at,
      updater,
    }

    return {
      success: true,
      message: 'System settings updated successfully.',
      data: { settings },
    }
  },
}
