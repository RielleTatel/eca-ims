import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { PageLoading } from '@/components/states/PageLoading'
import { useAuth } from '@/hooks/useAuth'

export function ProtectedRoute() {
  const { user, isAuthenticated, isInitializing } = useAuth()
  const location = useLocation()

  if (isInitializing) {
    return <PageLoading label="Restoring your ECA session" />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  return <Outlet />
}
