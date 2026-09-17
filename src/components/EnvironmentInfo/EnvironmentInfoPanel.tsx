'use client'

import type { ReactNode } from 'react'
import { trpc } from '@/src/utils/trpc'
import { formatTemp, type TempUnit } from '@/src/lib/tempUtils'

interface EnvironmentInfoProps {
  /** Seconds remaining from auto-off timer, if available */
  secondsRemaining?: number | null
  /** Temperature unit preference */
  unit?: TempUnit
  /** Extra trailing items for the footnote line (e.g. ambient light). */
  children?: ReactNode
}

/**
 * Quiet footnote line under the dial with environment data:
 * - Inside (room) temperature from the bed temp sensor
 * - Auto-off timer countdown (when active)
 */
export const EnvironmentInfoPanel = ({ secondsRemaining, unit = 'F', children }: EnvironmentInfoProps) => {
  const { data: bedTemp } = trpc.environment.getLatestBedTemp.useQuery(
    { unit },
    { refetchInterval: 10_000 },
  )

  // Ambient/room temp comes from bed temp sensor
  const ambientTemp = bedTemp?.ambientTemp

  const formatTimeRemaining = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const hasAmbient = ambientTemp != null && ambientTemp > 0
  const hasTimer = secondsRemaining != null && secondsRemaining > 0

  if (!hasAmbient && !hasTimer && !children) {
    return null
  }

  return (
    <p className="ios-numeric flex flex-wrap items-center justify-center gap-x-4 text-center text-[13px] leading-[18px] text-zinc-500">
      {hasAmbient && (
        <span>
          Inside
          {' '}
          {formatTemp(ambientTemp, unit)}
        </span>
      )}
      {hasTimer && (
        <span>
          Off in
          {' '}
          {formatTimeRemaining(secondsRemaining)}
        </span>
      )}
      {children}
    </p>
  )
}
