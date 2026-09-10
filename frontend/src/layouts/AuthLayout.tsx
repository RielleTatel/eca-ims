import { ShieldCheck } from 'lucide-react'
import { Outlet } from 'react-router-dom'

import ecaLogo from '@/assets/eca-logo.png'
import { ThemeToggle } from '@/components/common/ThemeToggle'

export function AuthLayout() {
  return (
    <main className="relative grid min-h-screen w-full min-w-0 max-w-full overflow-x-clip overflow-y-hidden bg-background lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <div className="absolute inset-x-0 top-0 z-10 h-1 brand-gradient-secondary" aria-hidden="true" />
      <section className="auth-layout-section auth-panel-surface relative flex min-w-0 items-center justify-center px-5 py-10 sm:px-8 lg:py-12">
        <div
          className="pointer-events-none absolute -left-24 top-16 size-72 rounded-full bg-brand-gold/8 blur-3xl"
          aria-hidden="true"
        />
        <div className="auth-layout-shell relative w-full max-w-md">
          <div className="auth-brand-row mb-9 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="group/brandmark flex size-11 items-center justify-center rounded-xl border border-brand-gold/40 bg-brand-navy text-brand-parchment shadow-[0_8px_22px_rgba(12,21,71,0.28)] transition-[box-shadow,border-color] duration-300 hover:border-brand-gold/70 hover:shadow-[0_10px_28px_rgba(201,162,39,0.28)]">
                <ShieldCheck
                  className="size-5 transition-transform duration-300 ease-out group-hover/brandmark:-rotate-6 group-hover/brandmark:scale-110 motion-reduce:transform-none motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </span>
              <div>
                <p className="font-heading text-base font-semibold tracking-tight">
                  El Consejo Atenista
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Inventory &amp; Borrowing System</p>
              </div>
            </div>
            <div className="[&_button]:rounded-full [&_button]:border [&_button]:border-border/60 [&_button]:bg-card/60 [&_button]:shadow-sm [&_button]:transition-all [&_button]:duration-200 [&_button:hover]:-translate-y-0.5 [&_button:hover]:border-ring/40 [&_button:hover]:shadow-md [&_button:active]:translate-y-0 [&_svg]:transition-transform [&_svg]:duration-200 [&_button:hover_svg]:rotate-12">
              <ThemeToggle />
            </div>
          </div>
          <Outlet />
          <div className="auth-footer mt-6 space-y-2 text-center text-xs text-muted-foreground">
            <p>Authorized ECA accounts only</p>
            <p className="lg:hidden">Developed by Jed Tenorio</p>
          </div>
        </div>
      </section>
      <section className="auth-hero-surface relative hidden min-h-screen min-w-0 self-stretch overflow-hidden text-brand-parchment lg:block">
        <div
          className="absolute inset-0 opacity-70 [background:radial-gradient(circle_at_75%_16%,rgba(201,162,39,0.16),transparent_42%)]"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-40 -right-32 size-[30rem] rounded-full bg-brand-gold/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="absolute left-10 top-12 z-20 xl:left-14">
          <p className="font-heading text-sm font-semibold uppercase tracking-[0.2em] text-brand-gold/90">
            El Consejo Atenista
          </p>
        </div>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <img
            src={ecaLogo}
            alt=""
            aria-hidden="true"
            className="size-[30rem] max-w-none select-none opacity-[0.14] drop-shadow-2xl xl:size-[34rem]"
          />
        </div>

        <div className="absolute inset-x-8 bottom-20 z-20 text-center xl:inset-x-12">
          <h1 className="font-heading text-[clamp(1.6rem,2.6vw,2.75rem)] font-semibold leading-tight tracking-tight text-brand-parchment">
            Inventory &amp; borrowing,
            <br />
            kept in good order.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-brand-parchment/65">
            The council's system of record for equipment, requests, and committee accounts.
          </p>
        </div>

        <div className="absolute inset-x-10 bottom-5 z-20 flex items-center justify-between text-xs text-brand-parchment/50 xl:inset-x-14">
          <p>El Consejo Atenista</p>
          <p>Developed by Jed Tenorio</p>
        </div>
      </section>
    </main>
  )
}
