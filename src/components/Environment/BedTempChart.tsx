'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

interface BedTempDataPoint {
  timestamp: Date | string
  leftCenterTemp: number | null
  rightCenterTemp: number | null
  ambientTemp: number | null
}

interface BedTempChartProps {
  data: BedTempDataPoint[]
  unit: 'F' | 'C'
  showAmbient?: boolean
  /** Which side to visually emphasize. 'both' gives equal prominence to both lines. */
  highlightSide?: 'left' | 'right' | 'both'
}

const LEFT_COLOR = '#0A84FF'
const RIGHT_COLOR = '#40C8E0'
const AMBIENT_COLOR = '#FF9F0A'
const AXIS_TICK = { fill: '#8E8E93', fontSize: 11 }

function formatTime(timestamp: string | Date): string {
  const d = new Date(timestamp)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatTooltipTime(timestamp: string | Date): string {
  const d = new Date(timestamp)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })
}

interface ChartDataPoint {
  time: number
  timeLabel: string
  left: number | null
  right: number | null
  ambient: number | null
}

export function BedTempChart({ data, unit, showAmbient = false, highlightSide }: BedTempChartProps) {
  const chartData = useMemo(() => {
    // Data comes in desc order from API, reverse for chronological
    const sorted = [...data].reverse()
    return sorted.map(d => ({
      time: new Date(d.timestamp).getTime(),
      timeLabel: formatTime(d.timestamp),
      left: d.leftCenterTemp !== null ? Math.round(d.leftCenterTemp * 10) / 10 : null,
      right: d.rightCenterTemp !== null ? Math.round(d.rightCenterTemp * 10) / 10 : null,
      ambient: d.ambientTemp !== null ? Math.round(d.ambientTemp * 10) / 10 : null,
    })) as ChartDataPoint[]
  }, [data])

  if (chartData.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-[15px] text-zinc-500">
        No temperature data
      </div>
    )
  }

  // Compute Y-axis domain with padding
  const allTemps = chartData.flatMap((d) => {
    const temps: number[] = []
    if (d.left !== null) temps.push(d.left)
    if (d.right !== null) temps.push(d.right)
    if (showAmbient && d.ambient !== null) temps.push(d.ambient)
    return temps
  })

  const minTemp = Math.floor(Math.min(...allTemps) - 2)
  const maxTemp = Math.ceil(Math.max(...allTemps) + 2)

  // Downsample to ~120 points max for performance
  const maxPoints = 120
  const step = Math.max(1, Math.floor(chartData.length / maxPoints))
  const downsampled = step > 1
    ? chartData.filter((_, i) => i % step === 0 || i === chartData.length - 1)
    : chartData

  const legend = [
    { label: 'Left', color: LEFT_COLOR },
    { label: 'Right', color: RIGHT_COLOR },
    ...(showAmbient ? [{ label: 'Ambient', color: AMBIENT_COLOR }] : []),
  ]

  return (
    <div className="space-y-2">
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <LineChart data={downsampled} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#2C2C2E" vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v: number) => formatTime(new Date(v))}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              tickCount={4}
              minTickGap={28}
            />
            <YAxis
              domain={[minTemp, maxTemp]}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              tickCount={4}
              tickFormatter={(v: number) => `${Math.round(v)}°`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#2C2C2E',
                border: 'none',
                borderRadius: 10,
                fontSize: 13,
                color: '#fff',
              }}
              labelFormatter={v => formatTooltipTime(new Date(v as number))}
              formatter={(value, name) => [
                `${Number(value).toFixed(1)}°${unit}`,
                String(name),
              ]}
            />
            <Line
              type="monotone"
              dataKey="left"
              name="Left"
              stroke={LEFT_COLOR}
              strokeWidth={highlightSide === 'right' ? 1.5 : 2}
              strokeOpacity={highlightSide === 'right' ? 0.35 : 1}
              dot={false}
              activeDot={{ r: 3, fill: LEFT_COLOR }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="right"
              name="Right"
              stroke={RIGHT_COLOR}
              strokeWidth={highlightSide === 'left' ? 1.5 : 2}
              strokeOpacity={highlightSide === 'left' ? 0.35 : 1}
              dot={false}
              activeDot={{ r: 3, fill: RIGHT_COLOR }}
              connectNulls
            />
            {showAmbient && (
              <Line
                type="monotone"
                dataKey="ambient"
                name="Ambient"
                stroke={AMBIENT_COLOR}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                activeDot={{ r: 3, fill: AMBIENT_COLOR }}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-4 text-[13px] text-zinc-500">
        {legend.map(item => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}
