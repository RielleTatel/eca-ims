import { LogOut, Menu } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AppSidebar } from '@/components/common/AppSidebar'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import type { AuthUser } from '@/context/auth-context'
import { useAuth } from '@/hooks/useAuth'
import type { NavigationItem } from '@/lib/navigation'
import { getInitials } from '@/utils/getInitials'

interface TopNavbarProps {
  navigation: NavigationItem[]
  user: AuthUser
}

export function TopNavbar({ navigation, user }: TopNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const { logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    if (isLoggingOut) {
      return
    }

    setIsLoggingOut(true)

    try {
      await logout()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:px-6">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button type="button" variant="outline" size="icon" className="md:hidden" aria-label="Open navigation">
            <Menu aria-hidden="true" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 border-0 p-0">
          <SheetTitle className="sr-only">ECA navigation</SheetTitle>
          <AppSidebar navigation={navigation} user={user} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">
          {user.role === 'SUPER_ADMIN' ? 'ECA Administration' : user.committee?.name}
        </p>
        <p className="hidden text-xs text-muted-foreground sm:block">Operations workspace</p>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" className="gap-2 px-2" aria-label="Open account menu">
              <Avatar className="size-8">
                <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-40 truncate text-sm font-medium lg:inline">{user.username}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <span className="block truncate">{user.username}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {user.committee?.name ?? 'Super Administrator'}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => void handleLogout()}
              disabled={isLoggingOut}
              className="text-destructive focus:text-destructive"
            >
              <LogOut aria-hidden="true" />
              {isLoggingOut ? 'Signing out…' : 'Sign out'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
