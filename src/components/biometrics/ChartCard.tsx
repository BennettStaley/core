import clsx from 'clsx'
import type { ReactNode } from 'react'

/** Shared chart styling for the Sleep screen (see docs/design/ios-design-system.md#charts). */
export const CHART_GRID = '#2C2C2E'
export const CHART_AXIS = '#8E8E93'
export const CHART_FONT_SIZE = 11

/** One system colour per metric. */
export const METRIC_COLORS = {
  hr: '#FF453A', // systemRed
  hrv: '#BF5AF2', // systemPurple
  br: '#40C8E0', // systemTeal
  movement: '#30D158', // systemGreen
} as const

/** Secondary series (other side) in dual-side comparisons. */
export const SECONDARY_SERIES_COLOR = '#8E8E93'

interface ChartCardProps {
  title: ReactNode
  /** Right side of the title row, usually a value like `57 bpm`. */
  trailing?: ReactNode
  /** Grey 13pt line under the title. */
  footnote?: ReactNode
  className?: string
  children?: ReactNode
}

/** Grouped `rounded-xl bg-zinc-900` surface with a 17pt headline row. */
export function ChartCard({ title, trailing, footnote, className, children }: ChartCardProps) {
  return (
    <section className={clsx('rounded-xl bg-zinc-900 px-4 pb-4 pt-3', className)}>
      <div className="flex min-h-[28px] items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-[17px] font-semibold leading-[22px] text-white">{title}</h2>
        {trailing && <div className="ios-numeric shrink-0 text-[15px] text-zinc-500">{trailing}</div>}
      </div>
      {footnote && <p className="text-[13px] leading-[18px] text-zinc-500">{footnote}</p>}
      {children && <div className="mt-3">{children}</div>}
    </section>
  )
}

/** White value with a grey unit, e.g. `57 bpm`. */
export function MetricValue({ value, unit, className }: { value: ReactNode, unit?: ReactNode, className?: string }) {
  return (
    <span className={clsx('ios-numeric whitespace-nowrap', className)}>
      <span className="font-semibold text-white">{value}</span>
      {unit && (
        <span className="text-zinc-500">
          {' '}
          {unit}
        </span>
      )}
    </span>
  )
}
