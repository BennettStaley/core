'use client'

import { useCallback, useState } from 'react'
import { useSensorFrame, useOnSensorFrame } from '@/src/hooks/useSensorStream'
import type { CapSenseFrame, CapSense2Frame, SensorFrame } from '@/src/hooks/useSensorStream'
import { trpc } from '@/src/utils/trpc'
import { Brain, PersonStanding, Footprints, User } from 'lucide-react'
import { CardTitle, EmptyState, LEFT_COLOR, RIGHT_COLOR } from './CardTitle'

/**
 * Bed presence card.
 *
 * The Occupied/Empty label is driven by the shared virtual sensor on the
 * server (`trpc.biometrics.getOccupancy`) so HomeKit and the web app always
 * agree on bed state. The zone activity bars below it are a live
 * visualization of capSense channel variance — useful for seeing what the
 * sensor is doing right now, but NOT the source of truth for occupancy.
 */

const VARIANCE_WINDOW = 20
const ACTIVITY_NORMALIZE = 0.5 // max variance for 100% bar fill
const OCCUPANCY_POLL_MS = 3_000

interface VarianceState {
  leftHistory: number[][]
  rightHistory: number[][]
  leftVariance: number[]
  rightVariance: number[]
}

function computeVariance(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const sq = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  return Math.sqrt(sq)
}

