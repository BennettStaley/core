import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: ReactNode
  /** Secondary line under the title (e.g. side name, date). */
  subtitle?: ReactNode
  /** Right-aligned content on the title baseline (chips, buttons, segmented control). */
  trailing?: ReactNode
}

/**
 * iOS large-title header (34pt bold). Every tab screen starts with one; the
 * app has no global toolbar.
 */
export function PageHeader({ title, subtitle, trailing }: PageHeaderProps) {
  return (
    <header className="flex items-end justify-between gap-3 px-1 pb-1 pt-1">
      <div className="min-w-0">
        <h1 className="truncate text-[34px] font-bold leading-[41px] tracking-tight text-white">{title}</h1>
        {subtitle && <p className="truncate text-[15px] leading-5 text-zinc-500">{subtitle}</p>}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-2 pb-1.5">{trailing}</div>}
    </header>
  )
}
