import axios from 'axios'
import { Eye, Search } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PageHeader } from '@/components/common/PageHeader'
import { AppSelect } from '@/components/common/AppSelect'
import { ActionTooltip } from '@/components/common/ActionTooltip'
import { PaginationControls } from '@/components/common/PaginationControls'
import {
  ServerDataTable,
  type ServerTableColumn,
} from '@/components/common/ServerDataTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { getApiErrorMessage } from '@/services/api'
import {
  systemRecordsService,
  type AuditLogListParams,
} from '@/services/systemRecordsService'
import type {
  AuditLogRecord,
  Pagination,
  SortOrder,
} from '@/types/api'

const PAGE_SIZE = 15
const emptyPagination: Pagination = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  totalPages: 0,
}

function readableLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split('_')
    .filter(Boolean)
    .map((part) => {
      const normalized = part.toLowerCase()
      return normalized.charAt(0).toUpperCase() + normalized.slice(1)
    })
    .join(' ')
}

function formatJson(value: unknown) {
  return value == null ? 'No recorded values' : JSON.stringify(value, null, 2)
}

function auditTone(action: string) {
  if (/(DEACTIVATED|REJECTED|LOGOUT|FAILED)/.test(action)) {
    return 'danger' as const
  }
  if (/(CREATED|ACTIVATED|APPROVED|RETURNED|LOGIN)/.test(action)) {
    return 'success' as const
  }
  if (/(UPDATED|QUANTITY)/.test(action)) {
    return 'progress' as const
  }
  return 'inactive' as const
}

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([])
  const [pagination, setPagination] = useState(emptyPagination)
  const [availableActions, setAvailableActions] = useState<string[]>([])
  const [availableEntityTypes, setAvailableEntityTypes] = useState<string[]>([])
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [action, setAction] = useState('')
  const [entityType, setEntityType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] =
    useState<AuditLogListParams['sortBy']>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [reloadKey, setReloadKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    systemRecordsService
      .auditLogs(
        {
          search: debouncedSearch || undefined,
          action: action || undefined,
          entityType: entityType || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          page,
          limit: PAGE_SIZE,
          sortBy,
          sortOrder,
        },
        controller.signal,
      )
      .then((result) => {
        setLogs(result.logs)
        setPagination(result.pagination)
        setAvailableActions(result.filters.actions)
        setAvailableEntityTypes(result.filters.entityTypes)
        setError(null)
      })
      .catch((requestError: unknown) => {
        if (!axios.isCancel(requestError)) {
          setError(
            getApiErrorMessage(
              requestError,
              'System audit logs could not be loaded.',
            ),
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => controller.abort()
  }, [
    action,
    dateFrom,
    dateTo,
    debouncedSearch,
    entityType,
    page,
    reloadKey,
    sortBy,
    sortOrder,
  ])

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value)
    setPage(1)
    setIsLoading(true)
  }

  const columns: ServerTableColumn<AuditLogRecord>[] = [
    {
      key: 'createdAt',
      label: 'Date and time',
      sortKey: 'createdAt',
      render: (log) => (
        <time dateTime={log.createdAt}>
          {new Date(log.createdAt).toLocaleString()}
        </time>
      ),
    },
    {
      key: 'actor',
      label: 'Actor',
      align: 'left',
      render: (log) => (
        <div>
          <p className="font-medium">{log.user?.username ?? 'System'}</p>
          {log.committee ? (
            <p className="text-xs text-muted-foreground">{log.committee.name}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      sortKey: 'action',
      render: (log) => (
        <StatusBadge label={readableLabel(log.action)} tone={auditTone(log.action)} />
      ),
    },
    {
      key: 'entity',
      label: 'Entity',
      sortKey: 'entityType',
      align: 'left',
      render: (log) => (
        <div>
          <p>{readableLabel(log.entityType)}</p>
          {log.entityId ? (
            <p className="max-w-32 truncate font-mono text-xs text-muted-foreground">
              {log.entityId}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Activity',
      align: 'left',
      render: (log) => (
        <p className="max-w-xl whitespace-normal">{log.description}</p>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'w-14',
      render: (log) => (
        <div className="inline-flex min-w-10 items-center justify-center">
          <ActionTooltip label={`View details for ${readableLabel(log.action)}`}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`View details for ${readableLabel(log.action)}`}
              onClick={() => setSelectedLog(log)}
            >
              <Eye aria-hidden="true" />
            </Button>
          </ActionTooltip>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Audit Logs"
        description="Review significant user actions and system events."
      />
      <Card className="gap-0 py-0">
        <CardContent className="grid gap-3 border-b p-4 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_repeat(4,minmax(9rem,auto))]">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => updateFilter(setSearch, event.target.value)}
              placeholder="Search activity, users, or IP…"
              aria-label="Search system audit logs"
              className="pl-9"
            />
          </div>
          <AppSelect
            value={action}
            onValueChange={(value) => updateFilter(setAction, value)}
            ariaLabel="Filter audit action"
            emptyLabel="All actions"
            options={availableActions.map((availableAction) => ({
              value: availableAction,
              label: readableLabel(availableAction),
            }))}
          />
          <AppSelect
            value={entityType}
            onValueChange={(value) => updateFilter(setEntityType, value)}
            ariaLabel="Filter entity type"
            emptyLabel="All entity types"
            options={availableEntityTypes.map((availableEntityType) => ({
              value: availableEntityType,
              label: readableLabel(availableEntityType),
            }))}
          />
          <Input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(event) => updateFilter(setDateFrom, event.target.value)}
            aria-label="Audit logs from date"
          />
          <Input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(event) => updateFilter(setDateTo, event.target.value)}
            aria-label="Audit logs to date"
          />
        </CardContent>
        <ServerDataTable
          rows={logs}
          columns={columns}
          getRowKey={(log) => log.id}
          isLoading={isLoading}
          error={error}
          emptyTitle="No audit logs found"
          emptyDescription="Try changing the current search or filters."
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={(nextSortBy, nextSortOrder) => {
            setSortBy(nextSortBy as AuditLogListParams['sortBy'])
            setSortOrder(nextSortOrder)
            setPage(1)
            setIsLoading(true)
          }}
          onRetry={() => {
            setIsLoading(true)
            setReloadKey((current) => current + 1)
          }}
          tableClassName="min-w-[64rem]"
        />
        {!error && !isLoading ? (
          <PaginationControls
            pagination={pagination}
            onPageChange={(nextPage) => {
              setPage(nextPage)
              setIsLoading(true)
            }}
          />
        ) : null}
      </Card>

      <Dialog
        open={Boolean(selectedLog)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedLog(null)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedLog ? readableLabel(selectedLog.action) : 'Audit log details'}
            </DialogTitle>
            <DialogDescription>
              Complete context recorded for this system event.
            </DialogDescription>
          </DialogHeader>
          {selectedLog ? (
            <div className="space-y-5 text-sm">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Date and time</dt>
                  <dd className="mt-1">
                    {new Date(selectedLog.createdAt).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Actor</dt>
                  <dd className="mt-1">{selectedLog.user?.username ?? 'System'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Entity</dt>
                  <dd className="mt-1">{readableLabel(selectedLog.entityType)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Entity ID</dt>
                  <dd className="mt-1 break-all font-mono text-xs">
                    {selectedLog.entityId ?? 'Not recorded'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Committee</dt>
                  <dd className="mt-1">
                    {selectedLog.committee?.name ?? 'Not associated'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">IP address</dt>
                  <dd className="mt-1 font-mono text-xs">
                    {selectedLog.ipAddress ?? 'Not recorded'}
                  </dd>
                </div>
              </dl>
              <div>
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="mt-1">{selectedLog.description}</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">Previous values</p>
                  <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
                    {formatJson(selectedLog.oldValues)}
                  </pre>
                </div>
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">New values</p>
                  <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
                    {formatJson(selectedLog.newValues)}
                  </pre>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
