import axios from 'axios'
import {
  Boxes,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  PackageSearch,
  RefreshCw,
  Search,
  UserRoundCheck,
  Users,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

import { PageHeader } from '@/components/common/PageHeader'
import { PaginationControls } from '@/components/common/PaginationControls'
import {
  ServerDataTable,
  type ServerTableColumn,
} from '@/components/common/ServerDataTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/useToast'
import { downloadFile } from '@/lib/download-file'
import { getApiBlobErrorMessage, getApiErrorMessage } from '@/services/api'
import { categoryService } from '@/services/categoryService'
import { inventoryReportService } from '@/services/inventoryReportService'
import type { Category, ItemCondition } from '@/types/api'
import type {
  InventoryReportFilters,
  InventoryReportItem,
  InventoryReportResponse,
  InventoryReportSortField,
} from '@/types/inventoryReport'

const PAGE_SIZE = 20
const ALL_FILTER_VALUE = 'all'
const conditions: ItemCondition[] = ['GOOD', 'FAIR', 'DAMAGED', 'UNDER_REPAIR', 'LOST']

interface FilterDraft {
  search: string
  categoryId: string
  condition: '' | ItemCondition
  status: 'active' | 'inactive'
}

const defaultFilterDraft: FilterDraft = {
  search: '',
  categoryId: '',
  condition: '',
  status: 'active',
}

const defaultReportFilters: InventoryReportFilters = {
  isActive: true,
  sortBy: 'itemName',
  sortOrder: 'asc',
}

function fallbackFilename(extension: 'pdf' | 'csv') {
  return `eca-inventory-report-${new Date().toISOString().slice(0, 10)}.${extension}`
}

async function validateDownloadBlob(blob: Blob, format: 'pdf' | 'csv') {
  if (blob.size === 0) {
    throw new Error(`The generated ${format.toUpperCase()} file was empty.`)
  }

  if (blob.type.toLowerCase().includes('json')) {
    try {
      const payload: unknown = JSON.parse(await blob.text())

      if (
        typeof payload === 'object' &&
        payload !== null &&
        'message' in payload &&
        typeof payload.message === 'string'
      ) {
        throw new Error(payload.message)
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`The server returned a malformed ${format.toUpperCase()} file.`, {
          cause: error,
        })
      }

      throw error
    }
  }
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  accentClass,
  isLoading,
}: {
  label: string
  value: number | undefined
  icon: typeof Boxes
  accentClass: string
  isLoading: boolean
}) {
  return (
    <Card className="relative gap-4 py-5">
      <span className={`absolute inset-y-0 left-0 w-1 ${accentClass}`} aria-hidden="true" />
      <CardContent className="flex items-center justify-between gap-4 px-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-2 h-8 w-20" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value ?? '—'}</p>
          )}
        </div>
        <span className={`flex size-10 items-center justify-center rounded-lg bg-muted ${accentClass}`}>
          <Icon className="size-5 text-white" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  )
}

