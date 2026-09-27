import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Search } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { NewPasswordInput } from '@/components/common/NewPasswordInput'
import { InlineError } from '@/components/states/InlineError'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { accountService, type StaffAccount } from '@/services/accountService'
import { getApiErrorMessage } from '@/services/api'
import { useToast } from '@/hooks/useToast'

export function AccountsPage() {
  const [accounts, setAccounts] = useState<StaffAccount[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [editor, setEditor] = useState<StaffAccount | 'create' | null>(null)
  const [pending, setPending] = useState<StaffAccount | null>(null)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const { notify } = useToast()

  useEffect(() => {
    let active = true
    accountService.list().then((data) => { if (active) { setAccounts(data); setError(null) } })
      .catch((error) => { if (active) setError(getApiErrorMessage(error)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reload])
  function refresh() { setLoading(true); setReload((value) => value + 1) }
  function openEditor(value: StaffAccount | 'create' | null) {
    setUsername(''); setEmail(''); setPassword(''); setFormError(null); setEditor(value)
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!editor || saving) return
    setSaving(true); setFormError(null)
    try {
      if (editor === 'create') await accountService.create(username.trim(), email.trim(), password)
      else await accountService.resetPassword(editor.id, password)
      notify({ title: editor === 'create' ? 'Staff account created.' : 'Password reset.', description: 'Share the credentials directly with the staff member. They must change the password when signing in.' })
      openEditor(null); refresh()
    } catch (error) { setFormError(getApiErrorMessage(error)) }
    finally { setSaving(false) }
  }
  async function toggleActive() {
    if (!pending || saving) return
    setSaving(true)
    try {
      await accountService.setActive(pending.id, !pending.isActive)
      notify({ title: pending.isActive ? 'Staff account deactivated.' : 'Staff account reactivated.' })
      setPending(null); refresh()
    } catch (error) { notify({ title: 'Account could not be updated.', description: getApiErrorMessage(error), tone: 'error' }) }
    finally { setSaving(false) }
  }
  const filtered = accounts.filter((account) => `${account.username} ${account.email}`.toLowerCase().includes(search.toLowerCase()))
  return <div className="space-y-6">
    <PageHeader title="Staff Accounts" description="Create and manage staff access. Account credentials are shared directly; no invitation email is sent."
      actions={<Button onClick={() => openEditor('create')}><Plus aria-hidden="true" />Create account</Button>} />
    <Card><CardContent className="space-y-4">
      <Label htmlFor="account-search">Find staff</Label>
      <div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden="true" />
        <Input id="account-search" className="pl-9" placeholder="Username or email" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      {error ? <><InlineError message={error} /><Button variant="outline" onClick={refresh}>Retry</Button></> : loading ? <p role="status">Loading accounts…</p> :
        filtered.length === 0 ? <p className="py-8 text-center text-muted-foreground">No staff accounts found.</p> :
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr className="border-b"><th className="p-3">Staff</th><th className="p-3">Status</th><th className="p-3">Password</th><th className="p-3 text-right">Actions</th></tr></thead>
          <tbody>{filtered.map((account) => <tr key={account.id} className="border-b last:border-0">
            <td className="p-3"><p className="font-medium">{account.username}</p><p className="text-muted-foreground">{account.email}</p></td>
            <td className="p-3">{account.isActive ? 'Active' : 'Inactive'}</td>
            <td className="p-3">{account.mustChangePassword ? 'Change required' : 'Changed'}</td>
            <td className="p-3"><div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => openEditor(account)} disabled={saving}>Reset password</Button>
              <Button variant="outline" size="sm" onClick={() => setPending(account)} disabled={saving}>{account.isActive ? 'Deactivate' : 'Reactivate'}</Button>
            </div></td>
          </tr>)}</tbody>
        </table></div>}
    </CardContent></Card>
    <Dialog open={editor !== null} onOpenChange={(open) => { if (!open && !saving) openEditor(null) }}>
      <DialogContent><DialogHeader><DialogTitle>{editor === 'create' ? 'Create staff account' : `Reset password: ${editor?.username ?? ''}`}</DialogTitle>
        <DialogDescription>The staff member must change this password when signing in. Share it with them directly.</DialogDescription></DialogHeader>
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          {formError && <InlineError message={formError} />}
          {editor === 'create' && <>
            <div className="space-y-2"><Label htmlFor="staff-username">Username</Label><Input id="staff-username" autoComplete="off" value={username} onChange={(event) => setUsername(event.target.value)} required pattern="[a-zA-Z0-9][a-zA-Z0-9_.\-]{2,49}" maxLength={50} disabled={saving} /><p className="text-xs text-muted-foreground">3–50 letters, numbers, dots, hyphens or underscores.</p></div>
            <div className="space-y-2"><Label htmlFor="staff-email">Email</Label><Input id="staff-email" type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={saving} /></div>
          </>}
          <NewPasswordInput value={password} onChange={setPassword} disabled={saving} label={editor === 'create' ? 'Initial password' : 'Temporary password'} />
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => openEditor(null)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editor === 'create' ? 'Create account' : 'Reset password'}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
    <ConfirmationDialog open={pending !== null} onOpenChange={(open) => { if (!open && !saving) setPending(null) }}
      title={`${pending?.isActive ? 'Deactivate' : 'Reactivate'} ${pending?.username ?? 'staff account'}?`}
      description={pending?.isActive ? 'This staff member will lose access immediately. Their historical actions will be retained.' : 'This staff member will be able to sign in again. Any required password change still applies.'}
      confirmLabel={pending?.isActive ? 'Deactivate account' : 'Reactivate account'} destructive={pending?.isActive} isPending={saving} onConfirm={() => void toggleActive()} />
  </div>
}
