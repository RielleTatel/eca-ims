import axios from 'axios'
import { Eye, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/common/PageHeader'
import { ActionTooltip } from '@/components/common/ActionTooltip'
import { AppSelect } from '@/components/common/AppSelect'
import { FilterSummary, type ActiveFilter } from '@/components/common/FilterSummary'
import { PaginationControls } from '@/components/common/PaginationControls'
import { ServerDataTable, type ServerTableColumn } from '@/components/common/ServerDataTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { getApiErrorMessage } from '@/services/api'
import { committeeService } from '@/services/committeeService'
import { requestService, type RequestListParams } from '@/services/requestService'
import type {
  BorrowingRequestSummary,
  Committee,
  Pagination,
  RequestStatus,
  SortOrder,
} from '@/types/api'
import { formatEnumLabel } from '@/utils/formatEnumLabel'

const statuses: RequestStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'BORROWED',
  'RETURNED',
]

const emptyPagination: Pagination = { page: 1, limit: 10, total: 0, totalPages: 0 }

function requestTone(status: RequestStatus) {
  if (status === 'REJECTED' || status === 'CANCELLED') return 'danger' as const
  if (status === 'RETURNED') return 'success' as const
  if (status === 'PENDING') return 'pending' as const
  return 'progress' as const
}

export function RequestsPage() {
  const { user } = useAuth()
  const isCommittee = user?.role === 'COMMITTEE'
  const [requests, setRequests] = useState<BorrowingRequestSummary[]>([])
  const [committees, setCommittees] = useState<Committee[]>([])
  const [pagination, setPagination] = useState(emptyPagination)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [status, setStatus] = useState('')
  const [committeeId, setCommitteeId] = useState('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<RequestListParams['sortBy']>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const requestPromise = requestService.list(
      {
        search: debouncedSearch || undefined,
        status: (status || undefined) as RequestStatus | undefined,
        committeeId: !isCommittee && committeeId ? committeeId : undefined,
        page,
        limit: 10,
        sortBy,
        sortOrder,
      },
      isCommittee,
      controller.signal,
    )
    const committeePromise = isCommittee
      ? Promise.resolve<Committee[]>([])
      : committeeService.list(controller.signal)

    Promise.all([requestPromise, committeePromise])
      .then(([requestResult, committeeResult]) => {
        setRequests(requestResult.requests)
        setPagination(requestResult.pagination)
        setCommittees(committeeResult)
        setError(null)
      })
      .catch((requestError: unknown) => {
        if (!axios.isCancel(requestError)) {
          setError(getApiErrorMessage(requestError, 'Borrowing requests could not be loaded.'))
        }
      })
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [committeeId, debouncedSearch, isCommittee, page, sortBy, sortOrder, status])

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value)
    setPage(1)
    setIsLoading(true)
  }

  function clearFilters() {
    setSearch('')
    setStatus('')
    setCommitteeId('')
    setPage(1)
    setIsLoading(true)
  }

  const activeFilters: ActiveFilter[] = [
    ...(search.trim()
      ? [{
          key: 'search',
          label: `Search: ${search.trim()}`,
          onRemove: () => updateFilter(setSearch, ''),
        }]
      : []),
    ...(status
      ? [{
          key: 'status',
          label: `Status: ${formatEnumLabel(status)}`,
          onRemove: () => updateFilter(setStatus, ''),
        }]
      : []),
    ...(!isCommittee && committeeId
      ? [{
          key: 'committee',
          label: `Committee: ${committees.find((committee) => committee.id === committeeId)?.name ?? 'Selected'}`,
          onRemove: () => updateFilter(setCommitteeId, ''),
        }]
      : []),
  ]

  const basePath = isCommittee ? '/committee' : '/logistics'
  const columns: ServerTableColumn<BorrowingRequestSummary>[] = [
    {
      key: 'request',
      label: 'Request',
      render: (request) => (
        <div>
          <p className="font-medium">{request.requestCode}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(request.createdAt).toLocaleDateString()}
          </p>
        </div>
      ),
    },
    {
      key: 'requester',
      label: isCommittee ? 'Requester' : 'Committee / Requester',
      align: 'left',
      render: (request) => (
        <div>
          {!isCommittee ? <p className="font-medium">{request.committee.name}</p> : null}
          <p className="text-xs text-muted-foreground">{request.requesterName}</p>
        </div>
      ),
    },
    {
      key: 'period',
      label: 'Borrow period',
      sortKey: 'borrowDate',
      render: (request) =>
        `${new Date(request.borrowDate).toLocaleDateString()} – ${new Date(request.expectedReturnDate).toLocaleDateString()}`,
    },
    {
      key: 'items',
      label: 'Items',
      render: (request) =>
        request.totalRequestedQuantity
          ? `${request.itemCount} (${request.totalRequestedQuantity} units)`
          : request.itemCount,
    },
    {
      key: 'status',
      label: 'Status',
      sortKey: 'status',
      render: (request) => (
        <StatusBadge
          label={formatEnumLabel(request.status)}
          tone={requestTone(request.status)}
        />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'w-14',
      render: (request) => (
        <div className="inline-flex min-w-10 items-center justify-center">
          <ActionTooltip label={`View request ${request.requestCode}`}>
            <Button asChild type="button" variant="ghost" size="icon-sm">
              <Link
                to={`${basePath}/requests/${request.id}`}
                aria-label={`View request ${request.requestCode}`}
              >
                <Eye aria-hidden="true" />
              </Link>
            </Button>
          </ActionTooltip>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={isCommittee ? 'My Requests' : 'Borrowing Requests'}
        description={
          isCommittee
            ? 'Track borrowing requests submitted by your committee.'
            : 'Review and process borrowing requests from ECA committees.'
        }
        actions={
          isCommittee ? (
            <Button asChild>
              <Link to="/committee/requests/new">
                <Plus aria-hidden="true" />
                New request
              </Link>
            </Button>
          ) : undefined
        }
      />
      <Card className="gap-0 py-0">
        <CardContent className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="request-search">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="request-search"
                value={search}
                onChange={(event) => updateFilter(setSearch, event.target.value)}
                placeholder="Code or requester"
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Request status</Label>
            <AppSelect
              value={status}
              onValueChange={(value) => updateFilter(setStatus, value)}
              ariaLabel="Filter request status"
              emptyLabel="All statuses"
              options={statuses.map((requestStatus) => ({
                value: requestStatus,
                label: formatEnumLabel(requestStatus),
              }))}
            />
          </div>
          {!isCommittee ? (
            <div className="space-y-1.5">
              <Label>Committee</Label>
              <AppSelect
                value={committeeId}
                onValueChange={(value) => updateFilter(setCommitteeId, value)}
                ariaLabel="Filter by committee"
                emptyLabel="All committees"
                options={committees.map((committee) => ({
                  value: committee.id,
                  label: committee.name,
                }))}
              />
            </div>
          ) : null}
        </CardContent>
        <FilterSummary
          filters={activeFilters}
          resultCount={pagination.total}
          resultLabel={pagination.total === 1 ? 'request' : 'requests'}
          onClear={clearFilters}
        />
        <ServerDataTable
          rows={requests}
          columns={columns}
          getRowKey={(request) => request.id}
          isLoading={isLoading}
          error={error}
          emptyTitle="No borrowing requests found"
          emptyDescription="Create a request or change the current filters."
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={(nextSortBy, nextSortOrder) => {
            setSortBy(nextSortBy as RequestListParams['sortBy'])
            setSortOrder(nextSortOrder)
            setPage(1)
            setIsLoading(true)
          }}
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
    </div>
  )
}
