import axios from 'axios'
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  LoaderCircle,
  Minus,
  Plus,
  Search,
  Send,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { PageHeader } from '@/components/common/PageHeader'
import { ActionTooltip } from '@/components/common/ActionTooltip'
import { PaginationControls } from '@/components/common/PaginationControls'
import { ServerDataTable, type ServerTableColumn } from '@/components/common/ServerDataTable'
import { InlineError } from '@/components/states/InlineError'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api'
import { itemService, type ItemListParams } from '@/services/itemService'
import { requestService } from '@/services/requestService'
import type { InventoryItem, Pagination, SortOrder } from '@/types/api'

interface SelectedItem {
  item: InventoryItem
  quantity: number
}

type RequestStep = 1 | 2 | 3

const steps: Array<{ id: RequestStep; label: string; description: string }> = [
  { id: 1, label: 'Select items', description: 'Choose available inventory' },
  { id: 2, label: 'Request details', description: 'Requester and schedule' },
  { id: 3, label: 'Review', description: 'Confirm before submitting' },
]

const emptyPagination: Pagination = { page: 1, limit: 10, total: 0, totalPages: 0 }

function formatDisplayDate(value: string) {
  return value
    ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Not provided'
}

export function CreateRequestPage() {
  const navigate = useNavigate()
  const { notify } = useToast()
  const [activeStep, setActiveStep] = useState<RequestStep>(1)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [inventorySearch, setInventorySearch] = useState('')
  const debouncedSearch = useDebouncedValue(inventorySearch)
  const [inventoryPagination, setInventoryPagination] = useState(emptyPagination)
  const [inventoryPage, setInventoryPage] = useState(1)
  const [inventorySortBy, setInventorySortBy] =
    useState<ItemListParams['sortBy']>('itemName')
  const [inventorySortOrder, setInventorySortOrder] = useState<SortOrder>('asc')
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [requesterName, setRequesterName] = useState('')
  const [requesterPosition, setRequesterPosition] = useState('')
  const [purpose, setPurpose] = useState('')
  const [borrowDate, setBorrowDate] = useState('')
  const [expectedReturnDate, setExpectedReturnDate] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [isLoadingItems, setIsLoadingItems] = useState(true)
  const [inventoryError, setInventoryError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    itemService
      .list(
        {
          search: debouncedSearch || undefined,
          isActive: true,
          availableOnly: true,
          page: inventoryPage,
          limit: 10,
          sortBy: inventorySortBy,
          sortOrder: inventorySortOrder,
        },
        controller.signal,
      )
      .then((result) => {
        setInventory(result.items)
        setInventoryPagination(result.pagination)
        setInventoryError(null)
      })
      .catch((requestError: unknown) => {
        if (!axios.isCancel(requestError)) {
          setInventoryError(getApiErrorMessage(requestError, 'Available inventory could not be loaded.'))
        }
      })
      .finally(() => setIsLoadingItems(false))

    return () => controller.abort()
  }, [debouncedSearch, inventoryPage, inventorySortBy, inventorySortOrder])

  function showStep(step: RequestStep) {
    setActiveStep(step)
    setFormError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function addItem(item: InventoryItem) {
    if (selectedItems.some((selection) => selection.item.id === item.id)) {
      return
    }
    setSelectedItems((current) => [...current, { item, quantity: 1 }])
    setFormError(null)
  }

  function removeItem(itemId: string) {
    setSelectedItems((current) => current.filter((selection) => selection.item.id !== itemId))
  }

  function updateQuantity(itemId: string, quantity: number) {
    setSelectedItems((current) =>
      current.map((selection) =>
        selection.item.id === itemId
          ? {
              ...selection,
              quantity: Math.max(1, Math.min(quantity, selection.item.availableQuantity)),
            }
          : selection,
      ),
    )
  }

  function continueToDetails() {
    if (selectedItems.length === 0) {
      setFormError('Select at least one inventory item to continue.')
      return
    }
    showStep(2)
  }

  function detailsAreValid() {
    if (
      requesterName.trim().length < 2 ||
      requesterPosition.trim().length < 2 ||
      purpose.trim().length < 5 ||
      !borrowDate ||
      !expectedReturnDate ||
      expectedReturnDate < borrowDate
    ) {
      setFormError('Complete the requester details, purpose, and valid borrowing dates.')
      return false
    }
    return true
  }

  function continueToReview() {
    if (detailsAreValid()) {
      showStep(3)
    }
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (activeStep === 1) {
      continueToDetails()
      return
    }

    if (activeStep === 2) {
      continueToReview()
      return
    }

    if (isSubmitting || !detailsAreValid() || selectedItems.length === 0) {
      return
    }

    setIsSubmitting(true)
    setFormError(null)

    try {
      const response = await requestService.create({
        requesterName: requesterName.trim(),
        requesterPosition: requesterPosition.trim(),
        purpose: purpose.trim(),
        borrowDate,
        expectedReturnDate,
        additionalNotes: additionalNotes.trim() || null,
        items: selectedItems.map((selection) => ({
          itemId: selection.item.id,
          quantity: selection.quantity,
        })),
      })
      notify({ title: response.message ?? 'Borrow request submitted.' })
      navigate(`/committee/requests/${response.data.request.id}`, { replace: true })
    } catch (submitError) {
      const message = getApiErrorMessage(submitError, 'Borrowing request could not be submitted.')
      setFormError(message)
      notify({ title: 'Borrow request was not submitted.', description: message, tone: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const inventoryColumns: ServerTableColumn<InventoryItem>[] = [
    {
      key: 'item',
      label: 'Item',
      sortKey: 'itemName',
      render: (item) => (
        <div>
          <p className="font-medium">{item.itemName}</p>
          <p className="text-xs text-muted-foreground">{item.itemCode} · {item.category.name}</p>
        </div>
      ),
    },
    {
      key: 'available',
      label: 'Available',
      sortKey: 'availableQuantity',
      render: (item) => <span className="tabular-nums">{item.availableQuantity}</span>,
    },
    {
      key: 'action',
      label: 'Action',
      className: 'w-16',
      render: (item) => {
        const selected = selectedItems.some((selection) => selection.item.id === item.id)
        return (
          <div className="inline-flex min-w-10 items-center justify-center">
            <ActionTooltip label={selected ? `${item.itemName} selected` : `Add ${item.itemName}`}>
              <Button
                type="button"
                variant={selected ? 'secondary' : 'ghost'}
                size="icon-sm"
                aria-label={selected ? `${item.itemName} selected` : `Add ${item.itemName}`}
                onClick={() => addItem(item)}
                disabled={selected}
              >
                {selected ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
              </Button>
            </ActionTooltip>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Borrowing Request"
        description="Build and review your request in three short steps."
        actions={
          <Button asChild variant="outline">
            <Link to="/committee/requests/history">
              <ArrowLeft aria-hidden="true" />
              Back to requests
            </Link>
          </Button>
        }
      />

      <nav aria-label="Borrowing request progress">
        <ol className="grid gap-2 rounded-xl bg-muted/60 p-1.5 sm:grid-cols-3">
          {steps.map((step) => {
            const isActive = step.id === activeStep
            const isComplete = step.id < activeStep
            return (
              <li
                key={step.id}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-3',
                  isActive && 'bg-background shadow-sm ring-1 ring-foreground/10',
                )}
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                    isActive && 'border-primary bg-primary text-primary-foreground',
                    isComplete && 'border-success bg-success text-success-foreground',
                    !isActive && !isComplete && 'border-border bg-background text-muted-foreground',
                  )}
                >
                  {isComplete ? <Check className="size-4" aria-hidden="true" /> : step.id}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{step.label}</span>
                  <span className="hidden truncate text-xs text-muted-foreground lg:block">
                    {step.description}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      </nav>

      <form onSubmit={submitRequest} className="space-y-6">
        {formError ? <InlineError message={formError} /> : null}

        {activeStep === 1 ? (
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(19rem,0.8fr)]">
            <Card className="gap-0 py-0">
              <CardHeader className="border-b py-5">
                <CardTitle>Available inventory</CardTitle>
              </CardHeader>
              <CardContent className="border-b p-4">
                <Label htmlFor="request-inventory-search" className="sr-only">
                  Search available inventory
                </Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="request-inventory-search"
                    value={inventorySearch}
                    onChange={(event) => {
                      setInventorySearch(event.target.value)
                      setInventoryPage(1)
                      setIsLoadingItems(true)
                    }}
                    placeholder="Search by item name or code…"
                    className="pl-9"
                  />
                </div>
              </CardContent>
              <ServerDataTable
                rows={inventory}
                columns={inventoryColumns}
                getRowKey={(item) => item.id}
                isLoading={isLoadingItems}
                error={inventoryError}
                emptyTitle="No available inventory"
                emptyDescription="Try a different search or check back later."
                sortBy={inventorySortBy}
                sortOrder={inventorySortOrder}
                onSort={(nextSortBy, nextSortOrder) => {
                  setInventorySortBy(nextSortBy as ItemListParams['sortBy'])
                  setInventorySortOrder(nextSortOrder)
                  setInventoryPage(1)
                  setIsLoadingItems(true)
                }}
              />
              {!inventoryError && !isLoadingItems ? (
                <PaginationControls
                  pagination={inventoryPagination}
                  onPageChange={(nextPage) => {
                    setInventoryPage(nextPage)
                    setIsLoadingItems(true)
                  }}
                />
              ) : null}
            </Card>

            <Card className="xl:sticky xl:top-24">
              <CardHeader>
                <CardTitle>Selected items ({selectedItems.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedItems.length === 0 ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    Add at least one item from the inventory list.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {selectedItems.map((selection) => (
                      <div key={selection.item.id} className="rounded-lg border p-3">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{selection.item.itemName}</p>
                            <p className="text-xs text-muted-foreground">
                              {selection.item.itemCode} · {selection.item.availableQuantity} available
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeItem(selection.item.id)}
                            aria-label={`Remove ${selection.item.itemName}`}
                          >
                            <Minus aria-hidden="true" />
                          </Button>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <Label htmlFor={`quantity-${selection.item.id}`} className="text-xs">
                            Quantity
                          </Label>
                          <Input
                            id={`quantity-${selection.item.id}`}
                            type="number"
                            min={1}
                            max={selection.item.availableQuantity}
                            value={selection.quantity}
                            onChange={(event) => updateQuantity(selection.item.id, Number(event.target.value))}
                            className="h-9 w-24"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t pt-6">
                <Button type="button" className="w-full" onClick={continueToDetails}>
                  Continue to details
                  <ChevronRight aria-hidden="true" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        ) : null}

        {activeStep === 2 ? (
          <Card>
            <CardHeader>
              <CardTitle>Requester and schedule</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="requester-name">Requester name *</Label>
                <Input
                  id="requester-name"
                  value={requesterName}
                  onChange={(event) => setRequesterName(event.target.value)}
                  disabled={isSubmitting}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requester-position">Position *</Label>
                <Input
                  id="requester-position"
                  value={requesterPosition}
                  onChange={(event) => setRequesterPosition(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="borrow-date">Borrow date *</Label>
                <Input
                  id="borrow-date"
                  type="date"
                  value={borrowDate}
                  onChange={(event) => setBorrowDate(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="return-date">Expected return date *</Label>
                <Input
                  id="return-date"
                  type="date"
                  min={borrowDate || undefined}
                  value={expectedReturnDate}
                  onChange={(event) => setExpectedReturnDate(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="request-purpose">Purpose *</Label>
                <textarea
                  id="request-purpose"
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                  disabled={isSubmitting}
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="request-notes">Additional notes</Label>
                <textarea
                  id="request-notes"
                  value={additionalNotes}
                  onChange={(event) => setAdditionalNotes(event.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
            </CardContent>
            <CardFooter className="flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" onClick={() => showStep(1)}>
                <ChevronLeft aria-hidden="true" />
                Back to items
              </Button>
              <Button type="button" onClick={continueToReview}>
                Review request
                <ChevronRight aria-hidden="true" />
              </Button>
            </CardFooter>
          </Card>
        ) : null}

        {activeStep === 3 ? (
          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ClipboardCheck className="size-5" aria-hidden="true" />
              </span>
              <div>
                <CardTitle>Review your request</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Confirm these details before submitting.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <dl className="grid gap-4 rounded-xl border bg-muted/30 p-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requester</dt>
                  <dd className="mt-1 font-medium">{requesterName}</dd>
                  <dd className="text-sm text-muted-foreground">{requesterPosition}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Borrow period</dt>
                  <dd className="mt-1 font-medium">
                    {formatDisplayDate(borrowDate)} – {formatDisplayDate(expectedReturnDate)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Purpose</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm leading-6">{purpose}</dd>
                </div>
                {additionalNotes ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Additional notes</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm leading-6">{additionalNotes}</dd>
                  </div>
                ) : null}
              </dl>

              <div>
                <h2 className="font-heading text-base font-semibold">
                  Requested items ({selectedItems.length})
                </h2>
                <div className="mt-3 divide-y rounded-xl border">
                  {selectedItems.map((selection) => (
                    <div key={selection.item.id} className="flex items-center justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <p className="font-medium">{selection.item.itemName}</p>
                        <p className="text-xs text-muted-foreground">
                          {selection.item.itemCode} · {selection.item.category.name}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm">
                        Qty <span className="font-semibold tabular-nums">{selection.quantity}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" onClick={() => showStep(2)} disabled={isSubmitting}>
                <ChevronLeft aria-hidden="true" />
                Edit details
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                {isSubmitting ? 'Submitting…' : 'Submit request'}
              </Button>
            </CardFooter>
          </Card>
        ) : null}
      </form>
    </div>
  )
}
