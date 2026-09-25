import { Outlet } from 'react-router-dom'

import { AppSidebar } from '@/components/common/AppSidebar'
import { TopNavbar } from '@/components/common/TopNavbar'
import { useAuth } from '@/hooks/useAuth'
import { navigationByRole } from '@/lib/navigation'

export function WorkspaceLayout() {
  const { user } = useAuth()

  if (!user) {
    return null
  }

  const navigation = navigationByRole[user.role]

  return (
    <div className="min-h-screen bg-muted/30">
      <AppSidebar navigation={navigation} user={user} className="fixed inset-y-0 left-0 z-40 hidden md:flex" />
      <div className="md:pl-64">
        <TopNavbar navigation={navigation} user={user} />
        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
