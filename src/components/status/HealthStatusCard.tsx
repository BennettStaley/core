'use client'

import { ChevronRight, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────

type ServiceStatus = 'ok' | 'degraded' | 'error' | 'unknown'

interface ServiceItem {
  name: string
  description?: string
  status: ServiceStatus
  detail?: string
}

interface HealthStatusCardProps {
  /** Category title */
  title: string
  /** Short subtitle */
  description: string
  /** Lucide icon component */
  icon: LucideIcon
  /** Accent color for the icon (Tailwind text color class) */
  iconColor: string
  /** Background tint for the icon (Tailwind bg color class) */
  iconBg: string
  /** Individual services/checks in this category */
  services: ServiceItem[]
  /** Whether data is loading */
  isLoading?: boolean
  /** Additional content to render when expanded (e.g. upcoming jobs) */
  expandedContent?: React.ReactNode
  /** Optional callback when header is clicked (overrides default expand behavior) */
  onHeaderClick?: () => void
  /** Start expanded (desktop dashboards have room to show all detail). */
  defaultExpanded?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Solid iOS-Settings-style tile colours keyed by the accent text class callers
 * pass. Literal class names so Tailwind generates them.
 */
const SOLID_TILES: Record<string, string> = {
  'text-sky-400': 'bg-sky-500',
  'text-purple-400': 'bg-purple-500',
  'text-orange-400': 'bg-orange-500',
  'text-teal-400': 'bg-teal-500',
  'text-cyan-400': 'bg-cyan-500',
  'text-emerald-400': 'bg-emerald-500',
  'text-amber-400': 'bg-amber-500',
  'text-red-400': 'bg-red-500',
  'text-indigo-400': 'bg-indigo-500',
}

const STATUS_DOT: Record<ServiceStatus, string> = {
  ok: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  error: 'bg-red-500',
  unknown: 'bg-zinc-600',
}

const STATUS_LABEL: Record<ServiceStatus, string> = {
  ok: 'Healthy',
  degraded: 'Degraded',
  error: 'Error',
  unknown: 'Unknown',
}

export function StatusDot({ status, className }: { status: ServiceStatus, className?: string }) {
  return (
    <span
      role="img"
      aria-label={STATUS_LABEL[status]}
      className={clsx('inline-block h-2 w-2 shrink-0 rounded-full', STATUS_DOT[status], className)}
    />
  )
}

// ─── Component ────────────────────────────────────────────────────────

export function HealthStatusCard({
  title,
  description,
  icon: Icon,
  iconColor,
  iconBg,
  services,
  isLoading,
  expandedContent,
  onHeaderClick,
  defaultExpanded = false,
}: HealthStatusCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const healthyCount = services.filter(s => s.status === 'ok').length
  const totalCount = services.length
  const hasError = services.some(s => s.status === 'error')
  const summaryStatus: ServiceStatus = totalCount === 0
    ? 'unknown'
    : healthyCount === totalCount ? 'ok' : hasError ? 'error' : 'degraded'
  const solidTile = SOLID_TILES[iconColor]

  return (
    <div className="overflow-hidden rounded-xl bg-zinc-900">
      {/* Header row — tap to expand (or open a detail sheet) */}
      <button
        type="button"
        aria-expanded={onHeaderClick ? undefined : isExpanded}
        className="flex min-h-[60px] w-full items-center gap-3 px-4 text-left active:bg-zinc-800"
        onClick={() => onHeaderClick ? onHeaderClick() : setIsExpanded(prev => !prev)}
      >
        <span
          className={clsx(
            'grid h-[29px] w-[29px] shrink-0 place-items-center rounded-[7px]',
            solidTile ? clsx(solidTile, 'text-white') : clsx(iconBg, iconColor),
          )}
        >
          <Icon size={17} strokeWidth={2} />
        </span>

        <span className="min-w-0 flex-1 py-2.5">
          <span className="block text-[17px] leading-[22px] text-white">{title}</span>
          <span className="block truncate text-[13px] leading-[18px] text-zinc-500">{description}</span>
        </span>

        {isLoading
          ? <span className="shrink-0 text-[17px] text-zinc-600">…</span>
          : (
              <span className="flex shrink-0 items-center gap-2">
                <StatusDot status={summaryStatus} />
                <span className="ios-numeric text-[17px] text-zinc-500">
                  {healthyCount}
                  /
                  {totalCount}
                </span>
              </span>
            )}

        <ChevronRight
          size={18}
          className={clsx(
            'shrink-0 text-zinc-600 transition-transform duration-200',
            !onHeaderClick && isExpanded && 'rotate-90',
          )}
        />
      </button>

      {/* Expanded service rows */}
      {isExpanded && (
        <div className="border-t border-zinc-800">
          {services.length === 0 && (
            <p className="px-4 py-3 pl-[60px] text-[15px] text-zinc-500">
              {isLoading ? 'Checking…' : 'Nothing to report'}
            </p>
          )}
          <div className="[&>*+*]:border-t [&>*+*]:border-zinc-800">
            {services.map(service => (
              <div key={service.name} className="ml-[60px] flex min-h-[44px] items-center gap-3 py-2 pr-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] leading-5 text-white">{service.name}</p>
                  {service.description && (
                    <p className="truncate text-[13px] leading-[18px] text-zinc-500">{service.description}</p>
                  )}
                  {service.detail && (
                    <p className="truncate text-[13px] leading-[18px] text-zinc-600">{service.detail}</p>
                  )}
                </div>
                <StatusDot status={service.status} />
              </div>
            ))}
          </div>

          {expandedContent && (
            <div className="ml-[60px] border-t border-zinc-800 py-3 pr-4">
              {expandedContent}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