function formatTimestamp(ts: number | undefined): string {
  if (!ts) return '--'
  const date = new Date(ts * 1000)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

interface ZoneRowProps {
  zone: number
  label: string
  icon: React.ReactNode
  leftVariance: number[]
  rightVariance: number[]
}

function ZoneActivityRow({ zone, label, icon, leftVariance, rightVariance }: ZoneRowProps) {
  // Each zone maps to 2 channels (zone*2, zone*2+1)
  const leftVar = Math.max(leftVariance[zone * 2] ?? 0, leftVariance[zone * 2 + 1] ?? 0)
  const rightVar = Math.max(rightVariance[zone * 2] ?? 0, rightVariance[zone * 2 + 1] ?? 0)
  const leftPct = Math.min(leftVar / ACTIVITY_NORMALIZE, 1)
  const rightPct = Math.min(rightVar / ACTIVITY_NORMALIZE, 1)

  return (
    <div className="flex h-7 items-center gap-2">
      {/* Left activity bar — grows from right to left */}
      <div className="relative h-full flex-1 overflow-hidden rounded-md bg-zinc-800">
        <div
          className="absolute inset-y-0 right-0 transition-all duration-300"
          style={{
            width: `${leftPct * 100}%`,
            backgroundColor: `rgba(10, 132, 255, ${leftPct > 0.05 ? 0.25 + leftPct * 0.55 : 0})`,
          }}
        />
        <span className="ios-numeric absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-zinc-400">
          {leftVar.toFixed(2)}
        </span>
      </div>

      {/* Center label */}
      <div className="flex w-16 items-center justify-center gap-1 text-zinc-500">
        {icon}
        <span className="text-[13px]">{label}</span>
      </div>

      {/* Right activity bar — grows from left to right */}
      <div className="relative h-full flex-1 overflow-hidden rounded-md bg-zinc-800">
        <div
          className="absolute inset-y-0 left-0 transition-all duration-300"
          style={{
            width: `${rightPct * 100}%`,
            backgroundColor: `rgba(64, 200, 224, ${rightPct > 0.05 ? 0.25 + rightPct * 0.55 : 0})`,
          }}
        />
        <span className="ios-numeric absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-zinc-400">
          {rightVar.toFixed(2)}
        </span>
      </div>
    </div>
  )
}

export function PresenceCard() {
  const capSense = useSensorFrame('capSense')
  const capSense2 = useSensorFrame('capSense2')
  const frame: CapSenseFrame | CapSense2Frame | undefined = capSense2 ?? capSense

  const occupancyQuery = trpc.biometrics.getOccupancy.useQuery(undefined, {
    refetchInterval: OCCUPANCY_POLL_MS,
    refetchOnWindowFocus: false,
  })
  const leftOccupied = occupancyQuery.data?.left.occupied ?? false
  const rightOccupied = occupancyQuery.data?.right.occupied ?? false

  // Zone activity bars: track per-channel variance over a sliding window of
  // live frames. This is purely a visualization — NOT used for the
  // Occupied/Empty judgement.
  const [variance, setVariance] = useState<VarianceState>({
    leftHistory: [],
    rightHistory: [],
    leftVariance: [],
    rightVariance: [],
  })

  useOnSensorFrame(useCallback((f: SensorFrame) => {
    if (f.type !== 'capSense' && f.type !== 'capSense2') return

    const leftChannels = Array.isArray(f.left) ? f.left : [f.left]
    const rightChannels = Array.isArray(f.right) ? f.right : [f.right]

    setVariance((prev) => {
      const newLeftHistory = [...prev.leftHistory, leftChannels].slice(-VARIANCE_WINDOW)
      const newRightHistory = [...prev.rightHistory, rightChannels].slice(-VARIANCE_WINDOW)

      const numChannels = Math.max(leftChannels.length, 6)
      const leftVar: number[] = []
      const rightVar: number[] = []
      for (let ch = 0; ch < numChannels; ch++) {
        const leftVals = newLeftHistory.map(h => h[ch] ?? 0)
        const rightVals = newRightHistory.map(h => h[ch] ?? 0)
        leftVar.push(computeVariance(leftVals))
        rightVar.push(computeVariance(rightVals))
      }

      return {
        leftHistory: newLeftHistory,
        rightHistory: newRightHistory,
        leftVariance: leftVar,
        rightVariance: rightVar,
      }
    })
  }, []))

  return (
    <div className="space-y-3">
      <CardTitle title="Bed presence" meta={frame ? formatTimestamp(frame.ts) : undefined} />

      {/* Status row — left and right occupied indicators (server-derived) */}
      <div className="grid grid-cols-2 overflow-hidden rounded-lg bg-zinc-800/60 [&>*+*]:border-l [&>*+*]:border-zinc-700/60">
        <PresenceStatus label="Left" occupied={leftOccupied} color={LEFT_COLOR} />
        <PresenceStatus label="Right" occupied={rightOccupied} color={RIGHT_COLOR} />
      </div>

      {/* Zone activity bars (raw channel variance — visualization only) */}
      {variance.leftVariance.length > 0 && (
        <div className="space-y-1.5">
          <ZoneActivityRow
            zone={0}
            label="Head"
            icon={<Brain size={13} />}
            leftVariance={variance.leftVariance}
            rightVariance={variance.rightVariance}
          />
          <ZoneActivityRow
            zone={1}
            label="Torso"
            icon={<PersonStanding size={13} />}
            leftVariance={variance.leftVariance}
            rightVariance={variance.rightVariance}
          />
          <ZoneActivityRow
            zone={2}
            label="Legs"
            icon={<Footprints size={13} />}
            leftVariance={variance.leftVariance}
            rightVariance={variance.rightVariance}
          />
        </div>
      )}

      {/* No data state */}
      {!frame && (
        <EmptyState icon={<User size={24} strokeWidth={1.5} />} text="Waiting for presence data" height="h-24" />
      )}
    </div>
  )
}

function PresenceStatus({
  label,
  occupied,
  color,
}: {
  label: string
  occupied: boolean
  color: string
}) {
  return (
    <div className="flex min-h-[44px] items-center justify-center gap-2">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: occupied ? color : '#48484A' }}
      />
      <span className="text-[15px] text-white">{label}</span>
      <span className="text-[15px] text-zinc-500">
        {occupied ? 'Occupied' : 'Empty'}
      </span>
    </div>
  )
}
