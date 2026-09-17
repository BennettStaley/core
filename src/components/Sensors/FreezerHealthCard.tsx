'use client'

import clsx from 'clsx'
import { useSensorFrame } from '@/src/hooks/useSensorStream'
import { trpc } from '@/src/utils/trpc'
import { useTemperatureUnit } from '@/src/hooks/useTemperatureUnit'
import { Cog } from 'lucide-react'
import { CardTitle, EmptyState } from './CardTitle'

function formatTimestamp(ts: number | undefined): string {
  if (!ts) return '--'
  const date = new Date(ts * 1000)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/** Label + left/right values on one hairline row. */
function PairRow({ label, left, right, leftWarn, rightWarn }: { label: string, left: string, right: string, leftWarn?: boolean, rightWarn?: boolean }) {
  return (
    <div className="grid min-h-[44px] grid-cols-[1fr_5.5rem_5.5rem] items-center gap-2">
      <span className="text-[15px] text-white">{label}</span>
      <span className={clsx('ios-numeric text-right text-[15px]', leftWarn ? 'text-amber-400' : 'text-zinc-300')}>{left}</span>
      <span className={clsx('ios-numeric text-right text-[15px]', rightWarn ? 'text-amber-400' : 'text-zinc-300')}>{right}</span>
    </div>
  )
}

/** Label + single value on one hairline row. */
function ValueRow({ label, value, tone = 'default' }: { label: string, value: string, tone?: 'default' | 'warn' | 'ok' }) {
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-3">
      <span className="text-[15px] text-white">{label}</span>
      <span
        className={clsx(
          'ios-numeric text-[15px]',
          tone === 'warn' ? 'text-amber-400' : tone === 'ok' ? 'text-emerald-400' : 'text-zinc-300',
        )}
      >
        {value}
      </span>
    </div>
  )
}

/**
 * Freezer/thermal system health card.
 * Displays water temperatures, TEC current, pump RPM, fan RPM, and water level.
 *
 * Combines live WebSocket frames (frzTemp, frzHealth, frzTherm) with tRPC data:
 * - environment.getLatestFreezerTemp for stored freezer temps when WS is not streaming
 * - waterLevel.getLatest for current water level status
 */
export function FreezerHealthCard() {
  const { unit, formatTemp, formatConverted } = useTemperatureUnit()

  // Live WebSocket frames
  const frzTemp = useSensorFrame('frzTemp')
  const frzHealth = useSensorFrame('frzHealth')
  const frzTherm = useSensorFrame('frzTherm')

  // tRPC: latest freezer temp from DB (fallback when WS hasn't sent data)
  const latestFreezerTemp = trpc.environment.getLatestFreezerTemp.useQuery(
    { unit },
    {
      refetchInterval: 30_000,
      staleTime: 15_000,
    },
  )

  const waterLevelLatest = trpc.waterLevel.getLatest.useQuery(
    {},
    {
      refetchInterval: 30_000,
      staleTime: 15_000,
    },
  )

  const hasLiveData = frzTemp || frzHealth || frzTherm
  const hasTrpcData = latestFreezerTemp.data
  const hasData = hasLiveData || hasTrpcData
  const latestTs = Math.max(frzTemp?.ts ?? 0, frzHealth?.ts ?? 0, frzTherm?.ts ?? 0)

  // Use tRPC freezer temps as fallback when no live data
  const freezerTempData = frzTemp
    ? {
        leftWater: formatTemp(frzTemp.left),
        rightWater: formatTemp(frzTemp.right),
        ambient: formatTemp(frzTemp.amb),
        heatsink: formatTemp(frzTemp.hs),
        source: 'live' as const,
      }
    : hasTrpcData
      ? {
          leftWater: formatConverted(latestFreezerTemp.data?.leftWaterTemp),
          rightWater: formatConverted(latestFreezerTemp.data?.rightWaterTemp),
          ambient: formatConverted(latestFreezerTemp.data?.ambientTemp),
          heatsink: formatConverted(latestFreezerTemp.data?.heatsinkTemp),
          source: 'stored' as const,
        }
      : null

  const waterLevel = waterLevelLatest.data
  const meta = hasLiveData
    ? formatTimestamp(latestTs || undefined)
    : freezerTempData?.source === 'stored' ? 'Stored' : undefined

  return (
    <div className="space-y-2">
      <CardTitle title="System" meta={meta} />

      {!hasData
        ? (
            <EmptyState icon={<Cog size={24} strokeWidth={1.5} />} text="Waiting for freezer data" height="h-24" />
          )
        : (
            <div className="[&>*+*]:border-t [&>*+*]:border-zinc-800">
              <div className="grid grid-cols-[1fr_5.5rem_5.5rem] gap-2 pb-1 text-[13px] text-zinc-500">
                <span />
                <span className="text-right">Left</span>
                <span className="text-right">Right</span>
              </div>

              {freezerTempData && (
                <PairRow label="Water temp" left={freezerTempData.leftWater} right={freezerTempData.rightWater} />
              )}

              {frzHealth && (
                <PairRow
                  label="TEC current"
                  left={`${frzHealth.left.tecCurrent.toFixed(2)} A`}
                  right={`${frzHealth.right.tecCurrent.toFixed(2)} A`}
                  leftWarn={frzHealth.left.tecCurrent > 5}
                  rightWarn={frzHealth.right.tecCurrent > 5}
                />
              )}

              {frzHealth && (
                <PairRow
                  label="Pump"
                  left={`${frzHealth.left.pumpRpm} RPM`}
                  right={`${frzHealth.right.pumpRpm} RPM`}
                  leftWarn={frzHealth.left.pumpRpm === 0}
                  rightWarn={frzHealth.right.pumpRpm === 0}
                />
              )}

              {frzTherm && (
                <PairRow
                  label="Thermal"
                  left={typeof frzTherm.left === 'number' ? frzTherm.left.toFixed(1) : '--'}
                  right={typeof frzTherm.right === 'number' ? frzTherm.right.toFixed(1) : '--'}
                />
              )}

              {frzHealth && (
                <ValueRow label="Fan" value={`${frzHealth.fan.rpm} RPM`} tone={frzHealth.fan.rpm < 100 ? 'warn' : 'default'} />
              )}

              {freezerTempData && (
                <>
                  <ValueRow label="Heatsink" value={freezerTempData.heatsink} />
                  <ValueRow label="Ambient" value={freezerTempData.ambient} />
                </>
              )}

              {/* Water status (flow rates removed — not reliable on most pods) */}
              {waterLevel && (
                <ValueRow
                  label="Water level"
                  value={waterLevel.level === 'ok' ? 'OK' : 'Low'}
                  tone={waterLevel.level === 'low' ? 'warn' : 'ok'}
                />
              )}
            </div>
          )}

      {!hasData && waterLevel && (
        <div className="border-t border-zinc-800">
          <ValueRow
            label="Water level"
            value={waterLevel.level === 'ok' ? 'OK' : 'Low'}
            tone={waterLevel.level === 'low' ? 'warn' : 'ok'}
          />
        </div>
      )}
    </div>
  )
}
