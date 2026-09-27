import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export interface StaffAccount {
  id: string; username: string; email: string; isActive: boolean
  mustChangePassword: boolean; createdAt: string
}
export async function accountAction<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('account-management', { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const response = await error.context.json().catch(() => null)
      throw new Error(response?.error || 'Account request failed.')
    }
    throw new Error('Account service is unavailable. Please try again.')
  }
  return data as T
}
export const accountService = {
  async list(): Promise<StaffAccount[]> {
    const { data, error } = await supabase.rpc('list_staff_accounts')
    if (error) throw error
    return data as unknown as StaffAccount[]
  },
  create(username: string, email: string, password: string) {
    return accountAction({ action: 'create', username, email, password })
  },
  resetPassword(target: string, password: string) {
    return accountAction({ action: 'reset-password', target, password })
  },
  changePassword(currentPassword: string, password: string) {
    return accountAction({ action: 'change-password', currentPassword, password })
  },
  async setActive(target: string, active: boolean) {
    const { error } = await supabase.rpc('set_staff_active', { p_target: target, p_active: active })
    if (error) throw error
  },
}
