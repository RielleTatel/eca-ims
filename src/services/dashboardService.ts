import { supabase } from '@/lib/supabase'

export interface RecentActivity {
  id: string
  action: string
  message: string
  entityType: string
  entityId: string | null
  actor: {
    id: string
    username: string
  } | null
  createdAt: string
}

export interface AdminDashboardSummary {
  totalInventoryItems: number
  totalInventoryQuantity: number
  availableQuantity: number
  borrowedQuantity: number
  activeBorrowings: number
  overdueBorrowings: number
  returnedToday: number
  damagedQuantity: number
}

export interface DashboardData {
  summary: AdminDashboardSummary
  recentActivity: RecentActivity[]
  generatedAt: string
}

export const dashboardService = {
  async getDashboard(_signal?: AbortSignal): Promise<DashboardData> {
    let query = supabase.rpc('get_dashboard_metrics')
    if (_signal) query = query.abortSignal(_signal)
    const { data, error } = await query

    if (error) {
      throw error
    }

    return data as unknown as DashboardData
  },
}
