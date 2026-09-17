'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { Brain, PersonStanding, Footprints, Grid3x3 } from 'lucide-react'
import { CardTitle, EmptyState } from './CardTitle'
import { useSensorFrame, useOnSensorFrame } from '@/src/hooks/useSensorStream'
import type { BedTempFrame, BedTemp2Frame, CapSense2Frame, SensorFrame } from '@/src/hooks/useSensorStream'
import { trpc } from '@/src/utils/trpc'
import { useTemperatureUnit } from '@/src/hooks/useTemperatureUnit'

/**
 * Map a temperature (Celsius) to a color string.
 * Blue (18C) → Green (28C) → Orange (38C).
 */
function tempToColor(tempC: number | null | undefined): string {
  if (tempC === undefined || tempC === null) return 'bg-zinc-800 text-zinc-500'
  const clamped = Math.max(18, Math.min(38, tempC))
  const ratio = (clamped - 18) / 20 // 0 = cold, 1 = hot

  if (ratio < 0.5) {
    // Cool (systemBlue tint)
    return ratio < 0.25
      ? 'bg-sky-500/25 text-white'
      : 'bg-sky-500/10 text-white'
  }
  // Warm (systemOrange tint)
  return ratio < 0.75
    ? 'bg-orange-500/10 text-white'
    : 'bg-orange-500/25 text-white'
}

/** Color from Fahrenheit value (for tRPC data which is already converted). */
function tempToColorF(tempF: number | null | undefined): string {
  if (tempF === undefined || tempF === null) return 'bg-zinc-800 text-zinc-500'
  // Convert back to C for the color mapping
  const tempC = (tempF - 32) * 5 / 9
  return tempToColor(tempC)
}

// formatTemp and formatTempF are now provided by useTemperatureUnit hook
// (injected into the component via closure in the useMemo)

function formatTimestamp(ts: number | undefined): string {
  if (!ts) return '--'
  const date = new Date(ts * 1000)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// --- Cap sense variance tracking ---

const VARIANCE_WINDOW = 20
const ACTIVITY_THRESHOLD = 0.15 // glow threshold matching iOS

function computeStddev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const sq = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  return Math.sqrt(sq)
}

interface CapVariance {
  // per-channel stddev, indices 0-5 (channels 6,7 are REF, excluded)
  left: number[]
  right: number[]
}

// --- Cell components ---

const ZONE_LABELS = ['Head', 'Torso', 'Legs'] as const
const ZONE_ICONS = [
  <Brain key="head" size={13} />,
  <PersonStanding key="torso" size={13} />,
  <Footprints key="legs" size={13} />,
]

/** Center zone label with icon, displayed between left and right columns. */
function ZoneLabel({ zone }: { zone: number }) {
  return (
    <div className="flex w-11 flex-col items-center justify-center gap-0.5 text-zinc-500">
      {ZONE_ICONS[zone]}
      <span className="text-[11px]">
        {ZONE_LABELS[zone]}
      </span>
    </div>
  )
}

/**
 * Bed temperature matrix display.
 * Shows a 3×2 grid of temperature readings matching the iOS BedMatrixView:
 * Head / Torso / Legs zones for Left and Right sides.
 * Each cell shows: temp (°F, bold), cap sensor raw value (small dim), variance (tiny).
 * An activity glow appears when zone variance > 0.15.
 *
 * Combines live WebSocket frames with tRPC fallback from
 * environment.getLatestBedTemp for initial data before WS connects.
 */
