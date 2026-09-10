import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { PageLoading } from '@/components/states/PageLoading'
import { useAuth } from '@/hooks/useAuth'

export function ProtectedRoute() {
  const { isAuthenticated, isInitializing } = useAuth()
  const location = useLocation()

  if (isInitializing) {
    return <PageLoading label="Restoring your ECA session" />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
