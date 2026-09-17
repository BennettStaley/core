/**
 * Autopilot console primitives. Kept local (the rule editor needs chips, number
 * steppers and inline selects the shared iOS kit doesn't have), but skinned to
 * match `@/src/ui/ios`: grouped zinc-900 surfaces, systemBlue accent, UISwitch
 * and UISegmentedControl looks, sentence-case 13pt captions.
 */
'use client'

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from './icons'

export function Card({ className = '', children, style }: { className?: string, children: ReactNode, style?: CSSProperties }) {
  return <div className={`rounded-xl bg-zinc-900 ${className}`} style={style}>{children}</div>
}

type ButtonVariant = 'default' | 'ghost' | 'outline' | 'accent' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'
export function Button({
  variant = 'default', size = 'md', className = '', children, onClick, disabled,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  const sizes: Record<ButtonSize, string> = {
    sm: 'min-h-[36px] px-3 text-[15px] gap-1.5 rounded-lg',
    md: 'min-h-[36px] px-3.5 text-[15px] gap-1.5 rounded-lg',
    lg: 'min-h-[50px] px-5 text-[17px] font-semibold gap-2 rounded-xl',
  }
  const variants: Record<ButtonVariant, string> = {
    default: 'bg-zinc-800 text-white active:bg-zinc-700 hover:bg-zinc-700',
    ghost: 'bg-transparent text-sky-400 active:opacity-50 hover:bg-zinc-800/60',
    outline: 'bg-zinc-800 text-sky-400 active:bg-zinc-700 hover:bg-zinc-700',
    accent: 'bg-sky-500 text-white active:opacity-80 hover:opacity-90',
    danger: 'bg-red-500/15 text-red-400 active:bg-red-500/25',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40 ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

type BadgeTone = 'zinc' | 'green' | 'amber' | 'red' | 'accent'
const TONE_TEXT: Record<BadgeTone, string> = {
  zinc: 'text-zinc-500',
  green: 'text-emerald-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
  accent: 'text-sky-400',
}
const TONE_DOT: Record<BadgeTone, string> = {
  zinc: 'bg-zinc-600',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  accent: 'bg-sky-500',
}

/** Quiet status label: optional coloured dot + 13pt text, no pill chrome. */
export function Badge({ tone = 'zinc', className = '', children, dot = false }: { tone?: BadgeTone, className?: string, children: ReactNode, dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] leading-[18px] ${TONE_TEXT[tone]} ${className}`}>
      {dot && <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[tone]}`} />}
      {children}
    </span>
  )
}

export function StatusBadge({ mode }: { mode: 'active' | 'dryrun' | 'paused' }) {
  if (mode === 'active') return <Badge tone="green" dot>Active</Badge>
  if (mode === 'dryrun') return <Badge tone="amber" dot>Dry run</Badge>
  return <Badge tone="zinc" dot>Paused</Badge>
}

export function SideBadge({ side }: { side: 'left' | 'right' | 'both' | null }) {
  const map = { left: 'Left', right: 'Right', both: 'Both sides' } as const
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] leading-[18px] text-zinc-500">
      <Icon.Bed size={14} className="text-zinc-600" />
      {map[side ?? 'both']}
    </span>
  )
}

/** UISwitch look (51x31, systemGreen when on). `size` is accepted for API compatibility. */
export function Toggle({ checked, onChange, tone = 'accent', 'aria-label': ariaLabel }: {
  'checked': boolean
  'onChange': (v: boolean) => void
  'size'?: 'sm' | 'md'
  'tone'?: 'accent' | 'red'
  'aria-label'?: string
}) {
  const onBg = tone === 'red' ? 'bg-red-500' : 'bg-emerald-500'
  return (
    <button
      type="button"
      role="switch"
      onClick={() => onChange(!checked)}
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${checked ? onBg : 'bg-zinc-700'}`}
    >
      <span className={`absolute left-0 top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15)] transition-transform duration-200 ${checked ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
    </button>
  )
}

export interface Option { value: string, label: string, icon?: IconName, hint?: string }
type Opt = string | Option
function norm(o: Opt): Option {
  return typeof o === 'string' ? { value: o, label: o } : o
}

/** UISegmentedControl look. `full` stretches the segments to the container width. */
export function Segmented<T extends string>({ value, options, onChange, full = false, className = '' }: {
  value: T
  options: readonly (T | { value: T, label: string })[]
  onChange: (v: T) => void
  size?: 'sm' | 'md'
  full?: boolean
  className?: string
}) {
  return (
    <div role="radiogroup" className={`${full ? 'flex w-full' : 'inline-flex'} rounded-[9px] bg-zinc-800/80 p-0.5 ${className}`}>
      {options.map((o) => {
        const val = (typeof o === 'string' ? o : o.value) as T
        const lab = typeof o === 'string' ? o : o.label
        const on = val === value
        return (
          <button
            key={val}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(val)}
            className={`min-h-[30px] truncate rounded-[7px] text-[13px] transition-colors ${full ? 'flex-1 px-1.5' : 'px-3'} ${on ? 'bg-zinc-600 font-semibold text-white shadow-[0_3px_8px_rgba(0,0,0,0.12)]' : 'font-medium text-zinc-300'}`}
          >
            {lab}
          </button>
        )
      })}
    </div>
  )
}

