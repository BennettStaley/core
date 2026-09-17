'use client'

import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { ChevronDown } from 'lucide-react'
import { SegmentedControl } from '@/src/ui/ios'
import { AXIS_COLOR, CardTitle, GRID_COLOR, LEFT_COLOR, RIGHT_COLOR, TOOLTIP_STYLE } from './CardTitle'
import { trpc } from '@/src/utils/trpc'
import { useSensorFrame } from '@/src/hooks/useSensorStream'

interface FlowChartDataPoint {
  time: number
  leftFlow: number | null
  rightFlow: number | null
  leftRpm: number | null
  rightRpm: number | null
}

function formatTime(timestamp: string | Date | number): string {
  const d = new Date(timestamp)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatTooltipTime(timestamp: number): string {
  const d = new Date(timestamp)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })
}

type ViewMode = 'flowrate' | 'rpm'

/**
 * Flowrate and pump RPM chart.
 * Queries historical flow readings from the biometrics DB and displays
 * left/right flowrate (centidegrees) or pump RPM over time.
 * Also shows live data from the frzHealth WebSocket frame.
 */
export function FlowrateChart() {
  const [hours, setHours] = useState(6)
  const [viewMode, setViewMode] = useState<ViewMode>('flowrate')

  const frzHealth = useSensorFrame('frzHealth')

  const flowQuery = trpc.waterLevel.getFlowReadings.useQuery(
    { hours },
    {
      refetchInterval: 60_000,
      staleTime: 30_000,
    },
  )

  const chartData = useMemo(() => {
    const raw = flowQuery.data as Array<{
      timestamp: Date | string
      leftFlowrateCd: number | null
      rightFlowrateCd: number | null
      leftPumpRpm: number | null
      rightPumpRpm: number | null
    }> | undefined

    if (!raw || raw.length === 0) return []

    // Data is already in chronological order from the API.
    // leftFlowrateCd/rightFlowrateCd are stored as raw×100 to keep the table
    // integer-typed; divide back to degrees so the chart and the live readout
    // share a unit.
    const points: FlowChartDataPoint[] = raw.map(d => ({
      time: new Date(d.timestamp).getTime(),
      leftFlow: d.leftFlowrateCd != null ? d.leftFlowrateCd / 100 : null,
      rightFlow: d.rightFlowrateCd != null ? d.rightFlowrateCd / 100 : null,
      leftRpm: d.leftPumpRpm,
      rightRpm: d.rightPumpRpm,
    }))

    // Downsample to ~120 points for performance
    const maxPoints = 120
    const step = Math.max(1, Math.floor(points.length / maxPoints))
    return step > 1
      ? points.filter((_, i) => i % step === 0 || i === points.length - 1)
      : points
  }, [flowQuery.data])

  const leftKey = viewMode === 'flowrate' ? 'leftFlow' as const : 'leftRpm' as const
  const rightKey = viewMode === 'flowrate' ? 'rightFlow' as const : 'rightRpm' as const
  const unitLabel = viewMode === 'flowrate' ? '' : 'RPM'

  // Compute Y-axis domain
  const allValues = chartData.flatMap(d => [d[leftKey], d[rightKey]].filter((v): v is number => v !== null))
  const minVal = allValues.length > 0 ? Math.floor(Math.min(...allValues)) - 1 : 0
  const maxVal = allValues.length > 0 ? Math.ceil(Math.max(...allValues)) + 1 : 100
  const domain: [number, number] = [Math.max(0, minVal), maxVal]

  return (
    <div className="space-y-3">
      <CardTitle
        title={viewMode === 'flowrate' ? 'Flow rate' : 'Pump speed'}
        trailing={(
          <label className="relative flex min-h-[32px] items-center">
            <span className="sr-only">History range</span>
            <select
              value={hours}
              onChange={e => setHours(Number(e.target.value))}
              className="appearance-none bg-transparent py-1 pl-2 pr-5 text-right text-[15px] text-sky-400 outline-none"
            >
              <option value={1}>1h</option>
              <option value={6}>6h</option>
              <option value={24}>24h</option>
              <option value={72}>3d</option>
              <option value={168}>7d</option>
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-0 text-sky-400" />
          </label>
        )}
      />

      <SegmentedControl
        aria-label="Metric"
        options={[{ value: 'flowrate', label: 'Flow' }, { value: 'rpm', label: 'RPM' }]}
        value={viewMode}
        onChange={setViewMode}
      />

      {/* Live values from WebSocket */}
      {frzHealth && (
        <div className="grid grid-cols-2 divide-x divide-zinc-800 rounded-lg bg-zinc-800/60 py-2">
          <LiveValue
            label="Left"
            value={viewMode === 'flowrate'
              ? (frzHealth.left.flowrate !== null ? frzHealth.left.flowrate.toFixed(1) : '--')
              : String(frzHealth.left.pumpRpm)}
          />
          <LiveValue
            label="Right"
            value={viewMode === 'flowrate'
              ? (frzHealth.right.flowrate !== null ? frzHealth.right.flowrate.toFixed(1) : '--')
              : String(frzHealth.right.pumpRpm)}
          />
        </div>
      )}

      {/* Historical chart */}
      {flowQuery.isLoading
        ? (
            <div className="flex h-[180px] items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
            </div>
          )
        : flowQuery.isError
          ? (
              <div className="flex h-[180px] items-center justify-center text-[15px] text-zinc-500">
                Couldn’t load flow data
              </div>
            )
          : chartData.length === 0
            ? (
                <div className="flex h-[180px] items-center justify-center text-[15px] text-zinc-500">
                  No flow data
                </div>
              )
            : (
                <div className="space-y-2">
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                      <LineChart data={chartData} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                        <XAxis
                          dataKey="time"
                          type="number"
                          domain={['dataMin', 'dataMax']}
                          tickFormatter={(v: number) => formatTime(v)}
                          tick={AXIS_TICK}
                          axisLine={false}
                          tickLine={false}
                          tickCount={4}
                          minTickGap={28}
                        />
                        <YAxis
                          domain={domain}
                          tick={AXIS_TICK}
                          axisLine={false}
                          tickLine={false}
                          tickCount={4}
                          tickFormatter={(v: number) => `${Math.round(v)}`}
                        />
                        <Tooltip
                          contentStyle={TOOLTIP_STYLE}
                          labelFormatter={v => formatTooltipTime(v as number)}
                          formatter={(value, name) => [
                            `${Number(value).toFixed(1)} ${unitLabel}`,
                            String(name),
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey={leftKey}
                          name="Left"
                          stroke={LEFT_COLOR}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 3, fill: LEFT_COLOR }}
                          connectNulls
                        />
                        <Line
                          type="monotone"
                          dataKey={rightKey}
                          name="Right"
                          stroke={RIGHT_COLOR}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 3, fill: RIGHT_COLOR }}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-center gap-4 text-[13px] text-zinc-500">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LEFT_COLOR }} />
                      Left
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: RIGHT_COLOR }} />
                      Right
                    </span>
                  </div>
                </div>
              )}
    </div>
  )
}

const AXIS_TICK = { fill: AXIS_COLOR, fontSize: 11 }

function LiveValue({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="ios-numeric text-[17px] font-semibold text-white">{value}</span>
      <span className="text-[13px] text-zinc-500">{label}</span>
    </div>
  )
}
