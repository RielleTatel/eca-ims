import axios from 'axios'
import {
  Boxes,
  ClipboardClock,
  ClipboardList,
  PackageCheck,
  PackageOpen,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { SectionCard } from '@/components/common/SectionCard'
import {
  DashboardOverview,
  type DashboardMetric,
} from '@/components/dashboard/DashboardOverview'
import { FullPageError } from '@/components/states/FullPageError'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { getApiErrorMessage } from '@/services/api'
import {
  dashboardService,
  type AdminDashboardSummary,
  type CommitteeDashboardSummary,
  type DashboardData,
} from '@/services/dashboardService'

function getAdminMetrics(summary?: AdminDashboardSummary): DashboardMetric[] {
  return [
    {
      label: 'Inventory Items',
      icon: Boxes,
      value: summary?.totalInventoryItems ?? 0,
      detail: `${summary?.availableQuantity ?? 0} units available`,
      href: '/logistics/inventory',
    },
    {
      label: 'Pending Requests',
      icon: ClipboardList,
      value: summary?.pendingRequests ?? 0,
      detail: 'Awaiting administrator review',
      href: '/logistics/requests',
    },
    {
      label: 'Active Borrowings',
      icon: PackageCheck,
      value: summary?.approvedOrActiveBorrowings ?? 0,
      detail: `${summary?.overdueBorrowings ?? 0} currently overdue`,
      href: '/logistics/transactions',
    },
    {
      label: 'Committee Accounts',
      icon: Users,
      value: summary?.activeCommitteeAccounts ?? 0,
      detail: `${summary?.activeCommittees ?? 0} active committees`,
      href: '/logistics/settings',
    },
  ]
}

function getCommitteeMetrics(summary?: CommitteeDashboardSummary): DashboardMetric[] {
  return [
    {
      label: 'Available Items',
      icon: Boxes,
      value: summary?.availableInventoryItems ?? 0,
      detail: `${summary?.availableQuantity ?? 0} units available`,
      href: '/committee/inventory',
    },
    {
      label: 'Pending Requests',
      icon: ClipboardClock,
      value: summary?.myPendingRequests ?? 0,
      detail: 'Waiting for review',
      href: '/committee/requests/history',
    },
    {
      label: 'Active Borrowings',
      icon: PackageOpen,
      value: summary?.myApprovedOrActiveBorrowings ?? 0,
      detail: `${summary?.myOverdueBorrowings ?? 0} currently overdue`,
      href: '/committee/requests/history',
    },
    {
      label: 'Returned Requests',
      icon: PackageCheck,
      value: summary?.myReturnedRequests ?? 0,
      detail: `${summary?.myTotalRequests ?? 0} total requests`,
      href: '/committee/requests/history',
    },
  ]
}

export function DashboardPage() {
  const { user } = useAuth()
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    dashboardService
      .getDashboard(controller.signal)
      .then(setDashboard)
      .catch((dashboardError: unknown) => {
        if (!axios.isCancel(dashboardError)) {
          setError(getApiErrorMessage(dashboardError, 'Dashboard data could not be loaded.'))
        }
      })

    return () => controller.abort()
  }, [reloadKey])

  if (!user) {
    return null
  }

  const isAdmin = user.role === 'SUPER_ADMIN'
  const summary = dashboard?.summary
  const metrics = isAdmin
    ? getAdminMetrics(summary as AdminDashboardSummary | undefined)
    : getCommitteeMetrics(summary as CommitteeDashboardSummary | undefined)

  function retryDashboard() {
    setError(null)
    setDashboard(null)
    setReloadKey((key) => key + 1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAdmin ? 'Logistics Dashboard' : 'Committee Dashboard'}
        description={
          isAdmin
            ? 'A live overview of ECA inventory, borrowing activity, and committee access.'
            : `A live overview of ${user.committee?.name ?? 'your committee'} requests and borrowed items.`
        }
      />
      {error ? (
        <FullPageError
          title="Dashboard unavailable"
          message={error}
          onRetry={retryDashboard}
        />
      ) : (
        <>
          <DashboardOverview metrics={metrics} isLoading={!dashboard} />
          <SectionCard
            title="Recent activity"
            description={
              dashboard
                ? `Updated ${new Date(dashboard.generatedAt).toLocaleString()}`
                : 'Loading activity from El Consejo Atenista'
            }
          >
            {!dashboard ? (
              <div className="space-y-3" role="status" aria-label="Loading recent activity">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            ) : dashboard.recentActivity.length === 0 ? (
              <EmptyState
                title="No recent activity"
                description="New ECA inventory and borrowing activity will appear here."
              />
            ) : (
              <ol className="divide-y divide-border">
                {dashboard.recentActivity.map((activity) => (
                  <li key={activity.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{activity.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {activity.actor?.username ?? 'System'} ·{' '}
                        {new Date(activity.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>
        </>
      )}
    </div>
  )
}
