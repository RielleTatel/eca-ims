import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const EMPTY_VALUE = '__app_select_empty__'

export interface AppSelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface AppSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: AppSelectOption[]
  emptyLabel?: string
  allowEmpty?: boolean
  ariaLabel: string
  id?: string
  disabled?: boolean
  className?: string
}

export function AppSelect({
  value,
  onValueChange,
  options,
  emptyLabel = 'Select an option',
  allowEmpty = true,
  ariaLabel,
  id,
  disabled,
  className,
}: AppSelectProps) {
  return (
    <Select
      value={value || EMPTY_VALUE}
      onValueChange={(nextValue) =>
        onValueChange(nextValue === EMPTY_VALUE ? '' : nextValue)
      }
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        className={cn('w-full min-w-0 bg-background', className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        <SelectItem value={EMPTY_VALUE} disabled={!allowEmpty}>
          {emptyLabel}
        </SelectItem>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
