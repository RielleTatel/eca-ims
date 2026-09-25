import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  TriangleAlert,
} from 'lucide-react'
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import ecaLogo from '@/assets/eca-logo.png'
import { InlineError } from '@/components/states/InlineError'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { getHomePath } from '@/lib/navigation'
import { getApiErrorMessage } from '@/services/api'

interface LoginLocationState {
  from?: {
    pathname?: string
  }
}

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isCapsLockOn, setIsCapsLockOn] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  function updateCapsLockState(event: KeyboardEvent<HTMLInputElement>) {
    setIsCapsLockOn(event.getModifierState('CapsLock'))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    if (!username.trim() || !password) {
      setError('Enter your username and password.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const user = await login({ username: username.trim(), password })
      const state = location.state as LoginLocationState | null
      const attemptedPath = state?.from?.pathname
      const safeDestination =
        attemptedPath &&
        ((user.role === 'SUPER_ADMIN' && attemptedPath.startsWith('/logistics')) ||
          (user.role === 'COMMITTEE' && attemptedPath.startsWith('/committee')))
          ? attemptedPath
          : getHomePath(user.role)

      navigate(safeDestination, { replace: true })
    } catch (loginError) {
      setError(getApiErrorMessage(loginError, 'Unable to sign in. Check your credentials and try again.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="auth-card rounded-2xl border-border/80 bg-card/95 shadow-xl shadow-brand-navy/5 backdrop-blur-sm">
      <CardHeader className="auth-card-header gap-2 px-6 pt-7 text-center sm:px-8 sm:pt-8">
        <div className="auth-card-logo group/logo mx-auto mb-3 flex size-24 items-center justify-center">
          <img
            src={ecaLogo}
            alt="El Consejo Atenista seal"
            className="size-full scale-110 object-contain drop-shadow-md transition-[transform,filter] duration-500 ease-out group-hover/logo:-translate-y-1 group-hover/logo:scale-[1.18] group-hover/logo:rotate-2 group-hover/logo:drop-shadow-[0_12px_18px_rgba(201,162,39,0.35)] motion-reduce:transition-none motion-reduce:group-hover/logo:translate-y-0 motion-reduce:group-hover/logo:scale-110 motion-reduce:group-hover/logo:rotate-0"
          />
        </div>
        <CardTitle className="font-heading text-2xl font-semibold tracking-tight">Welcome back</CardTitle>
        <CardDescription className="leading-6">
          Sign in with your ECA account to continue.
        </CardDescription>
      </CardHeader>
      <CardContent className="auth-card-content px-6 pb-7 sm:px-8 sm:pb-8">
        <form className="auth-form flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
          {error ? <InlineError message={error} /> : null}
          <div className="space-y-2">
            <Label htmlFor="username" className="inline-flex items-center gap-0.5">
              Username<span className="text-destructive" aria-hidden="true">*</span>
            </Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(event) => {
                setUsername(event.target.value)
                setError(null)
              }}
              aria-invalid={Boolean(error && !username.trim())}
              className="auth-input h-11 px-3 transition-all duration-200 hover:border-primary/50 focus-visible:shadow-sm"
              disabled={isSubmitting}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="inline-flex items-center gap-0.5">
              Password<span className="text-destructive" aria-hidden="true">*</span>
            </Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setError(null)
                }}
                aria-invalid={Boolean(error && !password)}
                onKeyDown={updateCapsLockState}
                onKeyUp={updateCapsLockState}
                onBlur={() => setIsCapsLockOn(false)}
                className="auth-input h-11 px-3 pr-11 transition-all duration-200 hover:border-primary/50 focus-visible:shadow-sm"
                disabled={isSubmitting}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary active:not-aria-[haspopup]:-translate-y-1/2 active:not-aria-[haspopup]:scale-95"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                disabled={isSubmitting}
              >
                <Eye
                  className={`absolute transition-all duration-200 motion-reduce:transition-none ${
                    showPassword
                      ? 'scale-75 rotate-12 opacity-0'
                      : 'scale-100 rotate-0 opacity-100'
                  }`}
                  aria-hidden="true"
                />
                <EyeOff
                  className={`absolute transition-all duration-200 motion-reduce:transition-none ${
                    showPassword
                      ? 'scale-100 rotate-0 opacity-100'
                      : 'scale-75 -rotate-12 opacity-0'
                  }`}
                  aria-hidden="true"
                />
              </Button>
            </div>
            {isCapsLockOn ? (
              <p
                className="flex items-center gap-1.5 text-xs font-medium text-warning"
                role="status"
                aria-live="polite"
              >
                <TriangleAlert className="size-3.5" aria-hidden="true" />
                Caps Lock is on
              </p>
            ) : null}
          </div>
          <Button
            type="submit"
            size="lg"
            className="h-11 w-full shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/20 active:translate-y-0 active:shadow-sm"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <LoaderCircle className="animate-spin" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRight
                  className="transition-transform duration-200 group-hover/button:translate-x-1"
                  aria-hidden="true"
                />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
