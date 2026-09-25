import axios from 'axios'
import { Eye, Pencil, Plus, Power, PowerOff, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { ActionTooltip } from '@/components/common/ActionTooltip'
import { AppSelect } from '@/components/common/AppSelect'
import { FilterSummary, type ActiveFilter } from '@/components/common/FilterSummary'
import { PageHeader } from '@/components/common/PageHeader'
import { PaginationControls } from '@/components/common/PaginationControls'
import {
  ServerDataTable,
  type ServerTableColumn,
} from '@/components/common/ServerDataTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api'
import { categoryService } from '@/services/categoryService'
import { itemService, type ItemListParams } from '@/services/itemService'
import type {
  Category,
  InventoryItem,
  ItemCondition,
  Pagination,
  SortOrder,
} from '@/types/api'
import { formatEnumLabel } from '@/utils/formatEnumLabel'

const emptyPagination: Pagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
}

const conditions: ItemCondition[] = ['GOOD', 'FAIR', 'DAMAGED', 'UNDER_REPAIR', 'LOST']

function conditionTone(condition: ItemCondition) {
  if (condition === 'GOOD') return 'success' as const
  if (condition === 'FAIR' || condition === 'UNDER_REPAIR') return 'warning' as const
  return 'danger' as const
}

export function InventoryPage() {
  const { user } = useAuth()
  const { notify } = useToast()
  const isAdmin = user?.role === 'SUPER_ADMIN'
  const [items, setItems] = useState<InventoryItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [pagination, setPagination] = useState(emptyPagination)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [categoryId, setCategoryId] = useState('')
  const [condition, setCondition] = useState('')
  const [activeFilter, setActiveFilter] = useState(isAdmin ? '' : 'true')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<ItemListParams['sortBy']>('itemName')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [pendingItem, setPendingItem] = useState<InventoryItem | null>(null)
  const [isMutating, setIsMutating] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    Promise.all([
      itemService.list(
        {
          search: debouncedSearch || undefined,
          categoryId: categoryId || undefined,
          condition: (condition || undefined) as ItemCondition | undefined,
          isActive: activeFilter ? activeFilter === 'true' : undefined,
          page,
          limit: 10,
          sortBy,
          sortOrder,
        },
        controller.signal,
      ),
      categoryService.list(isAdmin ? undefined : true, controller.signal),
    ])
      .then(([itemResult, categoryResult]) => {
        setItems(itemResult.items)
        setPagination(itemResult.pagination)
        setCategories(categoryResult)
        setError(null)
      })
      .catch((requestError: unknown) => {
        if (!axios.isCancel(requestError)) {
          setError(getApiErrorMessage(requestError, 'Inventory could not be loaded.'))
        }
      })
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [activeFilter, categoryId, condition, debouncedSearch, isAdmin, page, reloadKey, sortBy, sortOrder])

  function refreshInventory() {
    setIsLoading(true)
    setReloadKey((key) => key + 1)
  }

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value)
    setPage(1)
    setIsLoading(true)
  }

  async function confirmDeactivation() {
    if (!pendingItem) {
      return
    }

    setIsMutating(true)

    try {
      const response = await itemService.deactivate(pendingItem.id)
      notify({ title: response.message ?? 'Inventory item deactivated.' })
      setPendingItem(null)
      refreshInventory()
    } catch (mutationError) {
      notify({
        title: 'Inventory item was not deactivated.',
        description: getApiErrorMessage(mutationError, 'Please try again.'),
        tone: 'error',
      })
    } finally {
      setIsMutating(false)
    }
  }

  async function activateItem(item: InventoryItem) {
    setIsMutating(true)

    try {
      const response = await itemService.update(item.id, { isActive: true })
      notify({ title: response.message ?? 'Inventory item activated.' })
      refreshInventory()
    } catch (mutationError) {
      notify({
        title: 'Inventory item was not activated.',
        description: getApiErrorMessage(mutationError, 'Please try again.'),
        tone: 'error',
      })
    } finally {
      setIsMutating(false)
    }
  }

  function clearFilters() {
    setSearch('')
    setCategoryId('')
    setCondition('')
    setActiveFilter(isAdmin ? '' : 'true')
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
    ...(categoryId
      ? [{
          key: 'category',
          label: `Category: ${categories.find((category) => category.id === categoryId)?.name ?? 'Selected'}`,
          onRemove: () => updateFilter(setCategoryId, ''),
        }]
      : []),
    ...(condition
      ? [{
          key: 'condition',
          label: `Condition: ${formatEnumLabel(condition)}`,
          onRemove: () => updateFilter(setCondition, ''),
        }]
      : []),
    ...(isAdmin && activeFilter
      ? [{
          key: 'status',
          label: activeFilter === 'true' ? 'Record: Active' : 'Record: Inactive',
          onRemove: () => updateFilter(setActiveFilter, ''),
        }]
      : []),
  ]

  const columns: ServerTableColumn<InventoryItem>[] = [
    {
      key: 'item',
      label: 'Item',
      sortKey: 'itemName',
      render: (item) => (
        <div>
          <p className="font-medium text-foreground">{item.itemName}</p>
          <p className="text-xs text-muted-foreground">{item.itemCode}</p>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (item) => item.category.name,
    },
    {
      key: 'quantity',
      label: 'Available',
      sortKey: 'availableQuantity',
      render: (item) => (
        <span className="tabular-nums">
          {item.availableQuantity} / {item.totalQuantity}
        </span>
      ),
    },
    {
      key: 'condition',
      label: 'Condition',
      render: (item) => (
        <StatusBadge
          label={formatEnumLabel(item.condition)}
          tone={conditionTone(item.condition)}
        />
      ),
    },
    {
      key: 'status',
      label: 'Availability',
      render: (item) =>
        item.isActive ? (
          <StatusBadge
            label={item.availableQuantity > 0 ? 'Available' : 'Checked out'}
            tone={item.availableQuantity > 0 ? 'success' : 'warning'}
          />
        ) : (
          <StatusBadge label="Inactive record" tone="inactive" />
        ),
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'w-28',
      render: (item) => (
        <div className="inline-flex min-w-10 items-center justify-center gap-1">
          <ActionTooltip label={`View ${item.itemName}`}>
            <Button asChild type="button" variant="ghost" size="icon-sm">
              <Link
                to={`${isAdmin ? '/logistics' : '/committee'}/inventory/${item.id}`}
                aria-label={`View ${item.itemName}`}
              >
                <Eye aria-hidden="true" />
              </Link>
            </Button>
          </ActionTooltip>
          {isAdmin ? (
            <>
              <ActionTooltip label={`Edit ${item.itemName}`}>
                <Button
                  asChild
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                >
                  <Link
                    to={`/logistics/inventory/${item.id}/edit`}
                    aria-label={`Edit ${item.itemName}`}
                  >
                    <Pencil aria-hidden="true" />
                  </Link>
                </Button>
              </ActionTooltip>
              {item.isActive ? (
                <ActionTooltip label={`Deactivate ${item.itemName}`}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Deactivate ${item.itemName}`}
                    onClick={() => setPendingItem(item)}
                    disabled={isMutating}
                    className="text-destructive hover:text-destructive"
                  >
                    <PowerOff aria-hidden="true" />
                  </Button>
                </ActionTooltip>
              ) : (
                <ActionTooltip label={`Activate ${item.itemName}`}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Activate ${item.itemName}`}
                    onClick={() => void activateItem(item)}
                    disabled={isMutating}
                  >
                    <Power aria-hidden="true" />
                  </Button>
                </ActionTooltip>
              )}
            </>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAdmin ? 'Inventory Management' : 'Inventory'}
        description={
          isAdmin
            ? 'Search, maintain, and monitor ECA inventory records.'
            : 'Browse active ECA equipment and current availability.'
        }
        actions={
          isAdmin ? (
            <Button asChild>
              <Link to="/logistics/inventory/new">
                <Plus aria-hidden="true" />
                Add inventory item
              </Link>
            </Button>
          ) : undefined
        }
      />
      <Card className="gap-0 py-0">
        <CardContent className="grid gap-3 border-b p-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="inventory-search">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="inventory-search"
                value={search}
                onChange={(event) => updateFilter(setSearch, event.target.value)}
                placeholder="Name or item code"
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <AppSelect
              value={categoryId}
              onValueChange={(value) => updateFilter(setCategoryId, value)}
              ariaLabel="Filter by category"
              emptyLabel="All categories"
              options={categories.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Condition</Label>
            <AppSelect
              value={condition}
              onValueChange={(value) => updateFilter(setCondition, value)}
              ariaLabel="Filter by condition"
              emptyLabel="All conditions"
              options={conditions.map((value) => ({
                value,
                label: formatEnumLabel(value),
              }))}
            />
          </div>
          {isAdmin ? (
            <div className="space-y-1.5">
              <Label>Record status</Label>
              <AppSelect
                value={activeFilter}
                onValueChange={(value) => updateFilter(setActiveFilter, value)}
                ariaLabel="Filter by record status"
                emptyLabel="All records"
                options={[
                  { value: 'true', label: 'Active' },
                  { value: 'false', label: 'Inactive' },
                ]}
              />
            </div>
          ) : null}
        </CardContent>
        <FilterSummary
          filters={activeFilters}
          resultCount={pagination.total}
          resultLabel={pagination.total === 1 ? 'item' : 'items'}
          onClear={clearFilters}
        />
        <ServerDataTable
          rows={items}
          columns={columns}
          getRowKey={(item) => item.id}
          isLoading={isLoading}
          error={error}
          emptyTitle="No inventory items found"
          emptyDescription="Try changing the search or filter options."
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={(nextSortBy, nextSortOrder) => {
            setSortBy(nextSortBy as ItemListParams['sortBy'])
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
      <ConfirmationDialog
        open={pendingItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingItem(null)
          }
        }}
        title="Deactivate inventory item?"
        description={`${
          pendingItem?.itemName ?? 'This item'
        } will no longer be available for new borrowing requests.`}
        confirmLabel="Deactivate item"
        destructive
        isPending={isMutating}
        onConfirm={() => void confirmDeactivation()}
      />
    </div>
  )
}
