'use client'

import clsx from 'clsx'
import type { StageDistribution, SleepStage } from '@/src/lib/sleep-stages'
import { formatDurationHM } from '@/src/lib/sleep-stages'
import { CHART_GRID } from '@/src/components/biometrics/ChartCard'
import { STAGE_COLORS } from './stageColors'

interface NightSummary {
  date: string // ISO date string (YYYY-MM-DD)
  dayLabel: string // "Mon", "Tue", etc.
  totalSleepHours: number
  distribution: StageDistribution
  qualityScore: number
}

interface WeeklySleepChartProps {
  nights: NightSummary[]
  onSelectNight?: (date: string) => void
  selectedDate?: string | null
}

// Stacked top → bottom inside each bar: awake, REM, light, deep.
const STAGES: SleepStage[] = ['wake', 'rem', 'light', 'deep']
const MAX_HOURS = 12
const TRACK_HEIGHT = 120
const LABEL_HEIGHT = 18

/**
 * Seven nightly bars (time asleep), each split by sleep stage.
 * Tap a bar to drill into that night.
 */
export function WeeklySleepChart({ nights, onSelectNight, selectedDate }: WeeklySleepChartProps) {
  if (nights.length === 0) {
    return <p className="py-6 text-center text-[15px] text-zinc-500">No sleep recorded this week.</p>
  }

  return (
    <div className="w-full">
      <div className="relative flex items-end gap-1.5" style={{ height: TRACK_HEIGHT + LABEL_HEIGHT }}>
        {/* Gridlines at 4h / 8h / 12h */}
        {[4, 8, 12].map(h => (
          <div
            key={h}
            className="pointer-events-none absolute inset-x-0 h-px"
            style={{ bottom: (h / MAX_HOURS) * TRACK_HEIGHT, backgroundColor: CHART_GRID }}
          />
        ))}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px" style={{ backgroundColor: CHART_GRID }} />

        {nights.map((night) => {
          const hasSleep = night.totalSleepHours > 0
          const barHeightPx = hasSleep ? Math.max(Math.round((Math.min(night.totalSleepHours, MAX_HOURS) / MAX_HOURS) * TRACK_HEIGHT), 4) : 0
          const dimmed = selectedDate != null && selectedDate !== night.date
          const distributionTotal = STAGES.reduce((sum, s) => sum + night.distribution[s], 0)
          const hasStageData = distributionTotal > 0

          return (
            <button
              type="button"
              key={night.date}
              onClick={() => hasSleep && onSelectNight?.(night.date)}
              disabled={!hasSleep}
              aria-pressed={selectedDate === night.date}
              aria-label={`${night.dayLabel}: ${hasSleep ? formatDurationHM(night.totalSleepHours * 3_600_000) : 'no sleep'}`}
              className={clsx('relative flex h-full flex-1 flex-col items-center justify-end transition-opacity', dimmed && 'opacity-40')}
            >
              {hasSleep && (
                <span className="ios-numeric relative whitespace-nowrap bg-zinc-900 px-0.5 text-[11px] leading-[18px] text-zinc-500">
                  {formatDurationHM(night.totalSleepHours * 3_600_000)}
                </span>
              )}
              <div
                className="flex w-full max-w-[28px] flex-col overflow-hidden rounded-t-[4px]"
                style={{ height: barHeightPx, backgroundColor: hasStageData ? undefined : '#48484A' }}
              >
                {hasStageData && STAGES.map((stage) => {
                  const pct = night.distribution[stage]
                  if (pct === 0) return null
                  return <div key={stage} className="w-full" style={{ height: `${pct}%`, backgroundColor: STAGE_COLORS[stage] }} />
                })}
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-1.5 flex gap-1.5">
        {nights.map(night => (
          <div
            key={night.date}
            className={clsx('flex-1 text-center text-[11px]', selectedDate === night.date ? 'font-semibold text-white' : 'text-zinc-500')}
          >
            {night.dayLabel}
          </div>
        ))}
      </div>
    </div>
  )
}
