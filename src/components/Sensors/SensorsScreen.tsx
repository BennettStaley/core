'use client'

import { useCallback, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { PauseCircle } from 'lucide-react'
import { useSensorStream } from '@/src/hooks/useSensorStream'
import { trpc } from '@/src/utils/trpc'
import { PageHeader } from '@/src/ui/ios'
import { PullToRefresh } from '@/src/components/PullToRefresh/PullToRefresh'
import { TimeRangeSelector, getDateRangeFromTimeRange, type TimeRange } from '@/src/components/Environment/TimeRangeSelector'
import { BedTempChart } from '@/src/components/Environment/BedTempChart'
import { HumidityChart } from '@/src/components/Environment/HumidityChart'
import { ConnectionStatusBar } from './ConnectionStatusBar'
import { PresenceCard } from './PresenceCard'
import { BedTempMatrix } from './BedTempMatrix'
import { FreezerHealthCard } from './FreezerHealthCard'
import { FlowrateChart } from './FlowrateChart'
import { PiezoWaveform } from './PiezoWaveform'
import { CardTitle } from './CardTitle'

const DataPipeline = dynamic(() => import('./DataPipeline').then(m => ({ default: m.DataPipeline })), {
  ssr: false,
  loading: () => <div className="flex h-[400px] items-center justify-center text-[15px] text-zinc-500">Loading pipeline…</div>,
})

interface SensorsScreenProps {
  /**
   * Render the iOS large-title header with the Live/Stop bar button (the
   * /sensors tab). The desktop diagnostics console embeds the screen without it.
   */
  header?: boolean
}

/**
 * Main Sensors screen composition.
 * Connects to the WebSocket sensor stream and renders all live sensor
 * data panels: connection status, data pipeline, piezo waveform, presence,
 * sensor matrix (bed temp), bed temp trend, humidity, system health and flow.
 *
 * Pull-to-refresh reconnects the WebSocket stream.
 */
export function SensorsScreen({ header = false }: SensorsScreenProps) {
  const [streamEnabled, setStreamEnabled] = useState(true)
  const [timeRange, setTimeRange] = useState<TimeRange>('6h')

  // Connect to the sensor stream
  const stream = useSensorStream({ enabled: streamEnabled })

  const dateRange = useMemo(
    () => getDateRangeFromTimeRange(timeRange),
    [timeRange],
  )

  const limit = useMemo(() => {
    const hours = parseInt(timeRange)
    return Math.min(hours * 60, 1440)
  }, [timeRange])

  // Fetch historical bed temp for trend chart + humidity chart
  const bedTempQuery = trpc.environment.getBedTemp.useQuery(
    {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      limit,
      unit: 'F',
    },
    {
      refetchInterval: 60_000,
      staleTime: 30_000,
    },
  )

  // Fetch environment summary for stats
  const summaryQuery = trpc.environment.getSummary.useQuery(
    {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      unit: 'F',
    },
    { staleTime: 60_000 },
  )

  const summary = summaryQuery.data?.bedTemp

  /** Pull-to-refresh: toggle stream off/on to force reconnect. */
  const handleRefresh = useCallback(async () => {
    setStreamEnabled(false)
    await new Promise(resolve => setTimeout(resolve, 300))
    setStreamEnabled(true)
  }, [])

  const toggleStream = () => setStreamEnabled(v => !v)

  const status = streamEnabled
    ? (
        <ConnectionStatusBar
          variant={header ? 'inline' : 'bar'}
          status={stream.status}
          fps={stream.fps}
          lastError={stream.lastError}
          subscribedSensors={stream.subscribedSensors}
          lastFrameTime={stream.lastFrameTime}
        />
      )
    : null

  return (
    <PullToRefresh onRefresh={handleRefresh} enabled={streamEnabled}>
      <div className="space-y-4 pb-4">
        {header
          ? (
              <div className="space-y-1">
                <PageHeader
                  title="Sensors"
                  trailing={(
                    <button
                      type="button"
                      onClick={toggleStream}
                      className="-mr-2 min-h-[44px] px-2 text-[17px] text-sky-400 active:opacity-50"
                    >
                      {streamEnabled ? 'Stop' : 'Start'}
                    </button>
                  )}
                />
                <div className="px-1">
                  {status ?? <span className="text-[15px] text-zinc-500">Paused</span>}
                </div>
              </div>
            )
          : (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  {status ?? (
                    <div className="flex min-h-[44px] items-center rounded-xl bg-zinc-900 px-4 text-[15px] text-zinc-500">Paused</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={toggleStream}
                  className="min-h-[44px] shrink-0 rounded-xl bg-zinc-900 px-4 text-[17px] text-sky-400 active:bg-zinc-800"
                >
                  {streamEnabled ? 'Stop' : 'Start'}
                </button>
              </div>
            )}

        {/* Paused state */}
        {!streamEnabled && (
          <section className="flex flex-col items-center gap-2 rounded-xl bg-zinc-900 px-4 py-10 text-center">
            <PauseCircle size={32} strokeWidth={1.5} className="text-zinc-600" />
            <p className="text-[17px] font-semibold text-white">Stream paused</p>
            <p className="text-[15px] text-zinc-500">Tap Start to resume live data.</p>
          </section>
        )}

        {streamEnabled && (
          <>
            <SensorCard>
              <DataPipeline />
            </SensorCard>

            <SensorCard>
              <PiezoWaveform />
            </SensorCard>

            <SensorCard>
              <PresenceCard />
            </SensorCard>

            <SensorCard>
              <BedTempMatrix />
            </SensorCard>

            {/* Bed temperature trend — recharts LineChart (from biometrics) */}
            <SensorCard>
              <div className="space-y-3">
                <CardTitle title="Bed temperature" />
                <TimeRangeSelector value={timeRange} onChange={setTimeRange} />

                {bedTempQuery.isLoading
                  ? (
                      <div className="flex h-[200px] items-center justify-center">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
                      </div>
                    )
                  : bedTempQuery.isError
                    ? (
                        <div className="flex h-[200px] items-center justify-center text-[15px] text-zinc-500">
                          Couldn’t load temperature data
                        </div>
                      )
                    : (
                        <BedTempChart
                          data={bedTempQuery.data ?? []}
                          unit="F"
                          showAmbient
                          highlightSide="both"
                        />
                      )}

                {summary && (
                  <div className="grid grid-cols-4 gap-2 border-t border-zinc-800 pt-3">
                    <SummaryItem
                      label="Left"
                      value={summary.avgLeftCenterTemp != null ? `${Math.round(summary.avgLeftCenterTemp)}°` : '--'}
                    />
                    <SummaryItem
                      label="Right"
                      value={summary.avgRightCenterTemp != null ? `${Math.round(summary.avgRightCenterTemp)}°` : '--'}
                    />
                    <SummaryItem
                      label="Ambient"
                      value={summary.avgAmbientTemp != null ? `${Math.round(summary.avgAmbientTemp)}°` : '--'}
                    />
                    <SummaryItem
                      label="Humidity"
                      value={summary.avgHumidity != null ? `${Math.round(summary.avgHumidity)}%` : '--'}
                    />
                  </div>
                )}
              </div>
            </SensorCard>

            {/* Humidity trend — recharts AreaChart (from biometrics) */}
            <SensorCard>
              <div className="space-y-3">
                <CardTitle title="Humidity" meta={timeRange} />
                {bedTempQuery.isLoading
                  ? (
                      <div className="flex h-[140px] items-center justify-center">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
                      </div>
                    )
                  : (
                      <HumidityChart data={bedTempQuery.data ?? []} />
                    )}
              </div>
            </SensorCard>

            <SensorCard>
              <FreezerHealthCard />
            </SensorCard>

            <SensorCard>
              <FlowrateChart />
            </SensorCard>
          </>
        )}
      </div>
    </PullToRefresh>
  )
}

/** Grouped surface for a sensor panel. */
function SensorCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-zinc-900 p-4">
      {children}
    </section>
  )
}

function SummaryItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="ios-numeric text-[17px] font-semibold text-white">{value}</span>
      <span className="text-[13px] text-zinc-500">{label}</span>
    </div>
  )
}
