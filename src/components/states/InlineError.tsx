import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

interface InlineErrorProps {
  message: string
  action?: ReactNode
}

export function InlineError({ message, action }: InlineErrorProps) {
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
      role="alert"
    >
      <div className="flex items-start gap-2">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{message}</span>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
