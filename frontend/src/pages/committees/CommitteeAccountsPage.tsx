import axios from 'axios'
import { useEffect, useState } from 'react'

import { CommitteeAccountsPanel } from '@/components/committees/CommitteeAccountsPanel'
import { CommitteesPanel } from '@/components/committees/CommitteesPanel'
import { PageHeader } from '@/components/common/PageHeader'
import { getApiErrorMessage } from '@/services/api'
import { committeeService } from '@/services/committeeService'
import type { Committee } from '@/types/api'

export function CommitteeAccountsPage() {
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
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [reloadKey])

  function refreshCommittees() {
    setIsLoading(true)
    setReloadKey((key) => key + 1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Committees & Accounts"
        description="Manage ECA committees and their shared role-restricted accounts."
      />
      <CommitteesPanel
        committees={committees}
        isLoading={isLoading}
        error={error}
        onRefresh={refreshCommittees}
      />
      <CommitteeAccountsPanel committees={committees} />
    </div>
  )
}
