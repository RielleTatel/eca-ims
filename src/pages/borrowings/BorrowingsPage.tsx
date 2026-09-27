import { Plus, RefreshCw, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { AppSelect } from '@/components/common/AppSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { PaginationControls } from '@/components/common/PaginationControls'
import { ServerDataTable, type ServerTableColumn } from '@/components/common/ServerDataTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { getApiErrorMessage } from '@/services/api'
import { borrowingService, displayBorrowingDate, isOverdue, type BorrowingListParams } from '@/services/borrowingService'
import type { BorrowingRecord, BorrowingStatus, Pagination, SortOrder } from '@/types/api'

export function BorrowingsPage() {
  const [searchParams] = useSearchParams()
  const [filter, setFilter] = useState(searchParams.get('status') === 'overdue' ? 'OVERDUE' : searchParams.get('status') === 'returned' ? 'RETURNED' : 'ACTIVE')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [records, setRecords] = useState<BorrowingRecord[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 1 })
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<BorrowingListParams['sortBy']>('expectedReturnDate')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [reloadKey, setReloadKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    borrowingService.list({ page, limit: 10, search: debouncedSearch, sortBy, sortOrder,
      status: filter && filter !== 'OVERDUE' ? filter as BorrowingStatus : undefined,
      overdueOnly: filter === 'OVERDUE',
    }, controller.signal).then((result) => {
      if (controller.signal.aborted) return
      setRecords(result.borrowings)
      setPagination(result.pagination)
      setError(null)
    }).catch((loadError: unknown) => {
      if (!controller.signal.aborted) setError(getApiErrorMessage(loadError, 'Borrowings could not be loaded.'))
    }).finally(() => { if (!controller.signal.aborted) setIsLoading(false) })
    return () => controller.abort()
  }, [page, filter, debouncedSearch, sortBy, sortOrder, reloadKey])

  const columns: ServerTableColumn<BorrowingRecord>[] = [
    { key: 'borrowing', label: 'Borrowing', render: (record) => (
      <Button asChild variant="link" className="h-auto p-0"><Link to={`/logistics/borrowings/${record.id}`}>{record.borrowingCode}</Link></Button>
    ) },
    { key: 'student', label: 'Student', render: (record) => <div><p className="font-medium">{record.borrowerName}</p><p className="text-xs text-muted-foreground">{record.studentId ?? 'ID not recorded (legacy)'}</p></div> },
    { key: 'borrowDate', label: 'Checkout', sortKey: 'borrowDate', render: (record) => displayBorrowingDate(record.borrowDate) },
    { key: 'due', label: 'Expected return', sortKey: 'expectedReturnDate', render: (record) => displayBorrowingDate(record.expectedReturnDate) },
    { key: 'items', label: 'Outstanding', render: (record) => `${record.outstandingQuantity} unit${record.outstandingQuantity === 1 ? '' : 's'}` },
    { key: 'status', label: 'Status', sortKey: 'status', render: (record) => <StatusBadge label={isOverdue(record) ? 'Overdue' : record.status === 'ACTIVE' ? 'Active' : record.status === 'RETURNED' ? 'Returned' : 'Archived'} tone={isOverdue(record) ? 'danger' : record.status === 'RETURNED' ? 'success' : record.status === 'ARCHIVED' ? 'inactive' : 'progress'} /> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Borrowings" description="Track equipment lent to students and record returns." actions={<Button asChild><Link to="/logistics/borrowings/new"><Plus aria-hidden="true" />Record borrowing</Link></Button>} />
      <Card className="gap-0 py-0">
        <CardContent className="flex flex-wrap gap-3 border-b p-4">
          <div className="relative min-w-56 flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden="true" /><Input className="pl-9" aria-label="Search borrowings" placeholder="Search student name, ID, or borrowing code…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); setIsLoading(true) }} /></div>
          <AppSelect value={filter} emptyLabel="All records" ariaLabel="Filter borrowings" onValueChange={(value) => { setFilter(value); setPage(1); setIsLoading(true) }} options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'OVERDUE', label: 'Overdue' }, { value: 'RETURNED', label: 'Returned' }, { value: 'ARCHIVED', label: 'Archived history' }]} />
          <Button variant="outline" aria-label="Refresh borrowings" onClick={() => { setIsLoading(true); setReloadKey((key) => key + 1) }}><RefreshCw aria-hidden="true" /></Button>
        </CardContent>
        <ServerDataTable rows={records} columns={columns} getRowKey={(record) => record.id} isLoading={isLoading} error={error} emptyTitle="No borrowings found" emptyDescription="Record a checkout when equipment is handed to a student." sortBy={sortBy} sortOrder={sortOrder} onSort={(key, order) => { setSortBy(key as BorrowingListParams['sortBy']); setSortOrder(order); setPage(1); setIsLoading(true) }} onRetry={() => { setIsLoading(true); setReloadKey((key) => key + 1) }} />
        {!isLoading && !error ? <PaginationControls pagination={pagination} onPageChange={(nextPage) => { setPage(nextPage); setIsLoading(true) }} /> : null}
      </Card>
    </div>
  )
}
