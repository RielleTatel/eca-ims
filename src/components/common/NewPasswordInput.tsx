import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function NewPasswordInput({ value, onChange, disabled = false, label = 'Initial password' }: {
  value: string; onChange: (value: string) => void; disabled?: boolean; label?: string
}) {
  const [visible, setVisible] = useState(false)
  return <div className="space-y-2">
    <Label htmlFor="new-password">{label}</Label>
    <div className="relative">
      <Input id="new-password" type={visible ? 'text' : 'password'} value={value}
        onChange={(event) => onChange(event.target.value)} autoComplete="new-password" required minLength={12} maxLength={72}
        pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{12,72}" disabled={disabled} className="pr-12" aria-describedby="password-help" />
      <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}>
        {visible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
    <p id="password-help" className="text-xs text-muted-foreground">Use at least 12 characters with uppercase, lowercase letters and a number (maximum 72 bytes).</p>
  </div>
}
