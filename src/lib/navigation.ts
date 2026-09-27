import type { LucideIcon } from 'lucide-react'
import {
  Boxes,
  ClipboardList,
  FileBarChart,
  FolderTree,
  LayoutDashboard,
  NotebookTabs,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react'

import type { UserRole } from '@/context/auth-context'

export interface NavigationItem {
  label: string
  to: string
  icon: LucideIcon
  section: 'Overview' | 'Operations' | 'Records' | 'Administration' | 'Borrowing'
  end?: boolean
}

const operations: NavigationItem[] = [
    {
      label: 'Dashboard',
      to: '/logistics/dashboard',
      icon: LayoutDashboard,
      section: 'Overview',
      end: true,
    },
    { label: 'Inventory', to: '/logistics/inventory', icon: Boxes, section: 'Operations' },
    {
      label: 'Borrowings',
      to: '/logistics/borrowings',
      icon: ClipboardList,
      section: 'Operations',
    },
    { label: 'Categories', to: '/logistics/categories', icon: FolderTree, section: 'Operations' },
    {
      label: 'Transactions',
      to: '/logistics/transactions',
      icon: NotebookTabs,
      section: 'Records',
    },
    { label: 'Reports', to: '/logistics/reports', icon: FileBarChart, section: 'Records' },
    { label: 'Audit Logs', to: '/logistics/audit-logs', icon: ShieldCheck, section: 'Records' },
]

export const navigationByRole: Record<UserRole, NavigationItem[]> = {
  STAFF: operations,
  SUPER_ADMIN: [...operations,
    { label: 'Staff Accounts', to: '/logistics/accounts', icon: Users, section: 'Administration' },
    { label: 'System Settings', to: '/logistics/settings', icon: Settings, section: 'Administration' },
  ],
}

export function getHomePath() {
  return '/logistics/dashboard'
}
