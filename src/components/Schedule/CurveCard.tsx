'use client'

import { useId, useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import type { ScheduleGroup } from '@/src/lib/scheduleGrouping'
import { sortChronological } from '@/src/lib/scheduleGrouping'
import { formatTime12h } from './TimeInput'
import { useTemperatureUnit } from '@/src/hooks/useTemperatureUnit'
import { formatSetpointF } from '@/src/lib/tempUtils'
import { formatDays, tempTint } from './scheduleFormat'

interface CurveCardProps {
  group: ScheduleGroup
  /** Opens the curve editor (which also hosts Delete). */
  onEdit: () => void
  /** True when this curve covers today and the schedule is enabled */
  isActive?: boolean
  /** Next upcoming set point (only meaningful when isActive) */
  nextEvent?: { time: string, temperature: number } | null
}

/**
 * One curve as a grouped-list row: days on top, bedtime → wake and the
 * temperature range underneath, a thin sparkline and a disclosure chevron.
 * Tapping anywhere opens the editor.
 */
export function CurveCard({ group, onEdit, isActive = false, nextEvent = null }: CurveCardProps) {
  const { unit } = useTemperatureUnit()
  const hasSetPoints = group.setPoints.length > 0
  const label = formatDays(group.days)

  const summary = useMemo(() => {
    if (!hasSetPoints) return null
    const temps = group.setPoints.map(p => p.temperature)
    const sorted = sortChronological(group.setPoints)
    const min = formatSetpointF(Math.min(...temps), unit)
    const max = formatSetpointF(Math.max(...temps), unit)
    return {
      window: sorted.length >= 2
        ? `${formatTime12h(sorted[0].time)} – ${formatTime12h(sorted[sorted.length - 1].time)}`
        : formatTime12h(sorted[0].time),
      range: min === max ? min : `${min}–${max}`,
    }
  }, [group.setPoints, hasSetPoints, unit])

  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Edit ${label} curve`}
      className="flex min-h-[44px] w-full items-center gap-3 py-2.5 pl-4 pr-3 text-left active:bg-zinc-800"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-[17px] leading-[22px] text-white">{label}</span>
          {isActive && hasSetPoints && <span className="shrink-0 text-[13px] text-emerald-400">Active</span>}
          {group.allDisabled && <span className="shrink-0 text-[13px] text-amber-400">Paused</span>}
        </span>
        {summary
          ? (
              <span className="ios-numeric block truncate text-[15px] leading-5 text-zinc-500">
                {summary.window}
                {' · '}
                {summary.range}
              </span>
            )
          : <span className="block text-[15px] leading-5 text-zinc-500">No set points</span>}
        {isActive && nextEvent && (
          <span className="ios-numeric block truncate text-[13px] leading-[18px] text-zinc-500">
            Next
            {' '}
            {nextEvent.time}
            {' at '}
            {formatSetpointF(nextEvent.temperature, unit)}
          </span>
        )}
      </span>
      {hasSetPoints && <Sparkline setPoints={group.setPoints} />}
      <ChevronRight size={18} className="shrink-0 text-zinc-600" />
    </button>
  )
}

// ── Sparkline ──────────────────────────────────────────────────────

const SPARK_W = 64
const SPARK_H = 28

interface SparklineProps {
  setPoints: Array<{ time: string, temperature: number }>
}

/** 64×28 line, 1.5px, tinted cool → warm along the night. No fill, no dots. */
function Sparkline({ setPoints }: SparklineProps) {
  const id = `spark-${useId().replace(/:/g, '')}`

  const shape = useMemo(() => {
    const sorted = sortChronological(setPoints)
    if (sorted.length < 2) return null
    // Minutes along the night, unwrapping past midnight so the line runs left → right.
    const xs: number[] = []
    for (const p of sorted) {
      const [h, m] = p.time.split(':').map(Number)
      let minutes = h * 60 + m
      while (xs.length > 0 && minutes < xs[xs.length - 1]) minutes += 24 * 60
      xs.push(minutes)
    }
    const temps = sorted.map(p => p.temperature)
    const minX = xs[0]
    const rangeX = xs[xs.length - 1] - minX || 1
    const minT = Math.min(...temps)
    const rangeT = Math.max(...temps) - minT || 1
    const pad = 2
    const pts = sorted.map((p, i) => ({
      x: pad + ((xs[i] - minX) / rangeX) * (SPARK_W - pad * 2),
      y: pad + (1 - (p.temperature - minT) / rangeT) * (SPARK_H - pad * 2),
      color: tempTint(p.temperature),
      offset: (pad + ((xs[i] - minX) / rangeX) * (SPARK_W - pad * 2)) / SPARK_W,
    }))
    return {
      d: pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
      stops: pts,
    }
  }, [setPoints])

  if (!shape) return null

  return (
    <svg width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} className="shrink-0" aria-hidden>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={SPARK_W} y2={0}>
          {shape.stops.map((s, i) => (
            <stop key={i} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>
      <path d={shape.d} fill="none" stroke={`url(#${id})`} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
