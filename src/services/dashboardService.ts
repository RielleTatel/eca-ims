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
  committee: {
    id: string
    name: string
  } | null
  createdAt: string
}

export interface AdminDashboardSummary {
  totalInventoryItems: number
  totalInventoryQuantity: number
  availableQuantity: number
  borrowedQuantity: number
  pendingRequests: number
  approvedOrActiveBorrowings: number
  overdueBorrowings: number
  returnedToday: number
  activeCommittees: number
  activeCommitteeAccounts: number
  activeCategories: number
}

export interface CommitteeDashboardSummary {
  availableInventoryItems: number
  availableQuantity: number
  myPendingRequests: number
  myApprovedOrActiveBorrowings: number
  myOverdueBorrowings: number
  myReturnedRequests: number
  myTotalRequests: number
}

export interface DashboardData {
  summary: AdminDashboardSummary | CommitteeDashboardSummary
  recentActivity: RecentActivity[]
  generatedAt: string
}

export const dashboardService = {
  async getDashboard(_signal?: AbortSignal): Promise<DashboardData> {
    const { data, error } = await supabase.rpc('get_dashboard_metrics')

    if (error) {
      throw error
    }

    return data as unknown as DashboardData
  },
}
