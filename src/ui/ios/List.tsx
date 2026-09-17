import clsx from 'clsx'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

interface ListSectionProps {
  /** Small grey caption above the group (sentence case, not uppercase). */
  header?: ReactNode
  /** Explanatory text below the group. */
  footer?: ReactNode
  className?: string
  children: ReactNode
}

/** Inset grouped list section, like Settings.app. Rows are separated by hairlines. */
export function ListSection({ header, footer, className, children }: ListSectionProps) {
  return (
    <section className={clsx('space-y-1.5', className)}>
      {header && <h2 className="px-4 text-[13px] leading-[18px] text-zinc-500">{header}</h2>}
      <div className="overflow-hidden rounded-xl bg-zinc-900 [&>*+*]:border-t [&>*+*]:border-zinc-800">
        {children}
      </div>
      {footer && <p className="px-4 text-[13px] leading-[18px] text-zinc-500">{footer}</p>}
    </section>
  )
}

interface ListRowProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Right-aligned secondary value (e.g. "72°F", "On"). */
  value?: ReactNode
  icon?: LucideIcon
  /** Background class for the rounded icon tile, e.g. `bg-sky-500`. Omit for a bare icon. */
  iconTile?: string
  href?: string
  onClick?: () => void
  /** Trailing control; defaults to a chevron when the row navigates. */
  accessory?: ReactNode
  destructive?: boolean
  disabled?: boolean
}

/** A single 44pt+ row inside a ListSection. Renders a Link, button, or plain div. */
export function ListRow({ title, subtitle, value, icon: Icon, iconTile, href, onClick, accessory, destructive, disabled }: ListRowProps) {
  const interactive = Boolean(href || onClick)
  const trailing = accessory ?? (href ? <ChevronRight size={18} className="text-zinc-600" /> : null)
  const content = (
    <>
      {Icon && (
        iconTile
          ? (
              <span className={clsx('grid h-[29px] w-[29px] shrink-0 place-items-center rounded-[7px] text-white', iconTile)}>
                <Icon size={17} strokeWidth={2} />
              </span>
            )
          : <Icon size={20} className="shrink-0 text-sky-400" />
      )}
      <span className="min-w-0 flex-1 py-2.5">
        <span className={clsx('block text-[17px] leading-[22px]', destructive ? 'text-red-400' : 'text-white')}>{title}</span>
        {subtitle && <span className="block text-[13px] leading-[18px] text-zinc-500">{subtitle}</span>}
      </span>
      {value !== undefined && <span className="ios-numeric shrink-0 text-[17px] text-zinc-500">{value}</span>}
      {trailing}
    </>
  )
  const className = clsx(
    'flex min-h-[44px] w-full items-center gap-3 px-4 text-left',
    interactive && !disabled && 'active:bg-zinc-800',
    disabled && 'opacity-40',
  )
  if (href && !disabled) return <Link href={href} className={className}>{content}</Link>
  if (onClick) return <button type="button" onClick={onClick} disabled={disabled} className={className}>{content}</button>
  return <div className={className}>{content}</div>
}
