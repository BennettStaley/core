'use client'

import clsx from 'clsx'
import { ChevronLeft, ChevronsUpDown, Sun, type LucideIcon } from 'lucide-react'
import type { CSSProperties, InputHTMLAttributes, ReactNode } from 'react'
import { ListRow, Switch } from '@/src/ui/ios'

/*
 * Settings-local row building blocks layered on the shared iOS primitives
 * (`@/src/ui/ios`). Every row is ≥44pt with the label on the left and the
 * control on the right, so they drop straight into a `ListSection`.
 */

const rowClass = 'flex min-h-[44px] w-full items-center gap-3 px-4'
const labelClass = 'min-w-0 flex-1 py-2.5'
const titleClass = 'block text-[17px] leading-[22px] text-white'
const subtitleClass = 'block text-[13px] leading-[18px] text-zinc-500'

/** Drill-down page: "‹ Settings" back button above a large title. */
export function SettingsDetail({ title, backLabel = 'Settings', onBack, children }: {
  title: ReactNode
  backLabel?: ReactNode
  onBack: () => void
  children: ReactNode
}) {
  return (
    <div className="space-y-6 pb-4">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 flex min-h-[44px] items-center text-[17px] text-sky-400 active:opacity-50"
        >
          <ChevronLeft size={28} strokeWidth={2.25} className="-mr-0.5" />
          {backLabel}
        </button>
        <h1 className="px-1 text-[34px] font-bold leading-[41px] tracking-tight text-white">{title}</h1>
      </div>
      {children}
    </div>
  )
}

function RowLabel({ title, subtitle, htmlFor }: { title: ReactNode, subtitle?: ReactNode, htmlFor?: string }) {
  const Tag = htmlFor ? 'label' : 'span'
  return (
    <Tag htmlFor={htmlFor} className={labelClass}>
      <span className={titleClass}>{title}</span>
      {subtitle && <span className={subtitleClass}>{subtitle}</span>}
    </Tag>
  )
}

/**
 * iOS `Switch` pinned to the left edge of its track. The shared primitive's
 * absolutely-positioned knob has no `left`, so inside a flex/centred button its
 * static position is the centre and both states render knob-right.
 */
export function SettingsSwitch({ checked, onChange, disabled, ariaLabel }: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  ariaLabel?: string
}) {
  return (
    <span className="flex shrink-0">
      <Switch checked={checked} onChange={onChange} disabled={disabled} aria-label={ariaLabel} />
    </span>
  )
}

/** Label + iOS switch. */
export function SwitchRow({ title, subtitle, icon, iconTile, checked, onChange, disabled, ariaLabel }: {
  title: ReactNode
  subtitle?: ReactNode
  icon?: LucideIcon
  iconTile?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  ariaLabel: string
}) {
  return (
    <ListRow
      title={title}
      subtitle={subtitle}
      icon={icon}
      iconTile={iconTile}
      accessory={<SettingsSwitch checked={checked} onChange={onChange} disabled={disabled} ariaLabel={ariaLabel} />}
    />
  )
}

/** Tappable accent-coloured action row (e.g. "Reconnect", "Run test"). */
export function ActionRow({ title, onClick, disabled, destructive, trailing }: {
  title: ReactNode
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
  trailing?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(rowClass, 'text-left active:bg-zinc-800 disabled:opacity-40 disabled:active:bg-transparent')}
    >
      <span className={clsx('min-w-0 flex-1 py-2.5 text-[17px] leading-[22px]', destructive ? 'text-red-400' : 'text-sky-400')}>
        {title}
      </span>
      {trailing}
    </button>
  )
}

const pillInput = 'h-[34px] rounded-[8px] bg-zinc-800 px-2.5 text-[17px] text-white outline-none disabled:opacity-40'

/** Label + native time picker rendered as an iOS date/time "pill". */
export function TimeRow({ title, value, onChange, disabled, id }: {
  title: ReactNode
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id: string
}) {
  return (
    <div className={rowClass}>
      <RowLabel title={title} htmlFor={id} />
      <input
        id={id}
        type="time"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className={clsx(pillInput, 'ios-numeric w-[118px] shrink-0 text-center [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden')}
      />
    </div>
  )
}

/** Label + right-aligned numeric field with an optional unit. */
export function NumberRow({ title, subtitle, id, value, onChange, onBlur, min, max, step, unit, disabled }: {
  title: ReactNode
  subtitle?: ReactNode
  id: string
  value: number
  onChange: (value: number) => void
  onBlur?: () => void
  min: number
  max: number
  step: number
  unit?: string
  disabled?: boolean
}) {
  return (
    <div className={rowClass}>
      <RowLabel title={title} subtitle={subtitle} htmlFor={id} />
      <div className="flex shrink-0 items-center gap-1.5">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          onBlur={onBlur}
          disabled={disabled}
          className={clsx(pillInput, 'ios-numeric w-[84px] text-right')}
        />
        {unit && <span className="text-[17px] text-zinc-500">{unit}</span>}
      </div>
    </div>
  )
}

