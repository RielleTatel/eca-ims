import axios from 'axios'
import { LoaderCircle, Pencil, Plus, Power, PowerOff, Search } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { ActionTooltip } from '@/components/common/ActionTooltip'
import { AppSelect } from '@/components/common/AppSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { PaginationControls } from '@/components/common/PaginationControls'
import { ServerDataTable, type ServerTableColumn } from '@/components/common/ServerDataTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api'
import { categoryService } from '@/services/categoryService'
import type { Category, Pagination, SortOrder } from '@/types/api'

const pageSize = 10

export function CategoriesPage() {
  const { notify } = useToast()
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingCategory, setPendingCategory] = useState<Category | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    categoryService
      .list(undefined, controller.signal)
      .then((result) => {
        setCategories(result)
        setError(null)
      })
      .catch((requestError: unknown) => {
        if (!axios.isCancel(requestError)) {
          setError(getApiErrorMessage(requestError, 'Categories could not be loaded.'))
        }
      })
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [reloadKey])

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase()
    return categories
      .filter((category) => {
        const matchesSearch =
          !query ||
          category.name.toLowerCase().includes(query) ||
          category.description?.toLowerCase().includes(query)
        const matchesStatus =
          !statusFilter || category.isActive === (statusFilter === 'active')
        return matchesSearch && matchesStatus
      })
      .sort((left, right) => {
        const comparison =
          sortBy === 'updatedAt'
            ? new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()
            : left.name.localeCompare(right.name)
        return sortOrder === 'asc' ? comparison : -comparison
      })
  }, [categories, search, sortBy, sortOrder, statusFilter])

  const totalPages = Math.ceil(filteredCategories.length / pageSize)
  const visibleCategories = filteredCategories.slice((page - 1) * pageSize, page * pageSize)
  const pagination: Pagination = {
    page,
    limit: pageSize,
    total: filteredCategories.length,
    totalPages,
  }

  function openCreateDialog() {
    setEditingCategory(null)
    setName('')
    setDescription('')
    setFormError(null)
    setDialogOpen(true)
  }

  function openEditDialog(category: Category) {
    setEditingCategory(category)
    setName(category.name)
    setDescription(category.description ?? '')
    setFormError(null)
    setDialogOpen(true)
  }

  function refreshCategories() {
    setIsLoading(true)
    setReloadKey((key) => key + 1)
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSaving || name.trim().length < 2) {
      setFormError('Category name must contain at least 2 characters.')
      return
    }

    setIsSaving(true)
    setFormError(null)

    try {
      const response = editingCategory
        ? await categoryService.update(editingCategory.id, {
            name: name.trim(),
            description: description.trim() || null,
          })
        : await categoryService.create({
            name: name.trim(),
            description: description.trim() || null,
          })
      notify({ title: response.message ?? `Category ${editingCategory ? 'updated' : 'created'}.` })
      setDialogOpen(false)
      refreshCategories()
    } catch (saveError) {
      const message = getApiErrorMessage(saveError, 'Category could not be saved.')
      setFormError(message)
      notify({ title: 'Category was not saved.', description: message, tone: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmDeactivation() {
    if (!pendingCategory) {
      return
    }

    setIsSaving(true)

    try {
      const response = await categoryService.deactivate(pendingCategory.id)
      notify({ title: response.message ?? 'Category deactivated.' })
      setPendingCategory(null)
      refreshCategories()
    } catch (mutationError) {
      notify({
        title: 'Category was not deactivated.',
        description: getApiErrorMessage(mutationError, 'Please try again.'),
        tone: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function activateCategory(category: Category) {
    setIsSaving(true)

    try {
      const response = await categoryService.update(category.id, { isActive: true })
      notify({ title: response.message ?? 'Category activated.' })
      refreshCategories()
    } catch (mutationError) {
      notify({
        title: 'Category was not activated.',
        description: getApiErrorMessage(mutationError, 'Please try again.'),
        tone: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const columns: ServerTableColumn<Category>[] = [
    {
      key: 'name',
      label: 'Category',
      sortKey: 'name',
      render: (category) => (
        <div>
          <p className="font-medium">{category.name}</p>
          <p className="max-w-md truncate text-xs text-muted-foreground">
            {category.description || 'No description'}
          </p>
        </div>
      ),
    },
    {
      key: 'updated',
      label: 'Last updated',
      sortKey: 'updatedAt',
      render: (category) => new Date(category.updatedAt).toLocaleDateString(),
    },
    {
      key: 'status',
      label: 'Status',
      render: (category) => (
        <StatusBadge
          label={category.isActive ? 'Active' : 'Inactive'}
          tone={category.isActive ? 'success' : 'inactive'}
        />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'w-20',
      render: (category) => (
        <div className="inline-flex min-w-20 items-center justify-center gap-1">
          <ActionTooltip label={`Edit ${category.name}`}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${category.name}`}
              onClick={() => openEditDialog(category)}
            >
              <Pencil aria-hidden="true" />
            </Button>
          </ActionTooltip>
          {category.isActive ? (
            <ActionTooltip label={`Deactivate ${category.name}`}>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Deactivate ${category.name}`}
                onClick={() => setPendingCategory(category)}
                className="text-destructive hover:text-destructive"
              >
                <PowerOff aria-hidden="true" />
              </Button>
            </ActionTooltip>
          ) : (
            <ActionTooltip label={`Activate ${category.name}`}>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Activate ${category.name}`}
                onClick={() => void activateCategory(category)}
              >
                <Power aria-hidden="true" />
              </Button>
            </ActionTooltip>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Categories"
        description="Organize inventory items with backend-validated ECA categories."
        actions={
          <Button type="button" onClick={openCreateDialog}>
            <Plus aria-hidden="true" />
            Add category
          </Button>
        }
      />
      <Card className="gap-0 py-0">
        <CardContent className="grid gap-3 border-b p-4 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search categories…"
              aria-label="Search categories"
              className="pl-9"
            />
          </div>
          <AppSelect
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value)
              setPage(1)
            }}
            ariaLabel="Filter category status"
            emptyLabel="All statuses"
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </CardContent>
        <ServerDataTable
          rows={visibleCategories}
          columns={columns}
          getRowKey={(category) => category.id}
          isLoading={isLoading}
          error={error}
          emptyTitle="No categories found"
          emptyDescription="Create a category or change the current filters."
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={(nextSortBy, nextSortOrder) => {
            setSortBy(nextSortBy)
            setSortOrder(nextSortOrder)
            setPage(1)
          }}
        />
        {!error && !isLoading ? (
          <PaginationControls pagination={pagination} onPageChange={setPage} />
        ) : null}
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={saveCategory}>
            <DialogHeader>
              <DialogTitle>{editingCategory ? 'Edit category' : 'Add category'}</DialogTitle>
              <DialogDescription>
                Category names must be unique and contain at least two characters.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-5">
              {formError ? <p className="text-sm text-destructive" role="alert">{formError}</p> : null}
              <div className="space-y-2">
                <Label htmlFor="category-name">Name *</Label>
                <Input
                  id="category-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={isSaving}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-description">Description</Label>
                <textarea
                  id="category-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={isSaving}
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
                {isSaving ? 'Saving…' : 'Save category'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmationDialog
        open={pendingCategory !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingCategory(null)
          }
        }}
        title="Deactivate category?"
        description={`${pendingCategory?.name ?? 'This category'} can only be deactivated when no active inventory item uses it.`}
        confirmLabel="Deactivate category"
        destructive
        isPending={isSaving}
        onConfirm={() => void confirmDeactivation()}
      />
    </div>
  )
}
