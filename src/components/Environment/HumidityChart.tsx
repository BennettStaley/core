'use client'

import { useId, useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

interface HumidityDataPoint {
  timestamp: Date | string
  humidity: number | null
}

interface HumidityChartProps {
  data: HumidityDataPoint[]
}

const LINE_COLOR = '#0A84FF'
const AXIS_TICK = { fill: '#8E8E93', fontSize: 11 }

function formatTime(timestamp: string | Date): string {
  const d = new Date(timestamp)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function HumidityChart({ data }: HumidityChartProps) {
  const gradientId = useId()
  const chartData = useMemo(() => {
    const sorted = [...data].reverse()
    const mapped = sorted.map(d => ({
      time: new Date(d.timestamp).getTime(),
      humidity: d.humidity !== null ? Math.round(d.humidity * 10) / 10 : null,
    }))

    // Downsample
    const maxPoints = 120
    const step = Math.max(1, Math.floor(mapped.length / maxPoints))
    return step > 1
      ? mapped.filter((_, i) => i % step === 0 || i === mapped.length - 1)
      : mapped
  }, [data])

  if (chartData.length === 0) {
    return (
      <div className="flex h-[140px] items-center justify-center text-[15px] text-zinc-500">
        No humidity data
      </div>
    )
  }

  return (
    <div className="h-[140px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={LINE_COLOR} stopOpacity={0.15} />
              <stop offset="100%" stopColor={LINE_COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>
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
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#2C2C2E',
              border: 'none',
              borderRadius: 10,
              fontSize: 13,
              color: '#fff',
            }}
            labelFormatter={v => formatTime(new Date(v as number))}
            formatter={value => [`${Number(value).toFixed(1)}%`, 'Humidity']}
          />
          <Area
            type="monotone"
            dataKey="humidity"
            stroke={LINE_COLOR}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 3, fill: LINE_COLOR }}
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