/** Label on the left, free-text field filling the right (Settings "Name" row). */
export function TextRow({ title, subtitle, id, className, ...input }: {
  title: ReactNode
  subtitle?: ReactNode
  id: string
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={rowClass}>
      <RowLabel title={title} subtitle={subtitle} htmlFor={id} />
      <input
        id={id}
        type="text"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        {...input}
        className={clsx(
          'min-w-0 flex-[1.4] bg-transparent py-2.5 text-right text-[17px] text-zinc-400 outline-none placeholder:text-zinc-600 focus:text-white disabled:opacity-40',
          className,
        )}
      />
    </div>
  )
}

/** Label + native select shown as "value ⌃⌄" (iOS pop-up button). */
export function SelectRow<T extends string | number>({ title, subtitle, value, options, onChange, disabled, ariaLabel }: {
  title: ReactNode
  subtitle?: ReactNode
  value: T
  options: ReadonlyArray<{ value: T, label: string }>
  onChange: (value: T) => void
  disabled?: boolean
  ariaLabel: string
}) {
  const current = options.find(o => o.value === value)?.label ?? String(value)
  return (
    <div className={clsx(rowClass, 'relative', disabled && 'opacity-40')}>
      <RowLabel title={title} subtitle={subtitle} />
      <span className="flex shrink-0 items-center gap-1 text-[17px] text-zinc-500">
        {current}
        <ChevronsUpDown size={16} />
      </span>
      <select
        aria-label={ariaLabel}
        value={String(value)}
        disabled={disabled}
        onChange={(e) => {
          const next = options.find(o => String(o.value) === e.target.value)
          if (next) onChange(next.value)
        }}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
      >
        {options.map(o => (
          <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

/** Full-width slider with small/large sun glyphs, systemBlue fill (Display & Brightness). */
export function SliderRow({ value, onChange, onCommit, min = 0, max = 100, step = 1, disabled, ariaLabel, valueLabel, iconMin = Sun, iconMax = Sun }: {
  value: number
  onChange: (value: number) => void
  onCommit?: () => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  ariaLabel: string
  valueLabel?: ReactNode
  iconMin?: LucideIcon
  iconMax?: LucideIcon
}) {
  const MinIcon = iconMin
  const MaxIcon = iconMax
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100
  return (
    <div className={clsx(rowClass, 'min-h-[52px]')}>
      <MinIcon size={15} className="shrink-0 text-zinc-500" />
      <input
        aria-label={ariaLabel}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        disabled={disabled}
        style={{ '--fill': `${pct}%` } as CSSProperties}
        className={clsx(
          'h-[28px] min-w-0 flex-1 cursor-pointer appearance-none bg-transparent outline-none disabled:cursor-not-allowed disabled:opacity-40',
          '[&::-webkit-slider-runnable-track]:h-[4px] [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-sky-500)_var(--fill),var(--color-zinc-700)_var(--fill))]',
          '[&::-webkit-slider-thumb]:-mt-[11.5px] [&::-webkit-slider-thumb]:h-[27px] [&::-webkit-slider-thumb]:w-[27px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.3)]',
          '[&::-moz-range-track]:h-[4px] [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-zinc-700 [&::-moz-range-progress]:h-[4px] [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-sky-500',
          '[&::-moz-range-thumb]:h-[27px] [&::-moz-range-thumb]:w-[27px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white',
        )}
      />
      <MaxIcon size={22} className="shrink-0 text-zinc-500" />
      {valueLabel !== undefined && (
        <span className="ios-numeric w-11 shrink-0 text-right text-[15px] text-zinc-500">{valueLabel}</span>
      )}
    </div>
  )
}

/** UIStepper: joined −/+ buttons. */
export function Stepper({ onDecrement, onIncrement, canDecrement = true, canIncrement = true, label }: {
  onDecrement: () => void
  onIncrement: () => void
  canDecrement?: boolean
  canIncrement?: boolean
  label: string
}) {
  const btn = 'grid h-8 w-[47px] place-items-center text-[22px] leading-none text-white active:bg-zinc-700 disabled:text-zinc-600 disabled:active:bg-transparent'
  return (
    <div className="flex shrink-0 items-center overflow-hidden rounded-[8px] bg-zinc-800">
      <button type="button" aria-label={`Decrease ${label}`} onClick={onDecrement} disabled={!canDecrement} className={btn}>−</button>
      <span className="h-[18px] w-px bg-zinc-600" />
      <button type="button" aria-label={`Increase ${label}`} onClick={onIncrement} disabled={!canIncrement} className={btn}>+</button>
    </div>
  )
}

/** Plain row with arbitrary trailing content (value text, segmented control, stepper). */
export function ControlRow({ title, subtitle, children }: { title: ReactNode, subtitle?: ReactNode, children: ReactNode }) {
  return (
    <div className={rowClass}>
      <RowLabel title={title} subtitle={subtitle} />
      {children}
    </div>
  )
}

/** Full-width primary button (spec: 50pt, systemBlue). */
export function PrimaryButton({ children, onClick, disabled }: { children: ReactNode, onClick: () => void, disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-sky-500 text-[17px] font-semibold text-white active:opacity-80 disabled:opacity-40"
    >
      {children}
    </button>
  )
}
