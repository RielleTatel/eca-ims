import axios from 'axios'
import {
  ArrowLeft,
  Boxes,
  ExternalLink,
  MapPin,
  PackageOpen,
  Pencil,
  Search,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/common/PageHeader'
import { PaginationControls } from '@/components/common/PaginationControls'
import { ServerDataTable, type ServerTableColumn } from '@/components/common/ServerDataTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import { FullPageError } from '@/components/states/FullPageError'
import { PageLoading } from '@/components/states/PageLoading'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { getApiErrorMessage } from '@/services/api'
import { itemService } from '@/services/itemService'
import { requestService, type HistoryListParams } from '@/services/requestService'
import type {
  BorrowingHistoryRecord,
  InventoryItem,
  Pagination,
  SortOrder,
} from '@/types/api'
import { formatEnumLabel } from '@/utils/formatEnumLabel'

const emptyPagination: Pagination = { page: 1, limit: 10, total: 0, totalPages: 0 }

export function ItemDetailsPage() {
  const { itemId } = useParams()
  const { user } = useAuth()
  const isAdmin = user?.role === 'SUPER_ADMIN'
  const [item, setItem] = useState<InventoryItem | null>(null)
  const [history, setHistory] = useState<BorrowingHistoryRecord[]>([])
  const [pagination, setPagination] = useState(emptyPagination)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<HistoryListParams['sortBy']>('borrowDate')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [isItemLoading, setIsItemLoading] = useState(true)
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)
  const [itemError, setItemError] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)

  useEffect(() => {
    if (!itemId) {
      return
    }

    const controller = new AbortController()

    itemService
      .get(itemId, controller.signal)
      .then((itemResult) => {
        setItem(itemResult)
        setItemError(null)
      })
      .catch((requestError: unknown) => {
        if (!axios.isCancel(requestError)) {
          setItemError(getApiErrorMessage(requestError, 'Inventory details could not be loaded.'))
        }
      })
      .finally(() => setIsItemLoading(false))

    return () => controller.abort()
  }, [itemId])

  useEffect(() => {
    if (!itemId) {
      return
    }

    const controller = new AbortController()

    requestService
      .history(
        {
          itemId,
          search: debouncedSearch || undefined,
          page,
          limit: 10,
          sortBy,
          sortOrder,
        },
        controller.signal,
      )
      .then((historyResult) => {
        setHistory(historyResult.history)
        setPagination(historyResult.pagination)
        setHistoryError(null)
      })
      .catch((requestError: unknown) => {
        if (!axios.isCancel(requestError)) {
          setHistoryError(
            getApiErrorMessage(requestError, 'Borrowing history could not be loaded.'),
          )
        }
      })
      .finally(() => setIsHistoryLoading(false))

    return () => controller.abort()
  }, [debouncedSearch, itemId, page, sortBy, sortOrder])

  if (!itemId) {
    return <FullPageError message="Inventory item ID is missing." />
  }

  if (isItemLoading && !item) {
    return <PageLoading label="Loading inventory details" />
  }

  if (itemError || !item) {
    return <FullPageError message={itemError ?? 'Inventory item was not found.'} />
  }

  const basePath = isAdmin ? '/logistics' : '/committee'
  const borrowedQuantity = Math.max(0, item.totalQuantity - item.availableQuantity)
  const availabilityPercent =
    item.totalQuantity > 0 ? (item.availableQuantity / item.totalQuantity) * 100 : 0
  const conditionTone =
    item.condition === 'GOOD'
      ? 'success'
      : item.condition === 'FAIR' || item.condition === 'UNDER_REPAIR'
        ? 'warning'
        : 'danger'
  const historyColumns: ServerTableColumn<BorrowingHistoryRecord>[] = [
    {
      key: 'request',
      label: 'Request',
      render: (entry) => (
        <Button asChild variant="link" className="h-auto p-0">
          <Link to={`${basePath}/requests/${entry.id}`}>{entry.requestCode}</Link>
        </Button>
      ),
    },
    { key: 'committee', label: 'Committee', render: (entry) => entry.committee.name },
    {
      key: 'dates',
      label: 'Borrow period',
      sortKey: 'borrowDate',
      render: (entry) =>
        `${new Date(entry.borrowDate).toLocaleDateString()} – ${new Date(entry.expectedReturnDate).toLocaleDateString()}`,
    },
    {
      key: 'quantity',
      label: 'Quantity',
      render: (entry) =>
        entry.items.find((requestItem) => requestItem.itemId === itemId)?.quantityRequested ?? 0,
    },
    {
      key: 'status',
      label: 'Status',
      sortKey: 'status',
      render: (entry) => (
        <StatusBadge
          label={formatEnumLabel(entry.status)}
          tone={
            entry.status === 'REJECTED'
              ? 'danger'
              : entry.status === 'RETURNED'
                ? 'success'
                : entry.status === 'PENDING'
                  ? 'pending'
                  : 'progress'
          }
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.itemName}
        description={`${item.itemCode} · ${item.category.name}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to={`${basePath}/inventory`}>
                <ArrowLeft aria-hidden="true" />
                Back
              </Link>
            </Button>
            {isAdmin ? (
              <Button asChild>
                <Link to={`/logistics/inventory/${item.id}/edit`}>
                  <Pencil aria-hidden="true" />
                  Edit item
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Inventory summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_repeat(3,minmax(0,1fr))]">
          <div className="rounded-xl bg-muted/50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Boxes className="size-4" aria-hidden="true" />
              Available now
            </div>
            <p className="mt-2 font-heading text-3xl font-bold tabular-nums">
              {item.availableQuantity}
              <span className="ml-1 text-base font-medium text-muted-foreground">
                of {item.totalQuantity}
              </span>
            </p>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-label="Available inventory"
              aria-valuemin={0}
              aria-valuemax={item.totalQuantity}
              aria-valuenow={item.availableQuantity}
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${availabilityPercent}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <PackageOpen className="size-4" aria-hidden="true" />
              Currently borrowed
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{borrowedQuantity}</p>
            <p className="mt-1 text-xs text-muted-foreground">Units outside storage</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Condition
            </p>
            <div className="mt-2">
              <StatusBadge
                label={formatEnumLabel(item.condition)}
                tone={conditionTone}
              />
            </div>
            <div className="mt-4">
              <StatusBadge
                label={item.isActive ? 'Active record' : 'Inactive record'}
                tone={item.isActive ? 'neutral' : 'inactive'}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MapPin className="size-4" aria-hidden="true" />
              Storage location
            </div>
            <p className="mt-2 text-sm font-medium leading-6">{item.storageLocation}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Item information</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">{item.description || 'No description provided.'}</p>
          {item.googleDriveFolderLink ? (
            <Button asChild variant="outline" size="sm">
              <a href={item.googleDriveFolderLink} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden="true" />
                Open Drive folder
              </a>
            </Button>
          ) : null}
        </CardContent>
      </Card>
      <Card className="gap-0 py-0">
        <CardHeader className="py-5"><CardTitle>Borrowing history</CardTitle></CardHeader>
        <CardContent className="border-y p-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
                setIsHistoryLoading(true)
              }}
              placeholder="Search borrowing history…"
              aria-label="Search item borrowing history"
              className="pl-9"
            />
          </div>
        </CardContent>
        <ServerDataTable
          rows={history}
          columns={historyColumns}
          getRowKey={(entry) => entry.id}
          isLoading={isHistoryLoading}
          error={historyError}
          emptyTitle="No borrowing history"
          emptyDescription="This item has not appeared in a borrowing request yet."
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={(nextSortBy, nextSortOrder) => {
            setSortBy(nextSortBy as HistoryListParams['sortBy'])
            setSortOrder(nextSortOrder)
            setPage(1)
            setIsHistoryLoading(true)
          }}
        />
        {!historyError && !isHistoryLoading ? (
          <PaginationControls
            pagination={pagination}
            onPageChange={(nextPage) => {
              setPage(nextPage)
              setIsHistoryLoading(true)
            }}
          />
        ) : null}
      </Card>
    </div>
  )
}
