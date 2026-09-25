import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import type { ReactNode } from 'react'

import { EmptyState } from '@/components/common/EmptyState'
import { InlineError } from '@/components/states/InlineError'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { SortOrder } from '@/types/api'

type TableColumnAlignment = 'left' | 'center' | 'right'

export interface ServerTableColumn<T> {
  key: string
  label: string
  render: (row: T) => ReactNode
  sortKey?: string
  align?: TableColumnAlignment
  className?: string
  hideOnMobile?: boolean
}

const alignmentClassNames: Record<TableColumnAlignment, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

interface ServerDataTableProps<T> {
  rows: T[]
  columns: ServerTableColumn<T>[]
  getRowKey: (row: T) => string
  isLoading: boolean
  error: string | null
  emptyTitle: string
  emptyDescription: string
  emptyAction?: ReactNode
  sortBy?: string
  sortOrder?: SortOrder
  onSort?: (sortBy: string, sortOrder: SortOrder) => void
  onRetry?: () => void
  tableClassName?: string
}

export function ServerDataTable<T>({
  rows,
  columns,
  getRowKey,
  isLoading,
  error,
  emptyTitle,
  emptyDescription,
  emptyAction,
  sortBy,
  sortOrder,
  onSort,
  onRetry,
  tableClassName,
}: ServerDataTableProps<T>) {
  if (error) {
    return (
      <div className="p-4">
        <InlineError
          message={error}
          action={
            onRetry ? (
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                Retry
              </Button>
            ) : undefined
          }
        />
      </div>
    )
  }

  if (!isLoading && rows.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    )
  }

  const visibleMobileColumns = columns.filter((column) => !column.hideOnMobile)
  const primaryMobileColumn = visibleMobileColumns[0]
  const actionMobileColumn = visibleMobileColumns.find((column) =>
    ['action', 'actions'].includes(column.key),
  )
  const detailMobileColumns = visibleMobileColumns.filter(
    (column) => column !== primaryMobileColumn && column !== actionMobileColumn,
  )

  return (
    <>
      <div className="divide-y md:hidden">
        {isLoading
          ? Array.from({ length: 4 }, (_, rowIndex) => (
              <div key={`mobile-loading-${rowIndex}`} className="space-y-3 p-4">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-9 w-24" />
              </div>
            ))
          : rows.map((row) => (
              <article key={getRowKey(row)} className="space-y-3 p-4">
                {primaryMobileColumn ? (
                  <div>{primaryMobileColumn.render(row)}</div>
                ) : null}
                {detailMobileColumns.length > 0 ? (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {detailMobileColumns.map((column) => (
                      <div key={column.key} className="min-w-0">
                        <dt
                          className={cn(
                            'text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground',
                            alignmentClassNames[column.align ?? 'center'],
                          )}
                        >
                          {column.label}
                        </dt>
                        <dd
                          className={cn(
                            'mt-0.5 whitespace-normal text-sm',
                            alignmentClassNames[column.align ?? 'center'],
                          )}
                        >
                          {column.render(row)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {actionMobileColumn ? (
                  <div className="flex min-h-10 items-center justify-center border-t pt-3">
                    {actionMobileColumn.render(row)}
                  </div>
                ) : null}
              </article>
            ))}
      </div>
      <div className="hidden md:block">
        <Table className={tableClassName}>
          <TableHeader>
            <TableRow>
              {columns.map((column, columnIndex) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    column.className,
                    alignmentClassNames[
                      column.align ?? (columnIndex === 0 ? 'left' : 'center')
                    ],
                  )}
                >
                  {column.sortKey && onSort ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        (column.align ?? (columnIndex === 0 ? 'left' : 'center')) ===
                          'left' && '-ml-2',
                        (column.align ?? (columnIndex === 0 ? 'left' : 'center')) ===
                          'center' && 'mx-auto',
                        column.align === 'right' && '-mr-2 ml-auto',
                      )}
                      onClick={() =>
                        onSort(
                          column.sortKey!,
                          sortBy === column.sortKey && sortOrder === 'asc' ? 'desc' : 'asc',
                        )
                      }
                    >
                      {column.label}
                      {sortBy !== column.sortKey ? (
                        <ArrowUpDown aria-hidden="true" />
                      ) : sortOrder === 'asc' ? (
                        <ArrowUp aria-hidden="true" />
                      ) : (
                        <ArrowDown aria-hidden="true" />
                      )}
                    </Button>
                  ) : (
                    column.label
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }, (_, rowIndex) => (
                  <TableRow key={`loading-${rowIndex}`}>
                    {columns.map((column, columnIndex) => (
                      <TableCell
                        key={column.key}
                        className={cn(
                          column.className,
                          alignmentClassNames[
                            column.align ?? (columnIndex === 0 ? 'left' : 'center')
                          ],
                        )}
                      >
                        <Skeleton
                          className={cn(
                            'h-5 w-full max-w-32',
                            (column.align ?? (columnIndex === 0 ? 'left' : 'center')) ===
                              'center' && 'mx-auto',
                            column.align === 'right' && 'ml-auto',
                          )}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : rows.map((row) => (
                  <TableRow key={getRowKey(row)}>
                    {columns.map((column, columnIndex) => (
                      <TableCell
                        key={column.key}
                        className={cn(
                          column.className,
                          alignmentClassNames[
                            column.align ?? (columnIndex === 0 ? 'left' : 'center')
                          ],
                        )}
                      >
                        {column.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
