import { Check, Cloud } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import ecaLogo from '@/assets/eca-logo.png'
import { apiBaseUrl } from '@/services/api'

const RECENTLY_READY_KEY = 'eca-server-ready-at'
const RECENTLY_READY_WINDOW_MS = 5 * 60 * 1000
const SLOW_START_NOTICE_MS = 10 * 1000
const STARTUP_DEMO_READY_MS = 15 * 1000
const HEALTH_REQUEST_TIMEOUT_MS = 12 * 1000
const RETRY_DELAY_MS = 1200

interface ServerStartupGateProps {
  children: ReactNode
}

export function ServerStartupGate({ children }: ServerStartupGateProps) {
  const searchParams = new URLSearchParams(window.location.search)
  const startupDemo = import.meta.env.DEV && searchParams.get('startupDemo') === '1'
  const [canEnterApp, setCanEnterApp] = useState(() => {
    if (startupDemo) {
      return false
    }

    const lastReadyAt = Number(sessionStorage.getItem(RECENTLY_READY_KEY))
    return Number.isFinite(lastReadyAt) && Date.now() - lastReadyAt < RECENTLY_READY_WINDOW_MS
  })
  const [serverReady, setServerReady] = useState(false)
  const [showSlowStartNotice, setShowSlowStartNotice] = useState(false)
  const [attempt, setAttempt] = useState(1)

  useEffect(() => {
    if (canEnterApp) {
      return
    }

    let active = true
    let retryTimer: number | undefined
    let demoReadyTimer: number | undefined

    const slowStartTimer = window.setTimeout(() => {
      if (active) {
        setShowSlowStartNotice(true)
      }
    }, SLOW_START_NOTICE_MS)

    if (startupDemo) {
      demoReadyTimer = window.setTimeout(() => {
        if (active) {
          setServerReady(true)
        }
      }, STARTUP_DEMO_READY_MS)

      return () => {
        active = false
        window.clearTimeout(slowStartTimer)
        window.clearTimeout(demoReadyTimer)
      }
    }

    async function checkServer() {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), HEALTH_REQUEST_TIMEOUT_MS)

      try {
        const response = await fetch(`${apiBaseUrl}/health?startup=${Date.now()}`, {
          cache: 'no-store',
          credentials: 'include',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`Health check returned ${response.status}`)
        }

        if (active) {
          sessionStorage.setItem(RECENTLY_READY_KEY, String(Date.now()))
          setServerReady(true)
        }
      } catch {
        if (active) {
          setAttempt((currentAttempt) => currentAttempt + 1)
          retryTimer = window.setTimeout(checkServer, RETRY_DELAY_MS)
        }
      } finally {
        window.clearTimeout(timeout)
      }
    }

    void checkServer()

    return () => {
      active = false
      window.clearTimeout(slowStartTimer)
      window.clearTimeout(retryTimer)
      window.clearTimeout(demoReadyTimer)
    }
  }, [canEnterApp, startupDemo])

  useEffect(() => {
    if (serverReady) {
      const enterTimer = window.setTimeout(() => setCanEnterApp(true), 600)
      return () => window.clearTimeout(enterTimer)
    }
  }, [serverReady])

  if (canEnterApp) {
    return children
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-navy px-6 py-10 text-brand-parchment">
      <div
        className="pointer-events-none absolute -left-24 -top-32 size-96 rounded-full bg-brand-gold/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-20 size-[28rem] rounded-full bg-brand-gold/10 blur-3xl"
        aria-hidden="true"
      />
      <section className="relative mx-auto flex max-w-md flex-col items-center text-center">
        <img
          src={ecaLogo}
          alt="El Consejo Atenista seal"
          className="mb-7 size-24 drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        />

        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-parchment/15 bg-white/5 px-3.5 py-2 text-sm font-medium text-brand-parchment/75 backdrop-blur">
          {serverReady ? (
            <Check className="size-4 text-emerald-300" aria-hidden="true" />
          ) : (
            <Cloud className="size-4 text-brand-gold" aria-hidden="true" />
          )}
          El Consejo Atenista
        </div>

        <h1 className="font-heading text-3xl font-semibold tracking-[-0.02em] text-brand-parchment sm:text-4xl">
          {serverReady ? 'You’re in.' : 'Preparing your workspace.'}
        </h1>
        <p className="mt-4 text-sm leading-6 text-brand-parchment/65">
          {serverReady
            ? 'Everything is ready. Taking you to the inventory workspace.'
            : showSlowStartNotice
              ? 'The server is waking up from a period of inactivity. This can take up to a minute.'
              : 'Connecting to the El Consejo Atenista inventory server.'}
        </p>

        <div className="mt-8 flex min-h-10 items-center justify-center" aria-live="polite" aria-atomic="true">
          {!serverReady && (
            <div className="inline-flex items-center gap-3 rounded-full border border-brand-parchment/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-brand-parchment/70 backdrop-blur">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-gold opacity-60" />
                <span className="relative inline-flex size-2.5 rounded-full bg-brand-gold" />
              </span>
              Connecting
              <span className="sr-only">, attempt {attempt}</span>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