export function Select({ value, options, onChange, placeholder = 'Select…', className = '', chip = false }: { value: string, options: Opt[], onChange: (v: string) => void, placeholder?: string, className?: string, chip?: boolean }) {
  const [open, setOpen] = useState(false)
  // Anchor the menu to the right edge when it would run off a narrow screen.
  const [alignRight, setAlignRight] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const opts = options.map(norm)
  const cur = opts.find(o => o.value === value)
  const base = chip
    ? 'inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-zinc-800 px-2.5 text-[15px] text-sky-400 active:bg-zinc-700 hover:bg-zinc-700'
    : 'inline-flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg bg-zinc-800 px-3 text-[15px] text-white active:bg-zinc-700 hover:bg-zinc-700'
  return (
    <div ref={ref} className={`relative ${chip ? 'inline-block' : ''} ${className}`}>
      <button
        type="button"
        onClick={() => {
          const rect = ref.current?.getBoundingClientRect()
          if (rect) setAlignRight(rect.left + 240 > window.innerWidth)
          setOpen(o => !o)
        }}
        className={base}
      >
        <span className={cur ? '' : 'text-zinc-500'}>{cur ? cur.label : placeholder}</span>
        <Icon.ChevDown size={14} className="opacity-60" />
      </button>
      {open && (
        <div
          className="absolute z-50 mt-1 max-h-72 w-max min-w-full max-w-[min(280px,calc(100vw-32px))] overflow-auto rounded-xl bg-zinc-800 p-1 shadow-2xl shadow-black/60"
          style={alignRight ? { right: 0 } : { left: 0 }}
        >
          {opts.map((o) => {
            const I = o.icon ? Icon[o.icon] : null
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                className="flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 text-left text-[17px] text-white active:bg-zinc-700 hover:bg-zinc-700"
              >
                {I ? <I size={16} className="shrink-0 text-zinc-500" /> : null}
                <span className="flex-1 whitespace-nowrap">{o.label}</span>
                {o.hint && <span className="mono text-[13px] text-zinc-500">{o.hint}</span>}
                <span className="w-4 shrink-0">{o.value === value && <Icon.Check size={16} className="text-sky-400" />}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function NumberField({ value, onChange, step = 1, suffix = '', width = 84 }: { value: number, onChange: (v: number) => void, step?: number, suffix?: string, width?: number }) {
  // Draft string keeps the field freely typeable (empty/partial entries) while
  // the numeric value flows up only once it parses; the +/- buttons reuse it.
  // Re-sync the draft during render whenever the external value changes.
  const [draft, setDraft] = useState(String(value))
  const [syncedValue, setSyncedValue] = useState(value)
  if (value !== syncedValue) {
    setSyncedValue(value)
    setDraft(String(value))
  }

  // Reset the draft when stepping so stale text can't survive a parent that
  // clamps back to the same numeric value (no render-time re-sync fires then).
  const applyStep = (delta: number) => {
    setDraft(String(value))
    onChange(value + delta)
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex min-h-[36px] items-stretch overflow-hidden rounded-lg bg-zinc-800" style={{ width: Math.max(width + 16, 108) }}>
        <button type="button" aria-label="Decrease" onClick={() => applyStep(-step)} className="px-2 text-zinc-400 active:bg-zinc-700 hover:text-white"><Icon.Minus size={14} /></button>
        <input
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            const n = Number(e.target.value)
            if (e.target.value.trim() !== '' && Number.isFinite(n)) onChange(n)
          }}
          onBlur={() => setDraft(String(value))}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className="ios-numeric min-w-0 flex-1 bg-transparent px-0.5 text-center text-[16px] text-white focus:outline-none"
        />
        <button type="button" aria-label="Increase" onClick={() => applyStep(step)} className="px-2 text-zinc-400 active:bg-zinc-700 hover:text-white"><Icon.Plus size={14} /></button>
      </span>
      {suffix && <span className="text-[15px] text-zinc-500">{suffix}</span>}
    </span>
  )
}

/** Group heading inside an editor card: coloured icon tile, 17pt title, 13pt caption. */
export function SectionLabel({ kicker, color, icon, desc, right }: { kicker: string, color: string, icon: IconName, desc?: string, right?: ReactNode }) {
  const I = Icon[icon]
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-[29px] w-[29px] shrink-0 place-items-center rounded-[7px] text-white" style={{ background: color }}>
          {I && <I size={16} />}
        </span>
        <div className="min-w-0">
          <div className="text-[17px] font-semibold leading-[22px] text-white">{kicker}</div>
          {desc && <div className="text-[13px] leading-[18px] text-zinc-500">{desc}</div>}
        </div>
      </div>
      {right}
    </div>
  )
}
