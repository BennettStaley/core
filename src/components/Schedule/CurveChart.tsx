'use client'

import { useCallback, useId, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { CurvePoint } from '@/src/lib/sleepCurve/types'
import { phaseLabels } from '@/src/lib/sleepCurve/types'
import { curvePointToDisplayTime } from '@/src/lib/sleepCurve/generate'
import { useTemperatureUnit } from '@/src/hooks/useTemperatureUnit'
import { formatSetpointF, type TempUnit } from '@/src/lib/tempUtils'
import { tempTint } from './scheduleFormat'

const BASE_TEMP_F = 80
const GRID = '#2C2C2E'
const AXIS_LABEL = '#8E8E93'

interface CurveChartProps {
  points: CurvePoint[]
  bedtimeMinutes: number
  minTempF: number
  maxTempF: number
  /** Index of the currently selected set point (highlights dot) */
  selectedIndex?: number | null
  /** Called when user taps a dot on the chart */
  onSelectIndex?: (index: number) => void
  /** Compact mode for sheets (shorter height) */
  compact?: boolean
}

interface ChartDataPoint {
  minutesFromBedtime: number
  tempF: number
  tempOffset: number
  phase: string
  displayTime: string
  index: number
}

/** Tooltip in the iOS "callout" style: raised grey capsule, no border. */
function CurveTooltip({ active, payload, unit }: { active?: boolean, payload?: Array<{ payload: ChartDataPoint }>, unit: TempUnit }) {
  if (!active || !payload?.[0]) return null
  const data = payload[0].payload
  return (
    <div className="rounded-lg bg-zinc-800 px-2.5 py-1.5 text-[13px] leading-[18px]">
      <div className="ios-numeric text-white">
        {data.displayTime}
        {' · '}
        <span style={{ color: tempTint(data.tempF) }}>{formatSetpointF(data.tempF, unit)}</span>
      </div>
      <div className="text-zinc-500">{data.phase}</div>
    </div>
  )
}

interface InteractiveDotProps {
  cx?: number
  cy?: number
  payload?: { index: number, tempF: number }
  selectedIndex?: number | null
  onSelectIndex?: (index: number) => void
}

function InteractiveDot({ cx, cy, payload, selectedIndex, onSelectIndex }: InteractiveDotProps) {
  if (cx == null || cy == null || !payload) return null

  const isSelected = payload.index === selectedIndex
  const color = tempTint(payload.tempF)

  return (
    <circle
      cx={cx}
      cy={cy}
      r={isSelected ? 5 : 3}
      fill={isSelected ? '#fff' : color}
      stroke={isSelected ? color : 'none'}
      strokeWidth={isSelected ? 2 : 0}
      style={{ cursor: onSelectIndex ? 'pointer' : undefined }}
      onClick={(e) => {
        e.stopPropagation()
        onSelectIndex?.(payload.index)
      }}
    />
  )
}

/**
 * Temperature curve: a thin line tinted cool → warm along its length over a
 * faint (12%) fill, hairline grid and 11pt axis labels.
 */
export function CurveChart({
  points,
  bedtimeMinutes,
  minTempF,
  maxTempF,
  selectedIndex,
  onSelectIndex,
  compact = false,
}: CurveChartProps) {
  const { unit } = useTemperatureUnit()
  const showDots = onSelectIndex != null
  const gradientId = `curve-${useId().replace(/:/g, '')}`

  const chartData = useMemo<ChartDataPoint[]>(() => {
    return points.map((p, i) => ({
      minutesFromBedtime: p.minutesFromBedtime,
      tempF: BASE_TEMP_F + p.tempOffset,
      tempOffset: p.tempOffset,
      phase: phaseLabels[p.phase],
      displayTime: curvePointToDisplayTime(p.minutesFromBedtime, bedtimeMinutes),
      index: i,
    }))
  }, [points, bedtimeMinutes])

  // Y-axis domain: pad 3°F around the min/max
  const yMin = Math.floor(Math.min(minTempF, ...chartData.map(d => d.tempF)) - 3)
  const yMax = Math.ceil(Math.max(maxTempF, ...chartData.map(d => d.tempF)) + 3)

  const formatXTick = (minutesFromBedtime: number) => {
    return curvePointToDisplayTime(minutesFromBedtime, bedtimeMinutes)
  }

  const gradientStops = useMemo(() => {
    if (chartData.length < 2) return []
    const minX = chartData[0].minutesFromBedtime
    const maxX = chartData[chartData.length - 1].minutesFromBedtime
    const range = maxX - minX || 1
    return chartData.map(d => ({
      offset: `${((d.minutesFromBedtime - minX) / range) * 100}%`,
      color: tempTint(d.tempF),
    }))
  }, [chartData])

  // X-axis ticks: every 2 hours (3 in compact mode) from first to last point
  const xTicks = useMemo(() => {
    if (chartData.length < 2) return []
    const step = compact ? 180 : 120
    const first = chartData[0].minutesFromBedtime
    const last = chartData[chartData.length - 1].minutesFromBedtime
    const ticks: number[] = []
    const start = Math.ceil(first / step) * step
    for (let t = start; t <= last; t += step) {
      ticks.push(t)
    }
    return ticks
  }, [chartData, compact])

  const renderDot = useCallback((props: InteractiveDotProps) => (
    <InteractiveDot
      {...props}
      selectedIndex={selectedIndex}
      onSelectIndex={onSelectIndex}
    />
  ), [selectedIndex, onSelectIndex])

  return (
    <div className="w-full" style={{ height: compact ? 160 : 200 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <AreaChart
          data={chartData}
          margin={{ top: 8, right: 12, bottom: 0, left: -16 }}
        >
          <defs>
            <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="1" y2="0">
              {gradientStops.map((stop, i) => (
                <stop key={i} offset={stop.offset} stopColor={stop.color} stopOpacity={0.12} />
              ))}
            </linearGradient>
            <linearGradient id={`${gradientId}-line`} x1="0" y1="0" x2="1" y2="0">
              {gradientStops.map((stop, i) => (
                <stop key={i} offset={stop.offset} stopColor={stop.color} stopOpacity={1} />
              ))}
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="minutesFromBedtime"
            type="number"
            domain={['dataMin', 'dataMax']}
            ticks={xTicks}
            tickFormatter={formatXTick}
            tick={{ fill: AXIS_LABEL, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickMargin={6}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fill: AXIS_LABEL, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickCount={4}
            allowDecimals={false}
            tickFormatter={(v: number) => formatSetpointF(v, unit, { includeUnit: false })}
          />
          <Tooltip
            content={<CurveTooltip unit={unit} />}
            cursor={{ stroke: '#48484A', strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="tempF"
            stroke={`url(#${gradientId}-line)`}
            strokeWidth={2}
            fill={`url(#${gradientId}-fill)`}
            fillOpacity={1}
            dot={showDots ? renderDot : false}
            activeDot={showDots ? false : { r: 4, fill: '#fff', strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