export function InventoryReportPage() {
  const { notify } = useToast()
  const [report, setReport] = useState<InventoryReportResponse | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [draftFilters, setDraftFilters] = useState<FilterDraft>(defaultFilterDraft)
  const [filters, setFilters] = useState<InventoryReportFilters>(defaultReportFilters)
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [isPreviewLoading, setIsPreviewLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false)
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    categoryService
      .list(undefined, controller.signal)
      .then((result) => {
        setCategories(result)
        setCategoriesError(null)
      })
      .catch((error: unknown) => {
        if (!axios.isCancel(error)) {
          setCategoriesError(getApiErrorMessage(error, 'Categories could not be loaded.'))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsCategoriesLoading(false)
        }
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    inventoryReportService
      .get(
        {
          ...filters,
          page,
          limit: PAGE_SIZE,
        },
        controller.signal,
      )
      .then((result) => {
        setReport(result)
        setPreviewError(null)
      })
      .catch((error: unknown) => {
        if (!axios.isCancel(error)) {
          setPreviewError(getApiErrorMessage(error, 'The inventory report could not be loaded.'))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsPreviewLoading(false)
          setIsRefreshing(false)
        }
      })

    return () => controller.abort()
  }, [filters, page, reloadKey])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setIsPreviewLoading(true)
    setFilters((current) => ({
      search: draftFilters.search.trim() || undefined,
      categoryId: draftFilters.categoryId || undefined,
      condition: draftFilters.condition || undefined,
      isActive: draftFilters.status === 'active',
      sortBy: current.sortBy,
      sortOrder: current.sortOrder,
    }))
    setReloadKey((key) => key + 1)
  }

  function resetFilters() {
    setDraftFilters(defaultFilterDraft)
    setFilters(defaultReportFilters)
    setPage(1)
    setIsPreviewLoading(true)
    setReloadKey((key) => key + 1)
  }

  function refreshReport() {
    setIsRefreshing(true)
    setReloadKey((key) => key + 1)
  }

  function retryPreview() {
    setIsPreviewLoading(true)
    setReloadKey((key) => key + 1)
  }

  function updateSorting(sortBy: string, sortOrder: 'asc' | 'desc') {
    setFilters((current) => ({
      ...current,
      sortBy: sortBy as InventoryReportSortField,
      sortOrder,
    }))
    setPage(1)
    setIsPreviewLoading(true)
  }

  async function handleDownload(format: 'pdf' | 'csv') {
    const setLoading = format === 'pdf' ? setIsDownloadingPdf : setIsDownloadingCsv
    setLoading(true)

    try {
      const result =
        format === 'pdf'
          ? await inventoryReportService.downloadPdf(filters)
          : await inventoryReportService.downloadCsv(filters)

      await validateDownloadBlob(result.blob, format)
      downloadFile(result.blob, result.contentDisposition, fallbackFilename(format))
      notify({
        title: `${format.toUpperCase()} report downloaded.`,
        description: 'The file uses the currently applied inventory filters.',
      })
    } catch (error) {
      notify({
        title: `${format.toUpperCase()} report was not downloaded.`,
        description: await getApiBlobErrorMessage(error, 'Please try again.'),
        tone: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  const columns: ServerTableColumn<InventoryReportItem>[] = [
    {
      key: 'itemCode',
      label: 'Item Code',
      sortKey: 'itemCode',
      render: (item) => <span className="font-medium">{item.itemCode}</span>,
    },
    {
      key: 'item',
      label: 'Item',
      sortKey: 'itemName',
      align: 'left',
      render: (item) => (
        <div>
          <p className="font-medium text-foreground">{item.itemName}</p>
          <p className="max-w-52 truncate text-xs text-muted-foreground">
            {item.storageLocation}
          </p>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (item) => item.category.name,
    },
    {
      key: 'condition',
      label: 'Condition',
      sortKey: 'condition',
      render: (item) => item.conditionLabel,
    },
    {
      key: 'quantity',
      label: 'Total',
      sortKey: 'totalQuantity',
      className: 'text-right tabular-nums',
      render: (item) => item.quantity,
    },
    {
      key: 'availableQuantity',
      label: 'Available',
      sortKey: 'availableQuantity',
      className: 'text-right tabular-nums',
      render: (item) => item.availableQuantity,
    },
    {
      key: 'borrowedQuantity',
      label: 'Borrowed',
      className: 'text-right tabular-nums',
      render: (item) => item.borrowedQuantity,
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => (
        <StatusBadge
          label={item.isActive ? 'Active' : 'Inactive'}
          tone={item.isActive ? 'success' : 'inactive'}
        />
      ),
    },
  ]

  const hasNoResults = Boolean(report && report.summary.distinctItems === 0)
  const downloadsDisabled = isPreviewLoading || !report || hasNoResults
  const downloadHelp = hasNoResults
    ? 'Downloads are unavailable because no inventory items match the applied filters.'
    : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Report"
        description="Generate and download the organization’s current inventory report."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={refreshReport}
              disabled={isRefreshing || isPreviewLoading}
              aria-busy={isRefreshing}
            >
              <RefreshCw className={isRefreshing ? 'animate-spin' : undefined} aria-hidden="true" />
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleDownload('csv')}
              disabled={downloadsDisabled || isDownloadingCsv}
              aria-busy={isDownloadingCsv}
              aria-describedby={downloadHelp ? 'report-download-help' : undefined}
            >
              <FileSpreadsheet aria-hidden="true" />
              {isDownloadingCsv ? 'Generating CSV…' : 'Download CSV'}
            </Button>
            <Button
              type="button"
              onClick={() => void handleDownload('pdf')}
              disabled={downloadsDisabled || isDownloadingPdf}
              aria-busy={isDownloadingPdf}
              aria-describedby={downloadHelp ? 'report-download-help' : undefined}
            >
              <Download aria-hidden="true" />
              {isDownloadingPdf ? 'Generating PDF…' : 'Download PDF'}
            </Button>
          </div>
        }
      />

      {downloadHelp ? (
        <p id="report-download-help" className="-mt-3 text-sm text-muted-foreground">
          {downloadHelp}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Report filters</CardTitle>
          <p className="text-sm text-muted-foreground">
            Search by item name, code, description, or storage location.
          </p>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(15rem,1.4fr)_repeat(3,minmax(10rem,1fr))_auto]"
            onSubmit={applyFilters}
          >
            <div className="space-y-2">
              <Label htmlFor="report-search">Search</Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="report-search"
                  value={draftFilters.search}
                  onChange={(event) =>
                    setDraftFilters((current) => ({ ...current, search: event.target.value }))
                  }
                  placeholder="Search inventory…"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-category">Category</Label>
              <Select
                value={draftFilters.categoryId || ALL_FILTER_VALUE}
                onValueChange={(value) =>
                  setDraftFilters((current) => ({
                    ...current,
                    categoryId: value === ALL_FILTER_VALUE ? '' : value,
                  }))
                }
                disabled={isCategoriesLoading}
              >
                <SelectTrigger id="report-category" className="w-full">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>All categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                      {!category.isActive ? ' (Inactive)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isCategoriesLoading ? (
                <p className="text-xs text-muted-foreground">Loading categories…</p>
              ) : categoriesError ? (
                <p className="text-xs text-destructive" role="status">
                  {categoriesError}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-condition">Condition</Label>
              <Select
                value={draftFilters.condition || ALL_FILTER_VALUE}
                onValueChange={(value) =>
                  setDraftFilters((current) => ({
                    ...current,
                    condition:
                      value === ALL_FILTER_VALUE ? '' : (value as ItemCondition),
                  }))
                }
              >
                <SelectTrigger id="report-condition" className="w-full">
                  <SelectValue placeholder="All conditions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>All conditions</SelectItem>
                  {conditions.map((condition) => (
                    <SelectItem key={condition} value={condition}>
                      {condition
                        .replaceAll('_', ' ')
                        .toLowerCase()
                        .replace(/\b\w/g, (letter) => letter.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-status">Status</Label>
              <Select
                value={draftFilters.status}
                onValueChange={(value) =>
                  setDraftFilters((current) => ({
                    ...current,
                    status: value as FilterDraft['status'],
                  }))
                }
              >
                <SelectTrigger id="report-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2 md:col-span-2 md:flex-row md:items-end xl:col-span-1">
              <Button type="submit" className="md:flex-1 xl:flex-none">
                Apply filters
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={resetFilters}
                className="md:flex-1 xl:flex-none"
              >
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="report-summary-heading" aria-busy={isPreviewLoading}>
        <h2 id="report-summary-heading" className="sr-only">
          Inventory report summary
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Distinct Items"
            value={report?.summary.distinctItems}
            icon={PackageSearch}
            accentClass="bg-primary"
            isLoading={isPreviewLoading}
          />
          <SummaryCard
            label="Total Quantity"
            value={report?.summary.totalQuantity}
            icon={Boxes}
            accentClass="bg-warning"
            isLoading={isPreviewLoading}
          />
          <SummaryCard
            label="Available Quantity"
            value={report?.summary.availableQuantity}
            icon={CheckCircle2}
            accentClass="bg-success"
            isLoading={isPreviewLoading}
          />
          <SummaryCard
            label="Borrowed Quantity"
            value={report?.summary.borrowedQuantity}
            icon={Download}
            accentClass="bg-info"
            isLoading={isPreviewLoading}
          />
        </div>
      </section>

      <Card className="gap-0 py-0">
        <CardContent className="grid gap-4 border-b p-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Date of Inventory
              </p>
              <p className="mt-1 text-sm font-medium">{report?.report.dateOfInventory ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Conducted By
              </p>
              <p className="mt-1 text-sm font-medium">{report?.report.conductedBy ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 sm:col-span-2 xl:col-span-1">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserRoundCheck className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Noted By
              </p>
              <p className="mt-1 text-sm font-medium">
                {report?.report.notedBy.name ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                {report?.report.notedBy.title ?? 'ECA Governor'}
              </p>
            </div>
          </div>
        </CardContent>

        <div aria-busy={isPreviewLoading}>
          <ServerDataTable
            rows={report?.items ?? []}
            columns={columns}
            getRowKey={(item) => item.id}
            isLoading={isPreviewLoading}
            error={previewError}
            emptyTitle="No inventory items match the selected filters"
            emptyDescription="Reset the filters or try a broader search to see report results."
            emptyAction={
              <Button type="button" variant="outline" onClick={resetFilters}>
                Reset filters
              </Button>
            }
            sortBy={filters.sortBy}
            sortOrder={filters.sortOrder}
            onSort={updateSorting}
            onRetry={retryPreview}
            tableClassName="min-w-[860px]"
          />
        </div>

        {!previewError && !isPreviewLoading && report ? (
          <PaginationControls
            pagination={report.pagination}
            onPageChange={(nextPage) => {
              setPage(nextPage)
              setIsPreviewLoading(true)
            }}
          />
        ) : null}
      </Card>
    </div>
  )
}
