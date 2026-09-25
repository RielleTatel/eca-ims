import { Navigate } from 'react-router-dom'

import { PageLoading } from '@/components/states/PageLoading'
import { useAuth } from '@/hooks/useAuth'
import { getHomePath } from '@/lib/navigation'

export function RootRedirect() {
  const { user, isInitializing } = useAuth()

  if (isInitializing) {
    return <PageLoading label="Opening El Consejo Atenista" />
  }

  return <Navigate to={user ? getHomePath(user.role) : '/login'} replace />
}
