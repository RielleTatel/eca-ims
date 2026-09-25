import { KeyRound, LoaderCircle, Pencil, Plus, Power, PowerOff, Search } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import axios from 'axios'

import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { ActionTooltip } from '@/components/common/ActionTooltip'
import { AppSelect } from '@/components/common/AppSelect'
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
import { committeeAccountService } from '@/services/committeeAccountService'
import type { Committee, CommitteeAccount, Pagination, SortOrder } from '@/types/api'

interface CommitteeAccountsPanelProps {
  committees: Committee[]
}

type AccountDialogMode = 'create' | 'edit' | 'reset' | null

const pageSize = 8

export function CommitteeAccountsPanel({ committees }: CommitteeAccountsPanelProps) {
  const { notify } = useToast()
  const [accounts, setAccounts] = useState<CommitteeAccount[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [dialogMode, setDialogMode] = useState<AccountDialogMode>(null)
  const [selectedAccount, setSelectedAccount] = useState<CommitteeAccount | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [committeeId, setCommitteeId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingAccount, setPendingAccount] = useState<CommitteeAccount | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    committeeAccountService
      .list(controller.signal)
      .then((result) => {
        setAccounts(result)
        setError(null)
      })
      .catch((requestError: unknown) => {
        if (!axios.isCancel(requestError)) {
          setError(getApiErrorMessage(requestError, 'Committee accounts could not be loaded.'))
        }
      })
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [reloadKey])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return accounts
      .filter(
        (account) =>
          !query ||
          account.username.toLowerCase().includes(query) ||
          account.committee?.name.toLowerCase().includes(query),
      )
      .sort((left, right) => {
        const comparison = left.username.localeCompare(right.username)
        return sortOrder === 'asc' ? comparison : -comparison
      })
  }, [accounts, search, sortOrder])

  const pagination: Pagination = {
    page,
    limit: pageSize,
    total: filtered.length,
    totalPages: Math.ceil(filtered.length / pageSize),
  }
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)
  const assignedCommitteeIds = new Set(accounts.map((account) => account.committee?.id).filter(Boolean))
  const availableCommittees = committees.filter(
    (committee) => committee.isActive && !assignedCommitteeIds.has(committee.id),
  )

  function refreshAccounts() {
    setIsLoading(true)
    setReloadKey((key) => key + 1)
  }

  function openDialog(mode: Exclude<AccountDialogMode, null>, account?: CommitteeAccount) {
    setDialogMode(mode)
    setSelectedAccount(account ?? null)
    setUsername(account?.username ?? '')
    setPassword('')
    setCommitteeId(availableCommittees[0]?.id ?? '')
    setFormError(null)
  }

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSaving || !dialogMode) {
      return
    }

    if (dialogMode === 'create' && (!username.trim() || password.length < 12 || !committeeId)) {
      setFormError('Enter a username, a password of at least 12 characters, and a committee.')
      return
    }

    if (dialogMode === 'edit' && !username.trim()) {
      setFormError('Username is required.')
      return
    }

    if (dialogMode === 'reset' && password.length < 12) {
      setFormError('New password must contain at least 12 characters.')
      return
    }

    setIsSaving(true)
    setFormError(null)

    try {
      let response

      if (dialogMode === 'create') {
        response = await committeeAccountService.create({
          username: username.trim(),
          password,
          committeeId,
        })
      } else if (dialogMode === 'edit' && selectedAccount) {
        response = await committeeAccountService.update(selectedAccount.id, username.trim())
      } else if (dialogMode === 'reset' && selectedAccount) {
        response = await committeeAccountService.resetPassword(selectedAccount.id, password)
      } else {
        throw new Error('Committee account action is incomplete.')
      }

      notify({ title: response.message ?? 'Committee account updated.' })
      setDialogMode(null)
      refreshAccounts()
    } catch (saveError) {
      const message = getApiErrorMessage(saveError, 'Committee account could not be updated.')
      setFormError(message)
      notify({ title: 'Committee account action failed.', description: message, tone: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  async function deactivateAccount() {
    if (!pendingAccount) {
      return
    }

    setIsSaving(true)

    try {
      const response = await committeeAccountService.updateStatus(pendingAccount.id, false)
      notify({ title: response.message ?? 'Committee account deactivated.' })
      setPendingAccount(null)
      refreshAccounts()
    } catch (mutationError) {
      notify({
        title: 'Committee account was not deactivated.',
        description: getApiErrorMessage(mutationError, 'Please try again.'),
        tone: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function activateAccount(account: CommitteeAccount) {
    setIsSaving(true)

    try {
      const response = await committeeAccountService.updateStatus(account.id, true)
      notify({ title: response.message ?? 'Committee account activated.' })
      refreshAccounts()
    } catch (mutationError) {
      notify({
        title: 'Committee account was not activated.',
        description: getApiErrorMessage(mutationError, 'Please try again.'),
        tone: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const columns: ServerTableColumn<CommitteeAccount>[] = [
    {
      key: 'username',
      label: 'Username',
      sortKey: 'username',
      render: (account) => <span className="font-medium">{account.username}</span>,
    },
    {
      key: 'committee',
      label: 'Committee',
      render: (account) => account.committee?.name ?? 'Not linked',
    },
    {
      key: 'status',
      label: 'Status',
      render: (account) => (
        <StatusBadge
          label={account.isActive ? 'Active' : 'Inactive'}
          tone={account.isActive ? 'success' : 'inactive'}
        />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'w-28',
      render: (account) => (
        <div className="inline-flex min-w-28 items-center justify-center gap-1">
          <ActionTooltip label={`Edit ${account.username}`}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${account.username}`}
              onClick={() => openDialog('edit', account)}
            >
              <Pencil aria-hidden="true" />
            </Button>
          </ActionTooltip>
          <ActionTooltip label={`Reset password for ${account.username}`}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Reset password for ${account.username}`}
              onClick={() => openDialog('reset', account)}
            >
              <KeyRound aria-hidden="true" />
            </Button>
          </ActionTooltip>
          {account.isActive ? (
            <ActionTooltip label={`Deactivate ${account.username}`}>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Deactivate ${account.username}`}
                onClick={() => setPendingAccount(account)}
                className="text-destructive hover:text-destructive"
              >
                <PowerOff aria-hidden="true" />
              </Button>
            </ActionTooltip>
          ) : (
            <ActionTooltip label={`Activate ${account.username}`}>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Activate ${account.username}`}
                onClick={() => void activateAccount(account)}
              >
                <Power aria-hidden="true" />
              </Button>
            </ActionTooltip>
          )}
        </div>
      ),
    },
  ]

  const dialogTitle =
    dialogMode === 'create'
      ? 'Create committee account'
      : dialogMode === 'edit'
        ? 'Edit committee account'
        : 'Reset committee account password'

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center justify-between border-b py-5">
        <CardTitle>Committee Accounts</CardTitle>
        <Button type="button" size="sm" onClick={() => openDialog('create')} disabled={availableCommittees.length === 0}>
          <Plus aria-hidden="true" />
          Add account
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
            placeholder="Search accounts…"
            aria-label="Search committee accounts"
            className="pl-9"
          />
        </div>
      </CardContent>
      <ServerDataTable
        rows={visible}
        columns={columns}
        getRowKey={(account) => account.id}
        isLoading={isLoading}
        error={error}
        emptyTitle="No committee accounts found"
        emptyDescription="Create an account for an active committee without one."
        sortBy="username"
        sortOrder={sortOrder}
        onSort={(_, nextOrder) => {
          setSortOrder(nextOrder)
          setPage(1)
        }}
      />
      {!error && !isLoading ? <PaginationControls pagination={pagination} onPageChange={setPage} /> : null}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent>
          <form onSubmit={submitAccount}>
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
              <DialogDescription>
                Passwords are submitted securely and are never returned by the backend.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-5">
              {formError ? <p className="text-sm text-destructive" role="alert">{formError}</p> : null}
              {dialogMode !== 'reset' ? (
                <div className="space-y-2">
                  <Label htmlFor="account-username">Username *</Label>
                  <Input id="account-username" value={username} onChange={(event) => setUsername(event.target.value)} disabled={isSaving} required autoFocus />
                </div>
              ) : null}
              {dialogMode === 'create' ? (
                <div className="space-y-2">
                  <Label htmlFor="account-committee">Committee *</Label>
                  <AppSelect
                    id="account-committee"
                    value={committeeId}
                    onValueChange={setCommitteeId}
                    disabled={isSaving}
                    ariaLabel="Select committee"
                    emptyLabel="Select a committee"
                    allowEmpty={false}
                    options={availableCommittees.map((committee) => ({
                      value: committee.id,
                      label: committee.name,
                    }))}
                  />
                </div>
              ) : null}
              {dialogMode === 'create' || dialogMode === 'reset' ? (
                <div className="space-y-2">
                  <Label htmlFor="account-password">{dialogMode === 'reset' ? 'New password' : 'Temporary password'} *</Label>
                  <Input
                    id="account-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={isSaving}
                    minLength={12}
                    autoComplete="new-password"
                    required
                  />
                  <p className="text-xs text-muted-foreground">Use at least 12 characters.</p>
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogMode(null)} disabled={isSaving}>Cancel</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
                {isSaving ? 'Saving…' : dialogMode === 'reset' ? 'Reset password' : 'Save account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmationDialog
        open={pendingAccount !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAccount(null)
        }}
        title="Deactivate committee account?"
        description={`${pendingAccount?.username ?? 'This account'} will no longer be able to sign in.`}
        confirmLabel="Deactivate account"
        destructive
        isPending={isSaving}
        onConfirm={() => void deactivateAccount()}
      />
    </Card>
  )
}
