import axios from 'axios'
import { Landmark, Users, UserRoundCog } from 'lucide-react'
import { useEffect, useState } from 'react'

import { CommitteeAccountsPanel } from '@/components/committees/CommitteeAccountsPanel'
import { CommitteesPanel } from '@/components/committees/CommitteesPanel'
import { PageHeader } from '@/components/common/PageHeader'
import { OrganizationSettingsPanel } from '@/components/settings/OrganizationSettingsPanel'
import { cn } from '@/lib/utils'
import { getApiErrorMessage } from '@/services/api'
import { committeeService } from '@/services/committeeService'
import type { Committee } from '@/types/api'

type SettingsSection = 'general' | 'committees' | 'accounts'

const sections = [
  {
    id: 'general',
    label: 'General',
    description: 'Report signatory',
    icon: Landmark,
  },
  {
    id: 'committees',
    label: 'Committees',
    description: 'Organization groups',
    icon: Users,
  },
  {
    id: 'accounts',
    label: 'Accounts',
    description: 'Committee access',
    icon: UserRoundCog,
  },
] as const

export function SystemSettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general')
  const [committees, setCommittees] = useState<Committee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    committeeService
      .list(controller.signal)
      .then((result) => {
        setCommittees(result)
        setError(null)
      })
      .catch((requestError: unknown) => {
        if (!axios.isCancel(requestError)) {
          setError(getApiErrorMessage(requestError, 'Committees could not be loaded.'))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => controller.abort()
  }, [reloadKey])

  function refreshCommittees() {
    setIsLoading(true)
    setReloadKey((key) => key + 1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Manage report details, ECA committees, and committee accounts."
      />

      <div
        className="grid gap-2 rounded-xl bg-muted/60 p-1.5 sm:grid-cols-3"
        role="tablist"
        aria-label="System settings sections"
      >
        {sections.map((section) => {
          const Icon = section.icon
          const isActive = section.id === activeSection

          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`settings-panel-${section.id}`}
              id={`settings-tab-${section.id}`}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-left outline-none transition-all',
                'hover:bg-background/70 focus-visible:ring-3 focus-visible:ring-ring/50',
                isActive
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-foreground/10'
                  : 'text-muted-foreground',
              )}
            >
              <Icon
                className={cn('size-4 shrink-0', isActive && 'text-primary')}
                aria-hidden="true"
              />
              <span>
                <span className="block text-sm font-medium">{section.label}</span>
                <span className="hidden text-xs text-muted-foreground md:block">
                  {section.description}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <section
        id="settings-panel-general"
        role="tabpanel"
        aria-labelledby="settings-tab-general"
        hidden={activeSection !== 'general'}
      >
        <OrganizationSettingsPanel />
      </section>
      <section
        id="settings-panel-committees"
        role="tabpanel"
        aria-labelledby="settings-tab-committees"
        hidden={activeSection !== 'committees'}
      >
        <CommitteesPanel
          committees={committees}
          isLoading={isLoading}
          error={error}
          onRefresh={refreshCommittees}
        />
      </section>
      <section
        id="settings-panel-accounts"
        role="tabpanel"
        aria-labelledby="settings-tab-accounts"
        hidden={activeSection !== 'accounts'}
      >
        <CommitteeAccountsPanel committees={committees} />
      </section>
    </div>
  )
}
