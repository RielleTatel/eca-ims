import { NavLink } from 'react-router-dom'

import ecaLogo from '@/assets/eca-logo.png'
import { Badge } from '@/components/ui/badge'
import type { AuthUser } from '@/context/auth-context'
import type { NavigationItem } from '@/lib/navigation'
import { cn } from '@/lib/utils'

interface AppSidebarProps {
  navigation: NavigationItem[]
  user: AuthUser
  className?: string
  onNavigate?: () => void
}

export function AppSidebar({ navigation, user, className, onNavigate }: AppSidebarProps) {
  const workspace = user.role === 'SUPER_ADMIN' ? 'Administration' : 'Committee'
  const navigationGroups = navigation.reduce<
    Array<{ label: NavigationItem['section']; items: NavigationItem[] }>
  >((groups, item) => {
    const currentGroup = groups.at(-1)

    if (currentGroup?.label === item.section) {
      currentGroup.items.push(item)
    } else {
      groups.push({ label: item.section, items: [item] })
    }

    return groups
  }, [])

  return (
    <aside
      className={cn(
        'flex h-full w-64 flex-col border-r border-sidebar-foreground/10 bg-sidebar text-sidebar-foreground',
        className,
      )}
    >
      <div className="h-1 brand-gradient-secondary" aria-hidden="true" />
      <div className="flex h-16 items-center gap-3 px-5">
        <img
          src={ecaLogo}
          alt="El Consejo Atenista seal"
          className="size-10 shrink-0 object-contain drop-shadow-sm"
        />
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-semibold tracking-tight">
            El Consejo Atenista
          </p>
          <p className="truncate text-xs text-sidebar-foreground/55">Inventory System</p>
        </div>
      </div>
      <div className="h-px bg-sidebar-foreground/10" />
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav aria-label={`${workspace} navigation`} className="space-y-5">
          {navigationGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-foreground/5 hover:text-sidebar-foreground',
                        isActive &&
                          'bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-brand-gold',
                      )
                    }
                  >
                    <item.icon className="size-4" aria-hidden="true" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>
      <div className="mt-auto border-t border-sidebar-foreground/10 p-4">
        <p className="truncate text-sm font-semibold">{user.username}</p>
        <p className="mt-0.5 truncate text-xs text-sidebar-foreground/55">
          {user.committee?.name ?? 'El Consejo Atenista'}
        </p>
        <Badge
          variant="secondary"
          className="mt-2 border border-brand-gold/25 bg-brand-gold/10 text-brand-gold"
        >
          {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Committee'}
        </Badge>
      </div>
    </aside>
  )
}
