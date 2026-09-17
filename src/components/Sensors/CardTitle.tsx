import type { ReactNode } from 'react'

/** iOS system colours used by the sensor charts (match app/globals.css remaps). */
export const LEFT_COLOR = '#0A84FF'
export const RIGHT_COLOR = '#40C8E0'
export const WARM_COLOR = '#FF9F0A'
export const GRID_COLOR = '#2C2C2E'
export const AXIS_COLOR = '#8E8E93'

/** Shared recharts tooltip style — grouped surface, no border. */
export const TOOLTIP_STYLE = {
  backgroundColor: '#2C2C2E',
  border: 'none',
  borderRadius: 10,
  fontSize: 13,
  color: '#fff',
} as const

/**
 * Card heading for sensor groups: 17pt semibold title with optional 13pt
 * grey meta (timestamp, "Stored") and a trailing control.
 */
export function CardTitle({ title, meta, trailing }: { title: ReactNode, meta?: ReactNode, trailing?: ReactNode }) {
  return (
    <div className="flex min-h-[28px] items-center justify-between gap-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <h3 className="truncate text-[17px] font-semibold leading-[22px] text-white">{title}</h3>
        {meta && <span className="ios-numeric shrink-0 text-[13px] text-zinc-500">{meta}</span>}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
    </div>
  )
}

/** Calm empty/waiting state used inside sensor cards. */
export function EmptyState({ icon, text, height = 'h-28' }: { icon?: ReactNode, text: ReactNode, height?: string }) {
  return (
    <div className={`flex ${height} flex-col items-center justify-center gap-2 text-center`}>
      {icon && <span className="text-zinc-600">{icon}</span>}
      <span className="text-[15px] text-zinc-500">{text}</span>
    </div>
  )
}
