import { LoaderCircle, Pencil, Plus, Power, PowerOff, Search } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'

import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { ActionTooltip } from '@/components/common/ActionTooltip'
import { PaginationControls } from '@/components/common/PaginationControls'
import { ServerDataTable, type ServerTableColumn } from '@/components/common/ServerDataTable'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { committeeService } from '@/services/committeeService'
import type { Committee, Pagination, SortOrder } from '@/types/api'

interface CommitteesPanelProps {
  committees: Committee[]
  isLoading: boolean
  error: string | null
  onRefresh: () => void
}

const pageSize = 8

export function CommitteesPanel({
  committees,
  isLoading,
  error,
  onRefresh,
}: CommitteesPanelProps) {
  const { notify } = useToast()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCommittee, setEditingCommittee] = useState<Committee | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingCommittee, setPendingCommittee] = useState<Committee | null>(null)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return committees
      .filter(
        (committee) =>
          !query ||
          committee.name.toLowerCase().includes(query) ||
          committee.description?.toLowerCase().includes(query),
      )
      .sort((left, right) => {
        const comparison = left.name.localeCompare(right.name)
        return sortOrder === 'asc' ? comparison : -comparison
      })
  }, [committees, search, sortOrder])

  const pagination: Pagination = {
    page,
    limit: pageSize,
    total: filtered.length,
    totalPages: Math.ceil(filtered.length / pageSize),
  }
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)

  function openForm(committee?: Committee) {
    setEditingCommittee(committee ?? null)
    setName(committee?.name ?? '')
    setDescription(committee?.description ?? '')
    setFormError(null)
    setDialogOpen(true)
  }

  async function saveCommittee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSaving || !name.trim()) {
      setFormError('Committee name is required.')
      return
    }

    setIsSaving(true)
    setFormError(null)

    try {
      const response = editingCommittee
        ? await committeeService.update(editingCommittee.id, {
            name: name.trim(),
            description: description.trim() || null,
          })
        : await committeeService.create({
            name: name.trim(),
            description: description.trim() || null,
          })
      notify({ title: response.message ?? `Committee ${editingCommittee ? 'updated' : 'created'}.` })
      setDialogOpen(false)
      onRefresh()
    } catch (saveError) {
      const message = getApiErrorMessage(saveError, 'Committee could not be saved.')
      setFormError(message)
      notify({ title: 'Committee was not saved.', description: message, tone: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  async function deactivateCommittee() {
    if (!pendingCommittee) {
      return
    }

    setIsSaving(true)

    try {
      const response = await committeeService.deactivate(pendingCommittee.id)
      notify({ title: response.message ?? 'Committee deactivated.' })
      setPendingCommittee(null)
      onRefresh()
    } catch (mutationError) {
      notify({
        title: 'Committee was not deactivated.',
        description: getApiErrorMessage(mutationError, 'Please try again.'),
        tone: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function activateCommittee(committee: Committee) {
    setIsSaving(true)

    try {
      const response = await committeeService.update(committee.id, { isActive: true })
      notify({ title: response.message ?? 'Committee activated.' })
      onRefresh()
    } catch (mutationError) {
      notify({
        title: 'Committee was not activated.',
        description: getApiErrorMessage(mutationError, 'Please try again.'),
        tone: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const columns: ServerTableColumn<Committee>[] = [
    {
      key: 'name',
      label: 'Committee',
      sortKey: 'name',
      render: (committee) => (
        <div>
          <p className="font-medium">{committee.name}</p>
          <p className="max-w-sm truncate text-xs text-muted-foreground">
            {committee.description || 'No description'}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (committee) => (
        <StatusBadge
          label={committee.isActive ? 'Active' : 'Inactive'}
          tone={committee.isActive ? 'success' : 'inactive'}
        />
      ),
    },
    {
      key: 'updated',
      label: 'Updated',
      render: (committee) => new Date(committee.updatedAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'w-20',
      render: (committee) => (
        <div className="inline-flex min-w-20 items-center justify-center gap-1">
          <ActionTooltip label={`Edit ${committee.name}`}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${committee.name}`}
              onClick={() => openForm(committee)}
            >
              <Pencil aria-hidden="true" />
            </Button>
          </ActionTooltip>
          {committee.isActive ? (
            <ActionTooltip label={`Deactivate ${committee.name}`}>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Deactivate ${committee.name}`}
                onClick={() => setPendingCommittee(committee)}
                className="text-destructive hover:text-destructive"
              >
                <PowerOff aria-hidden="true" />
              </Button>
            </ActionTooltip>
          ) : (
            <ActionTooltip label={`Activate ${committee.name}`}>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Activate ${committee.name}`}
                onClick={() => void activateCommittee(committee)}
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
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center justify-between border-b py-5">
        <CardTitle>Committees</CardTitle>
        <Button type="button" size="sm" onClick={() => openForm()}>
          <Plus aria-hidden="true" />
          Add committee
        </Button>
      </CardHeader>
      <CardContent className="border-b p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search committees…"
            aria-label="Search committees"
            className="pl-9"
          />
        </div>
      </CardContent>
      <ServerDataTable
        rows={visible}
        columns={columns}
        getRowKey={(committee) => committee.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="No committees found"
        emptyDescription="Add a committee or change the search."
        sortBy="name"
        sortOrder={sortOrder}
        onSort={(_, nextOrder) => {
          setSortOrder(nextOrder)
          setPage(1)
        }}
      />
      {!error && !isLoading ? <PaginationControls pagination={pagination} onPageChange={setPage} /> : null}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={saveCommittee}>
            <DialogHeader>
              <DialogTitle>{editingCommittee ? 'Edit committee' : 'Add committee'}</DialogTitle>
              <DialogDescription>Committee names must be unique.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-5">
              {formError ? <p className="text-sm text-destructive" role="alert">{formError}</p> : null}
              <div className="space-y-2">
                <Label htmlFor="committee-name">Name *</Label>
                <Input id="committee-name" value={name} onChange={(event) => setName(event.target.value)} disabled={isSaving} required autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="committee-description">Description</Label>
                <textarea
                  id="committee-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={isSaving}
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>Cancel</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
                {isSaving ? 'Saving…' : 'Save committee'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmationDialog
        open={pendingCommittee !== null}
        onOpenChange={(open) => {
          if (!open) setPendingCommittee(null)
        }}
        title="Deactivate committee?"
        description={`${pendingCommittee?.name ?? 'This committee'} and its shared access should no longer be used for new operations.`}
        confirmLabel="Deactivate committee"
        destructive
        isPending={isSaving}
        onConfirm={() => void deactivateCommittee()}
      />
    </Card>
  )
}
