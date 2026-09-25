import { Navigate, Outlet } from 'react-router-dom'

import { PageLoading } from '@/components/states/PageLoading'
import { useAuth } from '@/hooks/useAuth'
import { getHomePath } from '@/lib/navigation'

export function PublicOnlyRoute() {
  const { user, isInitializing } = useAuth()

  if (isInitializing) {
    return <PageLoading label="Checking your session" />
  }

  if (user) {
    return <Navigate to={getHomePath(user.role)} replace />
  }

  return <Outlet />
}
