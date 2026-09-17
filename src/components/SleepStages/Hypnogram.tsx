'use client'

import { useMemo, useState, useCallback } from 'react'
import type { SleepStage } from '@/src/lib/sleep-stages'
import { CHART_AXIS, CHART_FONT_SIZE, CHART_GRID } from '@/src/components/biometrics/ChartCard'
import { useElementWidth } from '@/src/components/biometrics/useElementWidth'
import { STAGE_COLORS, STAGE_LABELS, STAGE_ORDER } from './stageColors'

interface HypnogramBlock {
  start: number
  end: number
  stage: SleepStage
}

interface HypnogramEpoch {
  start: number
  duration: number
  stage: SleepStage
  heartRate: number | null
  hrv: number | null
  breathingRate: number | null
}

interface HypnogramProps {
  blocks: HypnogramBlock[]
  epochs: HypnogramEpoch[]
  startTime: number // unix ms
  endTime: number // unix ms
}

const CHART_HEIGHT = 156
const PAD_LEFT = 46
const PAD_RIGHT = 2
const PAD_TOP = 2
const PAD_BOTTOM = 22
const BAND_HEIGHT = (CHART_HEIGHT - PAD_TOP - PAD_BOTTOM) / STAGE_ORDER.length

function formatHour(ms: number): string {
  const h = new Date(ms).getHours()
  return `${h % 12 || 12}${h >= 12 ? 'PM' : 'AM'}`
}

function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

/**
 * Sleep stages over time (Health-style): one horizontal band per stage,
 * awake on top, deep at the bottom. Tap to inspect an epoch's vitals.
 */
export function Hypnogram({ blocks, epochs, startTime, endTime }: HypnogramProps) {
  const [selectedEpoch, setSelectedEpoch] = useState<HypnogramEpoch | null>(null)
  const [measureRef, width] = useElementWidth<HTMLDivElement>()

  const totalDuration = endTime - startTime
  const plotWidth = Math.max(1, width - PAD_LEFT - PAD_RIGHT)

  const timeToX = useCallback(
    (t: number) => (totalDuration <= 0 ? PAD_LEFT : PAD_LEFT + ((t - startTime) / totalDuration) * plotWidth),
    [startTime, totalDuration, plotWidth],
  )

  const stageTop = (stage: SleepStage) => PAD_TOP + STAGE_ORDER.indexOf(stage) * BAND_HEIGHT

  // Hour ticks; skip to every 2nd/3rd hour when labels would collide.
  const timeTicks = useMemo(() => {
    const hours = totalDuration / 3_600_000
    const step = hours > 0 && plotWidth / hours < 46 ? (plotWidth / hours < 24 ? 3 : 2) : 1
    const ticks: number[] = []
    const first = new Date(startTime)
    first.setMinutes(0, 0, 0)
    let tick = first.getTime() + 3_600_000
    while (tick < endTime) {
      if (new Date(tick).getHours() % step === 0) ticks.push(tick)
      tick += 3_600_000
    }
    return ticks
  }, [startTime, endTime, totalDuration, plotWidth])

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (epochs.length === 0) return
      const rect = e.currentTarget.getBoundingClientRect()
      const clickTime = startTime + ((e.clientX - rect.left - PAD_LEFT) / plotWidth) * totalDuration
      let nearest = epochs[0]
      let minDist = Infinity
      for (const ep of epochs) {
        const dist = Math.abs(ep.start + ep.duration / 2 - clickTime)
        if (dist < minDist) {
          minDist = dist
          nearest = ep
        }
      }
      setSelectedEpoch(prev => (prev?.start === nearest.start ? null : nearest))
    },
    [epochs, startTime, totalDuration, plotWidth],
  )

  if (totalDuration <= 0 || blocks.length === 0) {
    return <p className="py-6 text-center text-[15px] text-zinc-500">No sleep stage data for this night.</p>
  }

  const selectedX = selectedEpoch ? timeToX(selectedEpoch.start + selectedEpoch.duration / 2) : 0

  return (
    <div ref={measureRef} className="w-full">
      <svg width={width} height={CHART_HEIGHT} className="block touch-manipulation select-none" onClick={handleClick}>
        {STAGE_ORDER.map((stage, i) => (
          <g key={stage}>
            {i > 0 && (
              <line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={stageTop(stage)} y2={stageTop(stage)} stroke={CHART_GRID} strokeWidth={1} />
            )}
            <text
              x={0}
              y={stageTop(stage) + BAND_HEIGHT / 2}
              dominantBaseline="central"
              fill={CHART_AXIS}
              fontSize={CHART_FONT_SIZE}
            >
              {STAGE_LABELS[stage]}
            </text>
          </g>
        ))}
        <line
          x1={PAD_LEFT}
          x2={width - PAD_RIGHT}
          y1={CHART_HEIGHT - PAD_BOTTOM}
          y2={CHART_HEIGHT - PAD_BOTTOM}
          stroke={CHART_GRID}
          strokeWidth={1}
        />

        {blocks.map((block, i) => {
          const x = timeToX(Math.max(block.start, startTime))
          const xEnd = timeToX(Math.min(block.end, endTime))
          return (
            <rect
              key={i}
              x={x}
              y={stageTop(block.stage) + 6}
              width={Math.max(xEnd - x, 1.5)}
              height={BAND_HEIGHT - 12}
              rx={3}
              fill={STAGE_COLORS[block.stage]}
            />
          )
        })}

        {timeTicks.map(tick => (
          <text
            key={tick}
            x={timeToX(tick)}
            y={CHART_HEIGHT - 5}
            textAnchor={timeToX(tick) > width - 20 ? 'end' : 'middle'}
            fill={CHART_AXIS}
            fontSize={CHART_FONT_SIZE}
          >
            {formatHour(tick)}
          </text>
        ))}

        {selectedEpoch && (
          <line
            x1={selectedX}
            x2={selectedX}
            y1={PAD_TOP}
            y2={CHART_HEIGHT - PAD_BOTTOM}
            stroke="#FFFFFF"
            strokeWidth={1}
            opacity={0.5}
          />
        )}
      </svg>

      {selectedEpoch && (
        <p className="ios-numeric mt-2 text-[13px] leading-[18px] text-zinc-500">
          <span className="text-white">{STAGE_LABELS[selectedEpoch.stage]}</span>
          {` at ${formatClock(selectedEpoch.start)}`}
          {selectedEpoch.heartRate !== null && ` · ${Math.round(selectedEpoch.heartRate)} bpm`}
          {selectedEpoch.hrv !== null && ` · HRV ${Math.round(selectedEpoch.hrv)} ms`}
          {selectedEpoch.breathingRate !== null && ` · ${Math.round(selectedEpoch.breathingRate)} br/min`}
        </p>
      )}
    </div>
  )
}
