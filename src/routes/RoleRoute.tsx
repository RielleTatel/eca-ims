import { Navigate, Outlet } from 'react-router-dom'

import type { UserRole } from '@/context/auth-context'
import { useAuth } from '@/hooks/useAuth'

interface RoleRouteProps {
  allowedRoles: UserRole[]
}

export function RoleRoute({ allowedRoles }: RoleRouteProps) {
  const { hasRole } = useAuth()

  if (!hasRole(...allowedRoles)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}