export function BedTempMatrix() {
  const bedTemp = useSensorFrame('bedTemp')
  const bedTemp2 = useSensorFrame('bedTemp2')
  const capSense2 = useSensorFrame('capSense2') as CapSense2Frame | undefined

  const { unit, formatTemp, formatConverted } = useTemperatureUnit()

  // Prefer bedTemp2 (newer pods)
  const liveFrame: BedTempFrame | BedTemp2Frame | undefined = bedTemp2 ?? bedTemp

  // tRPC fallback: latest bed temp from database (request in user's unit)
  const latestBedTemp = trpc.environment.getLatestBedTemp.useQuery(
    { unit },
    {
      refetchInterval: 30_000,
      staleTime: 15_000,
      // Only used as fallback; stop refetching once live data is flowing
      enabled: !liveFrame,
    },
  )

  // Variance tracking — rolling window of last 20 capSense2 frames
  const leftHistoryRef = useRef<number[][]>([])
  const rightHistoryRef = useRef<number[][]>([])
  const [capVariance, setCapVariance] = useState<CapVariance>({ left: [], right: [] })

  useOnSensorFrame(useCallback((f: SensorFrame) => {
    if (f.type !== 'capSense2') return

    const leftChannels: number[] = Array.isArray(f.left) ? (f.left as number[]) : []
    const rightChannels: number[] = Array.isArray(f.right) ? (f.right as number[]) : []

    leftHistoryRef.current = [...leftHistoryRef.current, leftChannels].slice(-VARIANCE_WINDOW)
    rightHistoryRef.current = [...rightHistoryRef.current, rightChannels].slice(-VARIANCE_WINDOW)

    // Compute stddev for channels 0-5 (skip REF 6,7)
    const leftVar: number[] = []
    const rightVar: number[] = []
    for (let ch = 0; ch < 6; ch++) {
      leftVar.push(computeStddev(leftHistoryRef.current.map(h => h[ch] ?? 0)))
      rightVar.push(computeStddev(rightHistoryRef.current.map(h => h[ch] ?? 0)))
    }

    setCapVariance({ left: leftVar, right: rightVar })
  }, []))

  // Build a unified data source: live WS frame takes priority, tRPC as fallback
  const data = useMemo(() => {
    if (liveFrame) {
      // Live frames are in Celsius — formatTemp converts to user's preferred unit
      return {
        source: 'live' as const,
        timestamp: liveFrame.ts,
        ambientTemp: formatTemp(liveFrame.ambientTemp),
        mcuTemp: formatTemp(liveFrame.mcuTemp),
        humidity: typeof liveFrame.humidity === 'number' ? `${liveFrame.humidity.toFixed(0)}%` : undefined,
        leftHead: { display: formatTemp(liveFrame.leftOuterTemp), colorClass: tempToColor(liveFrame.leftOuterTemp) },
        leftTorso: { display: formatTemp(liveFrame.leftCenterTemp), colorClass: tempToColor(liveFrame.leftCenterTemp) },
        leftLegs: { display: formatTemp(liveFrame.leftInnerTemp), colorClass: tempToColor(liveFrame.leftInnerTemp) },
        rightHead: { display: formatTemp(liveFrame.rightOuterTemp), colorClass: tempToColor(liveFrame.rightOuterTemp) },
        rightTorso: { display: formatTemp(liveFrame.rightCenterTemp), colorClass: tempToColor(liveFrame.rightCenterTemp) },
        rightLegs: { display: formatTemp(liveFrame.rightInnerTemp), colorClass: tempToColor(liveFrame.rightInnerTemp) },
      }
    }

    const stored = latestBedTemp.data
    if (!stored) return null

    // Stored data already converted to user's unit by the tRPC endpoint
    return {
      source: 'stored' as const,
      timestamp: stored.timestamp ? Math.floor(stored.timestamp.getTime() / 1000) : undefined,
      ambientTemp: formatConverted(stored.ambientTemp),
      mcuTemp: formatConverted(stored.mcuTemp),
      humidity: stored.humidity != null ? `${Math.round(stored.humidity)}%` : undefined,
      leftHead: { display: formatConverted(stored.leftOuterTemp), colorClass: tempToColorF(stored.leftOuterTemp) },
      leftTorso: { display: formatConverted(stored.leftCenterTemp), colorClass: tempToColorF(stored.leftCenterTemp) },
      leftLegs: { display: formatConverted(stored.leftInnerTemp), colorClass: tempToColorF(stored.leftInnerTemp) },
      rightHead: { display: formatConverted(stored.rightOuterTemp), colorClass: tempToColorF(stored.rightOuterTemp) },
      rightTorso: { display: formatConverted(stored.rightCenterTemp), colorClass: tempToColorF(stored.rightCenterTemp) },
      rightLegs: { display: formatConverted(stored.rightInnerTemp), colorClass: tempToColorF(stored.rightInnerTemp) },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveFrame, latestBedTemp.data, unit])

  return (
    <div className="space-y-3">
      <CardTitle
        title="Sensor matrix"
        meta={data?.timestamp ? formatTimestamp(data.timestamp) : undefined}
        trailing={data?.source === 'stored' ? <span className="text-[13px] text-zinc-500">Stored</span> : undefined}
      />

      {!data
        ? (
            <EmptyState
              icon={<Grid3x3 size={24} strokeWidth={1.5} />}
              text={latestBedTemp.isLoading ? 'Loading temperature data' : 'Waiting for temperature data'}
              height="h-32"
            />
          )
        : (
            <div className="space-y-3">
              {/* Environment row */}
              <div className="grid grid-cols-3 divide-x divide-zinc-800 rounded-lg bg-zinc-800/60 py-2">
                <EnvStat label="Ambient" value={data.ambientTemp} />
                <EnvStat label="MCU" value={data.mcuTemp} />
                <EnvStat label="Humidity" value={data.humidity ?? '--'} />
              </div>

              {/* Sensor matrix: 2 cells per zone per side (matching iOS BedMatrixView) */}
              {/* Grid: [L ch0] [L ch1] | Zone label | [R ch0] [R ch1] */}
              <div className="grid grid-cols-[1fr_1fr_auto_1fr_1fr] gap-1">
                {/* Column headers */}
                <div className="col-span-2 pb-0.5 text-center text-[13px] text-zinc-500">Left</div>
                <div />
                <div className="col-span-2 pb-0.5 text-center text-[13px] text-zinc-500">Right</div>

                {/* 3 zones: Head (ch 0,1), Torso (ch 2,3), Legs (ch 4,5) */}
                {[0, 1, 2].map((zone) => {
                  const zoneData = [data.leftHead, data.leftTorso, data.leftLegs][zone]
                  const zoneDataR = [data.rightHead, data.rightTorso, data.rightLegs][zone]
                  const ch0 = zone * 2
                  const ch1 = zone * 2 + 1
                  const leftCap = capSense2?.left
                  const rightCap = capSense2?.right

                  return (
                    <SensorMatrixRow
                      key={zone}
                      zone={zone}
                      leftTemp={zoneData}
                      rightTemp={zoneDataR}
                      leftCap0={leftCap?.[ch0] ?? null}
                      leftCap1={leftCap?.[ch1] ?? null}
                      rightCap0={rightCap?.[ch0] ?? null}
                      rightCap1={rightCap?.[ch1] ?? null}
                      leftVar0={capVariance.left[ch0]}
                      leftVar1={capVariance.left[ch1]}
                      rightVar0={capVariance.right[ch0]}
                      rightVar1={capVariance.right[ch1]}
                    />
                  )
                })}
              </div>

              {/* Legend */}
              <p className="text-center text-[13px] leading-[18px] text-zinc-500">
                {capSense2
                  ? 'Zone temperature, raw capacitance and ± variance per channel. Outlined cells show movement.'
                  : 'Zone temperature per channel. Capacitance appears when live data is streaming.'}
              </p>
            </div>
          )}
    </div>
  )
}

function EnvStat({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="ios-numeric text-[17px] font-semibold text-white">{value}</span>
      <span className="text-[13px] text-zinc-500">{label}</span>
    </div>
  )
}

/** A single sensor cell — shows temp, cap raw value, and per-channel variance. */
function SensorCell({
  temp, capRaw, variance, colorClass,
}: {
  temp: string
  capRaw: number | null
  variance: number | undefined
  colorClass: string
}) {
  const hasActivity = typeof variance === 'number' && variance > ACTIVITY_THRESHOLD
  return (
    <div
      className={[
        'ios-numeric flex min-h-[44px] flex-col items-center justify-center rounded-md py-1.5',
        colorClass,
        hasActivity ? 'ring-1 ring-inset ring-sky-400/60' : '',
      ].join(' ')}
    >
      <span className="text-[13px] font-semibold">{temp}</span>
      {capRaw != null && (
        <span className="text-[11px] text-zinc-400">{capRaw.toFixed(2)}</span>
      )}
      {typeof variance === 'number' && (
        <span className={`text-[11px] ${hasActivity ? 'text-sky-400' : 'text-zinc-500'}`}>
          ±
          {variance.toFixed(2)}
        </span>
      )}
    </div>
  )
}

/** One zone row: 2 left cells + zone label + 2 right cells */
function SensorMatrixRow({
  zone, leftTemp, rightTemp,
  leftCap0, leftCap1, rightCap0, rightCap1,
  leftVar0, leftVar1, rightVar0, rightVar1,
}: {
  zone: number
  leftTemp: { display: string, colorClass: string }
  rightTemp: { display: string, colorClass: string }
  leftCap0: number | null
  leftCap1: number | null
  rightCap0: number | null
  rightCap1: number | null
  leftVar0: number | undefined
  leftVar1: number | undefined
  rightVar0: number | undefined
  rightVar1: number | undefined
}) {
  return (
    <>
      <SensorCell temp={leftTemp.display} capRaw={leftCap0} variance={leftVar0} colorClass={leftTemp.colorClass} />
      <SensorCell temp={leftTemp.display} capRaw={leftCap1} variance={leftVar1} colorClass={leftTemp.colorClass} />
      <ZoneLabel zone={zone} />
      <SensorCell temp={rightTemp.display} capRaw={rightCap0} variance={rightVar0} colorClass={rightTemp.colorClass} />
      <SensorCell temp={rightTemp.display} capRaw={rightCap1} variance={rightVar1} colorClass={rightTemp.colorClass} />
    </>
  )
}
