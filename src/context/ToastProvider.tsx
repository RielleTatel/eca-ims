import { CheckCircle2, CircleAlert, X } from 'lucide-react'
import { Toast } from 'radix-ui'
import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { ToastContext, type ToastInput } from '@/context/toast-context'
import { cn } from '@/lib/utils'

interface VisibleToast extends ToastInput {
  id: number
}

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<VisibleToast[]>([])

  function notify(input: ToastInput) {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { ...input, id }].slice(-4))
  }

  function removeToast(id: number) {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }

  return (
    <ToastContext.Provider value={{ notify }}>
      <Toast.Provider swipeDirection="right" duration={4500}>
        {children}
        {toasts.map((toast) => {
          const isError = toast.tone === 'error'
          const Icon = isError ? CircleAlert : CheckCircle2

          return (
            <Toast.Root
              key={toast.id}
              open
              onOpenChange={(open) => {
                if (!open) {
                  removeToast(toast.id)
                }
              }}
              className={cn(
                'grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg',
                isError ? 'border-destructive/35' : 'border-success/35',
              )}
            >
              <Icon
                className={cn('mt-0.5 size-5', isError ? 'text-destructive' : 'text-success')}
                aria-hidden="true"
              />
              <div>
                <Toast.Title className="text-sm font-semibold">{toast.title}</Toast.Title>
                {toast.description ? (
                  <Toast.Description className="mt-1 text-xs text-muted-foreground">
                    {toast.description}
                  </Toast.Description>
                ) : null}
              </div>
              <Toast.Close asChild>
                <Button type="button" variant="ghost" size="icon-xs" aria-label="Dismiss notification">
                  <X aria-hidden="true" />
                </Button>
              </Toast.Close>
            </Toast.Root>
          )
        })}
        <Toast.Viewport className="fixed bottom-0 right-0 z-[100] flex w-full max-w-sm flex-col gap-2 p-4 outline-none" />
      </Toast.Provider>
    </ToastContext.Provider>
  )
}
