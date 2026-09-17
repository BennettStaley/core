'use client'

import { useId, type ReactNode } from 'react'
import { calcDuration, formatTime12h } from '@/src/lib/scheduleTime'

export { calcDuration, formatTime12h }

interface TimeInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  /** Optional icon shown next to the label */
  icon?: ReactNode
  /** Tailwind text-color class for the icon and label accent */
  accentClass?: string
}

/**
 * Grouped-list row with a title on the left and a native time field on the
 * right, styled like the grey time pill in Clock/Calendar. The native input
 * opens the iOS wheel picker on iPhone.
 */
export function TimeInput({ label, value, onChange, disabled = false, icon, accentClass }: TimeInputProps) {
  const id = useId()
  return (
    <div className="flex min-h-[44px] min-w-0 items-center justify-between gap-3 px-4 py-1.5">
      <label htmlFor={id} className="flex min-w-0 items-center gap-2 truncate text-[17px] text-white">
        {icon && <span className={accentClass}>{icon}</span>}
        {label}
      </label>
      <div className="relative min-w-0 shrink-0">
        <input
          id={id}
          type="time"
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className="ios-numeric h-[34px] min-w-0 rounded-lg bg-zinc-800 px-2.5 text-center text-[17px] text-white outline-none [color-scheme:dark] focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
        />
      </div>
    </div>
  )
}
