import axios from 'axios'
import { ArrowLeft, Check, LoaderCircle, RotateCcw, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { AppSelect } from '@/components/common/AppSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { FullPageError } from '@/components/states/FullPageError'
import { PageLoading } from '@/components/states/PageLoading'
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
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api'
import { requestService } from '@/services/requestService'
import type {
  BorrowingRequestDetails,
  RequestStatus,
  ReturnCondition,
} from '@/types/api'
import { formatEnumLabel } from '@/utils/formatEnumLabel'

function requestTone(status: RequestStatus) {
  if (status === 'REJECTED' || status === 'CANCELLED') return 'danger' as const
  if (status === 'RETURNED') return 'success' as const
  if (status === 'PENDING') return 'pending' as const
  return 'progress' as const
}

export function RequestDetailsPage() {
  const { requestId } = useParams()
  const { user } = useAuth()
  const { notify } = useToast()
  const isAdmin = user?.role === 'SUPER_ADMIN'
  const [request, setRequest] = useState<BorrowingRequestDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [returnCondition, setReturnCondition] =
    useState<ReturnCondition>('GOOD')
  const [returnNotes, setReturnNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!requestId) {
      return
    }

    const controller = new AbortController()

    requestService
      .get(requestId, controller.signal)
      .then((result) => {
        setRequest(result)
        setError(null)
      })
      .catch((requestError: unknown) => {
        if (!axios.isCancel(requestError)) {
          setError(getApiErrorMessage(requestError, 'Borrowing request could not be loaded.'))
        }
      })
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [requestId])

  async function approveRequest() {
    if (!requestId) return
    setIsSaving(true)

    try {
      const response = await requestService.approve(requestId)
      notify({ title: response.message ?? 'Borrowing request approved.' })
      setRequest(response.data.request)
      setApproveOpen(false)
    } catch (mutationError) {
      const message = getApiErrorMessage(mutationError, 'Borrowing request could not be approved.')
      setActionError(message)
      notify({ title: 'Approval failed.', description: message, tone: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  async function rejectRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!requestId || rejectionReason.trim().length < 5 || isSaving) {
      setActionError('Rejection reason must contain at least 5 characters.')
      return
    }

    setIsSaving(true)
    setActionError(null)

    try {
      const response = await requestService.reject(requestId, rejectionReason.trim())
      notify({ title: response.message ?? 'Borrowing request rejected.' })
      setRequest(response.data.request)
      setRejectOpen(false)
      setRejectionReason('')
    } catch (mutationError) {
      const message = getApiErrorMessage(mutationError, 'Borrowing request could not be rejected.')
      setActionError(message)
      notify({ title: 'Rejection failed.', description: message, tone: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  async function processReturn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!requestId || isSaving) {
      return
    }

    setIsSaving(true)
    setActionError(null)

    try {
      const response = await requestService.processReturn(
        requestId,
        returnCondition,
        returnNotes,
      )
      notify({ title: response.message ?? 'Return processed.' })
      setRequest(response.data.request)
      setReturnOpen(false)
      setReturnCondition('GOOD')
      setReturnNotes('')
    } catch (mutationError) {
      const message = getApiErrorMessage(
        mutationError,
        'Return could not be processed.',
      )
      setActionError(message)
      notify({
        title: 'Return failed.',
        description: message,
        tone: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (!requestId) {
    return <FullPageError message="Borrowing request ID is missing." />
  }

  if (isLoading && !request) {
    return <PageLoading label="Loading borrowing request" />
  }

  if (error || !request) {
    return <FullPageError message={error ?? 'Borrowing request was not found.'} />
  }

  const basePath = isAdmin ? '/logistics' : '/committee'

  return (
    <div className="space-y-6">
      <PageHeader
        title={request.requestCode}
        description={`${request.committee.name} · Submitted by ${request.submitter.username}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to={isAdmin ? '/logistics/requests' : '/committee/requests/history'}>
                <ArrowLeft aria-hidden="true" />
                Back to requests
              </Link>
            </Button>
            {isAdmin && request.status === 'PENDING' ? (
              <>
                <Button type="button" variant="destructive" onClick={() => {
                  setActionError(null)
                  setRejectOpen(true)
                }}>
                  <X aria-hidden="true" />
                  Reject
                </Button>
                <Button type="button" onClick={() => {
                  setActionError(null)
                  setApproveOpen(true)
                }}>
                  <Check aria-hidden="true" />
                  Approve
                </Button>
              </>
            ) : null}
            {isAdmin &&
            (request.status === 'APPROVED' ||
              request.status === 'BORROWED') ? (
              <Button
                type="button"
                onClick={() => {
                  setActionError(null)
                  setReturnOpen(true)
                }}
              >
                <RotateCcw aria-hidden="true" />
                Process return
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader><CardTitle>Request details</CardTitle></CardHeader>
          <CardContent className="grid gap-5 text-sm sm:grid-cols-2">
            <div><p className="text-xs text-muted-foreground">Requester</p><p className="mt-1 font-medium">{request.requesterName}</p><p className="text-muted-foreground">{request.requesterPosition}</p></div>
            <div><p className="text-xs text-muted-foreground">Status</p><div className="mt-1"><StatusBadge label={formatEnumLabel(request.status)} tone={requestTone(request.status)} /></div></div>
            <div><p className="text-xs text-muted-foreground">Borrow date</p><p className="mt-1">{new Date(request.borrowDate).toLocaleDateString()}</p></div>
            <div><p className="text-xs text-muted-foreground">Expected return</p><p className="mt-1">{new Date(request.expectedReturnDate).toLocaleDateString()}</p></div>
            <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Purpose</p><p className="mt-1 whitespace-pre-wrap">{request.purpose}</p></div>
            {request.additionalNotes ? <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Additional notes</p><p className="mt-1 whitespace-pre-wrap">{request.additionalNotes}</p></div> : null}
            {request.rejectionReason ? <div className="sm:col-span-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3"><p className="text-xs font-semibold text-destructive">Rejection reason</p><p className="mt-1">{request.rejectionReason}</p></div> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Requested items</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {request.items.map((requestItem) => (
              <div key={requestItem.id} className="rounded-lg border p-3">
                <Button asChild variant="link" className="h-auto p-0 font-semibold">
                  <Link to={`${basePath}/inventory/${requestItem.item.id}`}>{requestItem.item.itemName}</Link>
                </Button>
                <p className="text-xs text-muted-foreground">{requestItem.item.itemCode} · {requestItem.item.category.name}</p>
                <p className="mt-2 text-sm">Quantity: <span className="font-semibold">{requestItem.quantityRequested}</span></p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <ConfirmationDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Approve borrowing request?"
        description="The backend will re-check current item availability before approval."
        confirmLabel="Approve request"
        isPending={isSaving}
        onConfirm={() => void approveRequest()}
      />
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <form onSubmit={rejectRequest}>
            <DialogHeader>
              <DialogTitle>Reject borrowing request?</DialogTitle>
              <DialogDescription>Provide a clear reason that the committee can review.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-5">
              {actionError ? <p className="text-sm text-destructive" role="alert">{actionError}</p> : null}
              <Label htmlFor="rejection-reason">Rejection reason *</Label>
              <textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                disabled={isSaving}
                rows={5}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                required
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectOpen(false)} disabled={isSaving}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={isSaving}>
                {isSaving ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <X aria-hidden="true" />}
                {isSaving ? 'Rejecting…' : 'Reject request'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <form onSubmit={processReturn}>
            <DialogHeader>
              <DialogTitle>
                Process return for {request.requestCode}?
              </DialogTitle>
              <DialogDescription>
                This restores the approved quantities to inventory and cannot
                be repeated.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-5">
              {actionError ? (
                <p className="text-sm text-destructive" role="alert">
                  {actionError}
                </p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="return-condition">
                  Return condition *
                </Label>
                <AppSelect
                  id="return-condition"
                  value={returnCondition}
                  onValueChange={(value) =>
                    setReturnCondition(value as ReturnCondition)
                  }
                  disabled={isSaving}
                  ariaLabel="Select return condition"
                  emptyLabel="Select a condition"
                  allowEmpty={false}
                  className="h-10"
                  options={[
                    { value: 'GOOD', label: 'Good' },
                    { value: 'FAIR', label: 'Fair' },
                    { value: 'DAMAGED', label: 'Damaged' },
                    { value: 'LOST', label: 'Lost' },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="return-notes">Return notes</Label>
                <textarea
                  id="return-notes"
                  value={returnNotes}
                  onChange={(event) => setReturnNotes(event.target.value)}
                  disabled={isSaving}
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setReturnOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <LoaderCircle
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <RotateCcw aria-hidden="true" />
                )}
                {isSaving ? 'Processing…' : 'Process return'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
