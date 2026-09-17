'use client'

import type { StageDistribution, SleepStage } from '@/src/lib/sleep-stages'
import { formatDurationHM } from '@/src/lib/sleep-stages'
import { STAGE_COLORS, STAGE_LABELS, STAGE_ORDER } from './stageColors'

interface StageDistributionBarProps {
  distribution: StageDistribution
  /** Optional epochs to show time spent per stage alongside the percentage. */
  epochs?: { stage: SleepStage, duration: number }[]
}

/**
 * Thin stacked bar plus a four-column breakdown (label, time, percentage).
 */
export function StageDistributionBar({ distribution, epochs }: StageDistributionBarProps) {
  const total = distribution.wake + distribution.light + distribution.deep + distribution.rem
  if (total === 0) return null

  const durations: Record<SleepStage, number> = { wake: 0, light: 0, deep: 0, rem: 0 }
  for (const e of epochs ?? []) durations[e.stage] += e.duration

  return (
    <div className="space-y-3">
      <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full">
        {STAGE_ORDER.map((key) => {
          const pct = distribution[key]
          if (pct === 0) return null
          return <div key={key} className="h-full" style={{ width: `${pct}%`, backgroundColor: STAGE_COLORS[key] }} />
        })}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {STAGE_ORDER.map(key => (
          <div key={key} className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: STAGE_COLORS[key] }} />
              <span className="truncate text-[13px] leading-[18px] text-zinc-500">{STAGE_LABELS[key]}</span>
            </div>
            <p className="ios-numeric truncate text-[15px] leading-5 text-white">
              {epochs ? formatDurationHM(durations[key]) : `${distribution[key]}%`}
            </p>
            {epochs && (
              <p className="ios-numeric text-[13px] leading-[18px] text-zinc-500">
                {distribution[key]}
                %
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
