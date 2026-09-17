'use client'

import clsx from 'clsx'

interface SwitchProps {
  'checked': boolean
  'onChange': (checked: boolean) => void
  'disabled'?: boolean
  'aria-label'?: string
}

/** UISwitch: 51×31, systemGreen when on. */
export function Switch({ checked, onChange, disabled, 'aria-label': ariaLabel }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40',
        checked ? 'bg-emerald-500' : 'bg-zinc-700',
      )}
    >
      <span
        className={clsx(
          'absolute left-0 top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15)] transition-transform duration-200',
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  )
}
