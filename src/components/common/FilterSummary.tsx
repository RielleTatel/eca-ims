import { RotateCcw, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

export interface ActiveFilter {
  key: string
  label: string
  onRemove: () => void
}

interface FilterSummaryProps {
  filters: ActiveFilter[]
  resultCount: number
  resultLabel: string
  onClear: () => void
}

export function FilterSummary({
  filters,
  resultCount,
  resultLabel,
  onClear,
}: FilterSummaryProps) {
  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <p className="text-sm font-medium">
          {resultCount.toLocaleString()} {resultLabel}
        </p>
        {filters.map((filter) => (
          <Button
            key={filter.key}
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 gap-1.5 rounded-full px-2.5 text-xs"
            onClick={filter.onRemove}
            aria-label={`Remove ${filter.label} filter`}
          >
            {filter.label}
            <X className="size-3" aria-hidden="true" />
          </Button>
        ))}
      </div>
      {filters.length > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start text-muted-foreground sm:self-auto"
          onClick={onClear}
        >
          <RotateCcw aria-hidden="true" />
          Clear all
        </Button>
      ) : null}
    </div>
  )
}
