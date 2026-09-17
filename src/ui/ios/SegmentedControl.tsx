'use client'

import clsx from 'clsx'

interface SegmentedControlProps<T extends string> {
  'options': ReadonlyArray<{ value: T, label: string }>
  'value': T
  'onChange': (value: T) => void
  'className'?: string
  'aria-label'?: string
}

/** UISegmentedControl look: translucent grey track with a raised selected segment. */
export function SegmentedControl<T extends string>({ options, value, onChange, className, 'aria-label': ariaLabel }: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={clsx('flex rounded-[9px] bg-zinc-800/80 p-0.5', className)}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={clsx(
              'min-h-[30px] flex-1 truncate rounded-[7px] px-3 text-[13px] transition-colors',
              selected ? 'bg-zinc-600 font-semibold text-white shadow-[0_3px_8px_rgba(0,0,0,0.12)]' : 'font-medium text-zinc-300',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
