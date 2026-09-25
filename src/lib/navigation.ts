import type { LucideIcon } from 'lucide-react'
import {
  Boxes,
  ClipboardClock,
  ClipboardList,
  FileBarChart,
  FolderTree,
  LayoutDashboard,
  NotebookTabs,
  PackagePlus,
  Settings,
  ShieldCheck,
} from 'lucide-react'

import type { UserRole } from '@/context/auth-context'

export interface NavigationItem {
  label: string
  to: string
  icon: LucideIcon
  section: 'Overview' | 'Operations' | 'Records' | 'Administration' | 'Borrowing'
  end?: boolean
}

export const navigationByRole: Record<UserRole, NavigationItem[]> = {
  SUPER_ADMIN: [
    {
      label: 'Dashboard',
      to: '/logistics/dashboard',
      icon: LayoutDashboard,
      section: 'Overview',
      end: true,
    },
    { label: 'Inventory', to: '/logistics/inventory', icon: Boxes, section: 'Operations' },
    {
      label: 'Borrowing Requests',
      to: '/logistics/requests',
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
    {
      label: 'System Settings',
      to: '/logistics/settings',
      icon: Settings,
      section: 'Administration',
    },
  ],
  COMMITTEE: [
    {
      label: 'Dashboard',
      to: '/committee/dashboard',
      icon: LayoutDashboard,
      section: 'Overview',
      end: true,
    },
    { label: 'Inventory', to: '/committee/inventory', icon: Boxes, section: 'Borrowing' },
    {
      label: 'New Request',
      to: '/committee/requests/new',
      icon: PackagePlus,
      section: 'Borrowing',
    },
    {
      label: 'My Requests',
      to: '/committee/requests/history',
      icon: ClipboardClock,
      section: 'Borrowing',
    },
  ],
}

export function getHomePath(role: UserRole) {
  return role === 'SUPER_ADMIN' ? '/logistics/dashboard' : '/committee/dashboard'
}
