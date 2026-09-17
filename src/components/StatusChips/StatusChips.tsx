'use client'

import { useEffect, useState } from 'react'
import { Moon, Plane } from 'lucide-react'
import { useSide } from '@/src/providers/SideProvider'
import { trpc } from '@/src/utils/trpc'
import { isInWindowForTimezone } from '@/src/lib/scheduleTime'

/**
 * Small state capsules for the active side: "Away" when away mode is on and
 * "Night" while LED night mode is inside its time window. Renders nothing when
 * neither applies. Lives in the Tonight header (the app has no global toolbar).
 */
export function StatusChips() {
  const { primarySide } = useSide()
  const { data: settings } = trpc.settings.getAll.useQuery({}, { staleTime: 30_000 })

  const sideSettings = primarySide === 'left' ? settings?.sides?.left : settings?.sides?.right
  const isAway = sideSettings?.awayMode ?? false

  const device = settings?.device
  // Re-evaluate the night window once a minute.
  const [, setMinuteTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setMinuteTick(tick => tick + 1), 60_000)
    return () => clearInterval(id)
  }, [])
  const isNight = Boolean(
    device?.ledNightModeEnabled
    && device.ledNightStartTime
    && device.ledNightEndTime
    && isInWindowForTimezone(device.ledNightStartTime, device.ledNightEndTime, device.timezone),
  )

  if (!isAway && !isNight) return null

  return (
    <>
      {isAway && (
        <span className="flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-1 text-[13px] font-medium text-zinc-300">
          <Plane size={13} />
          Away
        </span>
      )}
      {isNight && (
        <span className="flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-1 text-[13px] font-medium text-zinc-300">
          <Moon size={13} />
          Night
        </span>
      )}
    </>
  )
}
