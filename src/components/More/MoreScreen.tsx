'use client'

import { Trans } from '@lingui/react/macro'
import { Activity, ChevronRight, Gauge, Radio, Settings, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { trpc } from '@/src/utils/trpc'

interface MoreRow {
  href: string
  icon: LucideIcon
  /** Tailwind classes for the rounded icon tile (iOS Settings style). */
  tile: string
  title: ReactNode
  subtitle: ReactNode
}

/**
 * "More" tab — an iOS-style grouped list for the tools that don't earn a
 * tab-bar slot: settings, system status, live sensors and diagnostics.
 */
export function MoreScreen() {
  const pathname = usePathname()
  const lang = pathname?.split('/')[1] || 'en'
  const version = trpc.system.getVersion.useQuery({}, { staleTime: 60_000 })

  const groups: { header: ReactNode, rows: MoreRow[] }[] = [
    {
      header: <Trans>Pod</Trans>,
      rows: [
        {
          href: '/settings',
          icon: Settings,
          tile: 'bg-zinc-600',
          title: <Trans>Settings</Trans>,
          subtitle: <Trans>Device, sides, gestures, HomeKit</Trans>,
        },
        {
          href: '/status',
          icon: Activity,
          tile: 'bg-emerald-600',
          title: <Trans>Status</Trans>,
          subtitle: <Trans>Service health, updates, logs</Trans>,
        },
      ],
    },
    {
      header: <Trans>Tools</Trans>,
      rows: [
        {
          href: '/sensors',
          icon: Radio,
          tile: 'bg-sky-600',
          title: <Trans>Sensors</Trans>,
          subtitle: <Trans>Live presence, bed temperature, humidity</Trans>,
        },
        {
          href: '/debug',
          icon: Gauge,
          tile: 'bg-violet-600',
          title: <Trans>Diagnostics</Trans>,
          subtitle: <Trans>Thermal delivery and scheduler internals</Trans>,
        },
      ],
    },
  ]

  return (
    <div className="space-y-6 pb-4">
      <h1 className="px-1 text-3xl font-bold tracking-tight text-white">
        <Trans>More</Trans>
      </h1>

      {groups.map((group, index) => (
        <section key={index} className="space-y-2">
          <h2 className="px-4 text-xs font-medium uppercase tracking-wide text-zinc-500">
            {group.header}
          </h2>
          <ul className="overflow-hidden rounded-2xl bg-zinc-900/80">
            {group.rows.map(row => (
              <li key={row.href} className="border-b border-zinc-800/80 last:border-b-0">
                <Link
                  href={`/${lang}${row.href}`}
                  className="flex min-h-[56px] items-center gap-3 px-4 py-2.5 active:bg-zinc-800"
                >
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white ${row.tile}`}>
                    <row.icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] text-white">{row.title}</span>
                    <span className="block truncate text-xs text-zinc-500">{row.subtitle}</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-zinc-600" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {version.data && (
        <p className="text-center text-xs text-zinc-600">
          sleepypod
          {' '}
          {version.data.branch}
          {' · '}
          {version.data.commitHash}
        </p>
      )}
    </div>
  )
}
