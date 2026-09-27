import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { NewPasswordInput } from '@/components/common/NewPasswordInput'
import { InlineError } from '@/components/states/InlineError'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { accountService } from '@/services/accountService'
import { getApiErrorMessage } from '@/services/api'

export function ChangePasswordPage() {
  const { user, refreshSession, logout } = useAuth()
  const { notify } = useToast()
  const navigate = useNavigate()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    if (password !== confirmation) { setError('New passwords do not match.'); return }
    setSaving(true); setError(null)
    try {
      await accountService.changePassword(current, password)
      setCurrent(''); setPassword(''); setConfirmation('')
      const updated = await refreshSession()
      notify({ title: 'Password changed.' })
      navigate(updated ? '/logistics/dashboard' : '/login', { replace: true })
    } catch (error) { setError(getApiErrorMessage(error)) }
    finally { setSaving(false) }
  }
  return <Card><CardHeader><CardTitle>Change your password</CardTitle>
    <CardDescription>{user?.mustChangePassword ? 'Set your own password before continuing to the inventory system.' : 'Choose a new password for your account.'}</CardDescription></CardHeader>
    <CardContent><form className="space-y-4" onSubmit={(event) => void submit(event)}>
      {error && <InlineError message={error} />}
      <div className="space-y-2"><Label htmlFor="current-password">Current password</Label><Input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} required disabled={saving} /></div>
      <NewPasswordInput value={password} onChange={setPassword} disabled={saving} label="New password" />
      <div className="space-y-2"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required disabled={saving} /></div>
      <Button type="submit" disabled={saving} className="w-full">{saving ? 'Changing password…' : 'Change password'}</Button>
      <div className="flex justify-between">
        {!user?.mustChangePassword && <Button type="button" variant="ghost" disabled={saving} onClick={() => navigate('/logistics/dashboard')}>Cancel</Button>}
        <Button type="button" variant="ghost" disabled={saving} onClick={() => void logout().then(() => navigate('/login', { replace: true }))}>Sign out</Button>
      </div>
    </form></CardContent>
  </Card>
}
