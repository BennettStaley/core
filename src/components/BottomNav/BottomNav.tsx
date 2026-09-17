'use client'

import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Calendar, Ellipsis, Moon, SlidersHorizontal, Thermometer } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { useScheduleActive } from '@/src/hooks/useScheduleActive'

/**
 * iOS-style tab bar. Everyday surfaces get a tab; tools (sensors, status,
 * settings, diagnostics) live under More so the bar stays at five items.
 * `matches` lists extra route prefixes that should highlight the tab.
 */
const tabs = [
  { id: 'temp', icon: Thermometer, label: msg`Tonight`, href: '/', matches: [] as string[] },
  { id: 'schedule', icon: Calendar, label: msg`Schedule`, href: '/schedule', matches: [] as string[] },
  { id: 'data', icon: Moon, label: msg`Sleep`, href: '/data', matches: [] as string[] },
  { id: 'autopilot', icon: SlidersHorizontal, label: msg`Autopilot`, href: '/autopilot', matches: [] as string[] },
  { id: 'more', icon: Ellipsis, label: msg`More`, href: '/more', matches: ['/sensors', '/status', '/settings', '/debug'] },
]

/**
 * Global bottom navigation component with routing.
 * Highlights the active tab based on the current pathname.
 */
export const BottomNav = () => {
  const { i18n } = useLingui()
  const pathname = usePathname()
  const { isActive: scheduleActive } = useScheduleActive()

  // Extract the path segment after /[lang]/ to determine active tab
  const getIsActive = (href: string, matches: string[]) => {
    if (!pathname) return false
    // Remove the language prefix (e.g., /en/schedule -> /schedule)
    const segments = pathname.split('/')
    const pathWithoutLang = '/' + segments.slice(2).join('/')
    if (href === '/') return pathWithoutLang === '/' || pathWithoutLang === ''
    return [href, ...matches].some(prefix => pathWithoutLang.startsWith(prefix))
  }

  // Get the language prefix from the current pathname
  const lang = pathname?.split('/')[1] ?? 'en'

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-900 bg-black/85 px-2 pt-1.5 backdrop-blur-xl"
      style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="mx-auto flex max-w-md justify-between md:max-w-lg">
        {tabs.map((tab) => {
          const isActive = getIsActive(tab.href, tab.matches)
          return (
            <Link
              key={tab.id}
              href={`/${lang}${tab.href}`}
              aria-current={isActive ? 'page' : undefined}
              className="group flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-1 active:opacity-60"
            >
              <span className="relative">
                <tab.icon
                  size={22}
                  strokeWidth={isActive ? 2.25 : 1.75}
                  className={clsx(
                    'shrink-0 transition-colors',
                    isActive ? 'text-sky-400' : 'text-zinc-500'
                  )}
                />
                {tab.id === 'schedule' && scheduleActive && (
                  <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-emerald-400" />
                )}
              </span>
              <span
                className={clsx(
                  'truncate text-[10px] font-medium leading-none',
                  isActive ? 'text-sky-400' : 'text-zinc-500'
                )}
              >
                {i18n._(tab.label)}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
