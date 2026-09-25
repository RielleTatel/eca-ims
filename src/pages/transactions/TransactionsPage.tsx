import axios from 'axios'
import { ArrowRight, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/common/PageHeader'
import { AppSelect } from '@/components/common/AppSelect'
import { PaginationControls } from '@/components/common/PaginationControls'
import {
  ServerDataTable,
  type ServerTableColumn,
} from '@/components/common/ServerDataTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { getApiErrorMessage } from '@/services/api'
import {
  systemRecordsService,
  type InventoryTransactionListParams,
} from '@/services/systemRecordsService'
import type {
  InventoryTransactionRecord,
  Pagination,
  SortOrder,
  TransactionType,
} from '@/types/api'

const PAGE_SIZE = 15
const emptyPagination: Pagination = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  totalPages: 0,
}
const transactionTypes: TransactionType[] = [
  'ITEM_ADDED',
  'QUANTITY_INCREASED',
  'QUANTITY_DECREASED',
  'BORROWED',
  'RETURNED',
  'DAMAGED',
  'LOST',
  'ADJUSTMENT',
]

function readableLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function transactionTone(type: TransactionType) {
  if (type === 'RETURNED' || type === 'ITEM_ADDED' || type === 'QUANTITY_INCREASED') {
    return 'success' as const
  }
  if (type === 'DAMAGED' || type === 'LOST' || type === 'QUANTITY_DECREASED') {
    return 'danger' as const
  }
  if (type === 'BORROWED') {
    return 'progress' as const
  }
  return 'inactive' as const
}

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<InventoryTransactionRecord[]>([])
  const [pagination, setPagination] = useState(emptyPagination)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [transactionType, setTransactionType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] =
    useState<InventoryTransactionListParams['sortBy']>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [reloadKey, setReloadKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    systemRecordsService
      .inventoryTransactions(
        {
          search: debouncedSearch || undefined,
          transactionType: (transactionType || undefined) as
            | TransactionType
            | undefined,
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
        setTransactions(result.transactions)
        setPagination(result.pagination)
        setError(null)
      })
      .catch((requestError: unknown) => {
        if (!axios.isCancel(requestError)) {
          setError(
            getApiErrorMessage(
              requestError,
              'Inventory transactions could not be loaded.',
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
    dateFrom,
    dateTo,
    debouncedSearch,
    page,
    reloadKey,
    sortBy,
    sortOrder,
    transactionType,
  ])

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value)
    setPage(1)
    setIsLoading(true)
  }

  const columns: ServerTableColumn<InventoryTransactionRecord>[] = [
    {
      key: 'createdAt',
      label: 'Date and time',
      sortKey: 'createdAt',
      render: (transaction) => (
        <time dateTime={transaction.createdAt}>
          {new Date(transaction.createdAt).toLocaleString()}
        </time>
      ),
    },
    {
      key: 'item',
      label: 'Inventory item',
      align: 'left',
      render: (transaction) => (
        <div>
          <Button asChild variant="link" className="h-auto p-0 font-medium">
            <Link to={`/logistics/inventory/${transaction.item.id}`}>
              {transaction.item.itemName}
            </Link>
          </Button>
          <p className="font-mono text-xs text-muted-foreground">
            {transaction.item.itemCode}
          </p>
        </div>
      ),
    },
    {
      key: 'transactionType',
      label: 'Type',
      sortKey: 'transactionType',
      render: (transaction) => (
        <StatusBadge
          label={readableLabel(transaction.transactionType)}
          tone={transactionTone(transaction.transactionType)}
        />
      ),
    },
    {
      key: 'quantity',
      label: 'Quantity',
      sortKey: 'quantity',
      className: 'text-right tabular-nums',
      render: (transaction) => transaction.quantity,
    },
    {
      key: 'movement',
      label: 'Availability',
      className: 'text-right tabular-nums',
      render: (transaction) => (
        <span className="inline-flex items-center gap-1">
          {transaction.quantityBefore}
          <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {transaction.quantityAfter}
        </span>
      ),
    },
    {
      key: 'reference',
      label: 'Reference',
      align: 'left',
      render: (transaction) =>
        transaction.borrowingRequest ? (
          <Button asChild variant="link" className="h-auto p-0">
            <Link to={`/logistics/requests/${transaction.borrowingRequest.id}`}>
              {transaction.borrowingRequest.requestCode}
            </Link>
          </Button>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'performer',
      label: 'Performed by',
      render: (transaction) => transaction.performer.username,
    },
    {
      key: 'remarks',
      label: 'Remarks',
      align: 'left',
      render: (transaction) => (
        <p className="max-w-72 whitespace-normal text-sm text-muted-foreground">
          {transaction.remarks || 'No remarks'}
        </p>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Transactions"
        description="Review quantity movements, borrowing releases, and processed returns."
      />
      <Card className="gap-0 py-0">
        <CardContent className="grid gap-3 border-b p-4 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_repeat(3,minmax(10rem,auto))]">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => updateFilter(setSearch, event.target.value)}
              placeholder="Search items, requests, or remarks…"
              aria-label="Search inventory transactions"
              className="pl-9"
            />
          </div>
          <AppSelect
            value={transactionType}
            onValueChange={(value) =>
              updateFilter(setTransactionType, value)
            }
            ariaLabel="Filter transaction type"
            emptyLabel="All transaction types"
            options={transactionTypes.map((type) => ({
              value: type,
              label: readableLabel(type),
            }))}
          />
          <Input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(event) => updateFilter(setDateFrom, event.target.value)}
            aria-label="Transactions from date"
          />
          <Input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(event) => updateFilter(setDateTo, event.target.value)}
            aria-label="Transactions to date"
          />
        </CardContent>
        <ServerDataTable
          rows={transactions}
          columns={columns}
          getRowKey={(transaction) => transaction.id}
          isLoading={isLoading}
          error={error}
          emptyTitle="No inventory transactions found"
          emptyDescription="Try changing the filters or process an inventory movement."
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={(nextSortBy, nextSortOrder) => {
            setSortBy(nextSortBy as InventoryTransactionListParams['sortBy'])
            setSortOrder(nextSortOrder)
            setPage(1)
            setIsLoading(true)
          }}
          onRetry={() => {
            setIsLoading(true)
            setReloadKey((current) => current + 1)
          }}
          tableClassName="min-w-[70rem]"
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
