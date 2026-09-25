import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type StatusTone =
  | 'pending'
  | 'success'
  | 'danger'
  | 'progress'
  | 'inactive'
  | 'warning'
  | 'neutral'

interface StatusBadgeProps {
  label: string
  tone: StatusTone
}

const toneClasses: Record<StatusTone, string> = {
  pending: 'bg-warning/20 text-warning-foreground ring-1 ring-warning/35',
  success: 'bg-success/15 text-success dark:text-success ring-1 ring-success/30',
  danger: 'bg-destructive/10 text-destructive ring-1 ring-destructive/25',
  progress: 'bg-info/15 text-info-foreground dark:text-info ring-1 ring-info/30',
  inactive: 'bg-muted text-muted-foreground ring-1 ring-border',
  warning: 'bg-warning/15 text-warning-foreground ring-1 ring-warning/30',
  neutral: 'bg-secondary text-secondary-foreground ring-1 ring-border',
}

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 border-transparent before:size-1.5 before:shrink-0 before:rounded-full before:bg-current',
        toneClasses[tone],
      )}
    >
      {label}
    </Badge>
  )
}
