import { ArrowLeft, Pencil, RotateCcw } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { FullPageError } from '@/components/states/FullPageError'
import { InlineError } from '@/components/states/InlineError'
import { PageLoading } from '@/components/states/PageLoading'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api'
import { borrowingService, displayBorrowingDate, isOverdue, type BorrowingDetailsInput, type BorrowingReturnInput } from '@/services/borrowingService'
import type { BorrowingRecord, ReturnCondition } from '@/types/api'
import { formatEnumLabel } from '@/utils/formatEnumLabel'

const conditions: ReturnCondition[] = ['GOOD', 'FAIR', 'DAMAGED', 'LOST']
type ReturnDraft = Record<string, { quantities: Record<ReturnCondition, number>; notes: string }>

export function BorrowingDetailsPage() {
  const { borrowingId } = useParams()
  const { notify } = useToast()
  const [record, setRecord] = useState<BorrowingRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [returnOpen, setReturnOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [returns, setReturns] = useState<ReturnDraft>({})
  const [details, setDetails] = useState<BorrowingDetailsInput>({ borrowerName: '', studentId: '', purpose: '', expectedReturnDate: '' })
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    if (borrowingId) borrowingService.get(borrowingId, controller.signal).then((result) => {
      if (!controller.signal.aborted) { setRecord(result); setError(null) }
    }).catch((loadError: unknown) => { if (!controller.signal.aborted) setError(getApiErrorMessage(loadError, 'Borrowing could not be loaded.')) })
    return () => controller.abort()
  }, [borrowingId, reloadKey])

  async function refreshSavedRecord() {
    try { setRecord(await borrowingService.get(borrowingId!)) }
    catch { setError('Changes were saved, but the updated record could not be loaded. Refresh to view it.') }
  }

  async function saveReturns(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!record || isSaving) return
    const entries: BorrowingReturnInput[] = []
    for (const item of record.items) {
      const draft = returns[item.id]
      if (!draft) continue
      const total = conditions.reduce((sum, condition) => sum + draft.quantities[condition], 0)
      if (total > item.outstandingQuantity || conditions.some((condition) => !Number.isInteger(draft.quantities[condition]) || draft.quantities[condition] < 0)) {
        setActionError(`Enter whole quantities within the ${item.outstandingQuantity} outstanding units of ${item.item.itemName}.`)
        return
      }
      for (const condition of conditions) if (draft.quantities[condition] > 0) entries.push({ borrowingItemId: item.id, quantity: draft.quantities[condition], condition, notes: draft.notes })
    }
    if (!entries.length) { setActionError('Enter at least one returned or lost unit.'); return }
    setIsSaving(true)
    setActionError(null)
    try {
      await borrowingService.processReturn(record.id, entries)
      setReturnOpen(false)
      notify({ title: 'Return recorded. Inventory has been updated.' })
      await refreshSavedRecord()
    } catch (saveError) { setActionError(getApiErrorMessage(saveError, 'Return could not be recorded.')) }
    finally { setIsSaving(false) }
  }

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!record || isSaving) return
    if (details.borrowerName.trim().length < 2 || !details.studentId.trim() || details.purpose.trim().length < 5 || details.expectedReturnDate < record.borrowDate) {
      setActionError('Provide student name, ID, purpose, and a valid expected return date.'); return
    }
    setIsSaving(true)
    setActionError(null)
    try {
      await borrowingService.updateDetails(record.id, details)
      setEditOpen(false)
      notify({ title: 'Borrowing details updated.' })
      await refreshSavedRecord()
    } catch (saveError) { setActionError(getApiErrorMessage(saveError, 'Details could not be saved.')) }
    finally { setIsSaving(false) }
  }

  if (!borrowingId || error) return <FullPageError message={error ?? 'Borrowing ID is missing.'} onRetry={() => { setError(null); setReloadKey((key) => key + 1) }} />
  if (!record) return <PageLoading label="Loading borrowing" />
  const overdue = isOverdue(record)
  const completedReturns = record.items.flatMap((item) => item.returns.map((entry) => ({ ...entry, itemName: item.item.itemName }))).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="space-y-6">
      <PageHeader title={record.borrowingCode} description={`Recorded by ${record.recordedBy.username} · ${new Date(record.createdAt).toLocaleString()}`} actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link to="/logistics/borrowings"><ArrowLeft aria-hidden="true" />Back to borrowings</Link></Button>
          {record.status !== 'ARCHIVED' ? <Button variant="outline" onClick={() => {
            setDetails({ borrowerName: record.borrowerName, studentId: record.studentId ?? '', contactDetails: record.contactDetails ?? '', purpose: record.purpose, expectedReturnDate: record.expectedReturnDate, additionalNotes: record.additionalNotes ?? '' }); setActionError(null); setEditOpen(true)
          }}><Pencil aria-hidden="true" />Edit details</Button> : null}
          {record.status === 'ACTIVE' ? <Button onClick={() => {
            setReturns(Object.fromEntries(record.items.filter((item) => item.outstandingQuantity > 0).map((item) => [item.id, { quantities: { GOOD: 0, FAIR: 0, DAMAGED: 0, LOST: 0 }, notes: '' }]))); setActionError(null); setReturnOpen(true)
          }}><RotateCcw aria-hidden="true" />Record return</Button> : null}
        </div>
      } />
      {record.isLegacy ? <p className="rounded-lg border bg-muted/40 p-4 text-sm">Imported historical record. Student ID was not collected in the previous workflow.{record.status === 'ARCHIVED' ? ` Original status: ${formatEnumLabel(record.legacyStatus ?? 'Archived')}. This record did not represent an equipment checkout.` : ' Update the student details when available.'}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Student and borrowing details</CardTitle></CardHeader><CardContent className="space-y-4 text-sm">
          <div><p className="font-semibold">{record.borrowerName}</p><p>Student ID: {record.studentId ?? 'Not recorded'}</p>{record.contactDetails ? <p>{record.contactDetails}</p> : null}</div>
          <StatusBadge label={overdue ? 'Overdue' : formatEnumLabel(record.status)} tone={overdue ? 'danger' : record.status === 'RETURNED' ? 'success' : record.status === 'ARCHIVED' ? 'inactive' : 'progress'} />
          <div className="grid grid-cols-2 gap-4"><div><p className="text-muted-foreground">Checkout date</p><p>{displayBorrowingDate(record.borrowDate)}</p></div><div><p className="text-muted-foreground">Expected return</p><p>{displayBorrowingDate(record.expectedReturnDate)}</p></div></div>
          <div><p className="text-muted-foreground">Purpose</p><p className="whitespace-pre-wrap">{record.purpose}</p></div>
          {record.additionalNotes ? <div><p className="text-muted-foreground">Notes</p><p className="whitespace-pre-wrap">{record.additionalNotes}</p></div> : null}
          {record.returnedAt ? <p>Completed: {new Date(record.returnedAt).toLocaleString()}</p> : null}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Equipment · {record.outstandingQuantity} units outstanding</CardTitle></CardHeader><CardContent className="space-y-3">
          {record.items.map((item) => <div key={item.id} className="rounded-lg border p-4"><Link className="font-semibold text-primary underline-offset-4 hover:underline" to={`/logistics/inventory/${item.itemId}`}>{item.item.itemName}</Link><p className="text-xs text-muted-foreground">{item.item.itemCode} · {item.item.categoryName}</p><p className="mt-2 text-sm">{item.quantityBorrowed} borrowed · {item.quantityReturned} returned · {item.quantityLost} lost · {item.outstandingQuantity} outstanding</p>{item.quantityDamaged > 0 ? <p className="text-sm text-destructive">{item.quantityDamaged} returned damaged</p> : null}</div>)}
        </CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Return history</CardTitle></CardHeader><CardContent>
        {completedReturns.length ? <ol className="divide-y">{completedReturns.map((entry) => <li key={entry.id} className="py-3 text-sm"><p className="font-medium">{entry.itemName} · {entry.quantity} {formatEnumLabel(entry.condition).toLowerCase()}</p><p className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()} · {entry.recordedBy.username}</p>{entry.notes ? <p className="mt-1 whitespace-pre-wrap">{entry.notes}</p> : null}</li>)}</ol> : <p className="text-sm text-muted-foreground">No returns recorded.</p>}
      </CardContent></Card>

      <Dialog open={returnOpen} onOpenChange={(open) => { if (!isSaving) setReturnOpen(open) }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><form onSubmit={saveReturns}>
        <DialogHeader><DialogTitle>Record returned equipment</DialogTitle><DialogDescription>Enter quantities for each condition. Good and fair units become available; damaged units await repair; lost units leave inventory. Unresolved units remain borrowed.</DialogDescription></DialogHeader>
        <fieldset disabled={isSaving} className="space-y-5 py-5">
          {actionError ? <InlineError message={actionError} /> : null}
          {record.items.filter((item) => item.outstandingQuantity > 0).map((item) => {
            const draft = returns[item.id]
            if (!draft) return null
            return <div key={item.id} className="space-y-3 rounded-lg border p-4"><p className="font-semibold">{item.item.itemName} <span className="font-normal text-muted-foreground">· {item.outstandingQuantity} outstanding</span></p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{conditions.map((condition) => <div key={condition} className="space-y-1"><Label htmlFor={`${item.id}-${condition}`}>{formatEnumLabel(condition)}</Label><Input id={`${item.id}-${condition}`} type="number" min={0} max={item.outstandingQuantity} step={1} value={draft.quantities[condition]} onChange={(event) => setReturns((current) => ({ ...current, [item.id]: { ...draft, quantities: { ...draft.quantities, [condition]: Number(event.target.value) } } }))} /></div>)}</div>
              <Label htmlFor={`${item.id}-notes`}>Inspection notes</Label><Input id={`${item.id}-notes`} value={draft.notes} onChange={(event) => setReturns((current) => ({ ...current, [item.id]: { ...draft, notes: event.target.value } }))} />
            </div>
          })}
        </fieldset>
        <DialogFooter><Button type="button" variant="outline" disabled={isSaving} onClick={() => setReturnOpen(false)}>Cancel</Button><Button type="submit" disabled={isSaving}>{isSaving ? 'Recording…' : 'Record return'}</Button></DialogFooter>
      </form></DialogContent></Dialog>

      <Dialog open={editOpen} onOpenChange={(open) => { if (!isSaving) setEditOpen(open) }}><DialogContent className="max-h-[90vh] overflow-y-auto"><form onSubmit={saveDetails}>
        <DialogHeader><DialogTitle>Edit borrowing details</DialogTitle><DialogDescription>Correct student details or extend the expected return date. Changes are recorded in the audit log.</DialogDescription></DialogHeader>
        <fieldset disabled={isSaving} className="space-y-4 py-5">
          {actionError ? <InlineError message={actionError} /> : null}
          <div className="space-y-1"><Label htmlFor="edit-name">Student full name *</Label><Input id="edit-name" value={details.borrowerName} minLength={2} maxLength={150} required onChange={(event) => setDetails({ ...details, borrowerName: event.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="edit-id">Student ID *</Label><Input id="edit-id" value={details.studentId} maxLength={100} required onChange={(event) => setDetails({ ...details, studentId: event.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="edit-contact">Contact information</Label><Input id="edit-contact" value={details.contactDetails ?? ''} maxLength={200} onChange={(event) => setDetails({ ...details, contactDetails: event.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="edit-date">Expected return date *</Label><Input id="edit-date" type="date" min={record.borrowDate} required value={details.expectedReturnDate} onChange={(event) => setDetails({ ...details, expectedReturnDate: event.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="edit-purpose">Purpose *</Label><Input id="edit-purpose" minLength={5} required value={details.purpose} onChange={(event) => setDetails({ ...details, purpose: event.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="edit-notes">Additional notes</Label><Input id="edit-notes" value={details.additionalNotes ?? ''} onChange={(event) => setDetails({ ...details, additionalNotes: event.target.value })} /></div>
        </fieldset>
        <DialogFooter><Button type="button" variant="outline" disabled={isSaving} onClick={() => setEditOpen(false)}>Cancel</Button><Button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : 'Save details'}</Button></DialogFooter>
      </form></DialogContent></Dialog>
    </div>
  )
}
