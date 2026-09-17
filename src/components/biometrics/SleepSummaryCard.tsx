'use client'

import { trpc } from '@/src/utils/trpc'
import type { Side, SleepRecord } from './types'
import { SleepRecordActions } from './SleepRecordActions'

interface SleepSummaryCardProps {
  side: Side
  /** Sleep records for the visible week, most recent first. */
  records: SleepRecord[]
  /** Prefix the caption with the side name (dual-side view). */
  showSideName?: boolean
}

function durationParts(seconds: number): { hours: number, minutes: number } {
  // Round to the nearest minute so this agrees with formatDurationHM elsewhere on the screen.
  const totalMinutes = Math.round(seconds / 60)
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 }
}

export function formatDuration(seconds: number): string {
  const { hours, minutes } = durationParts(seconds)
  if (hours === 0) return `${minutes}m`
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** "Last night" when the record ended today, otherwise the bedtime date. */
export function nightCaption(record: Pick<SleepRecord, 'enteredBedAt' | 'leftBedAt'>): string {
  if (isSameLocalDay(new Date(record.leftBedAt), new Date())) return 'Last night'
  return new Date(record.enteredBedAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

/**
 * "Last night" hero card, Health-style: time asleep as a large number,
 * bedtime → wake, and the night's sleeping vitals in one row.
 */
export function SleepSummaryCard({ side, records, showSideName = false }: SleepSummaryCardProps) {
  const record = records[0]

  const summaryQuery = trpc.biometrics.getVitalsSummary.useQuery(
    {
      side,
      startDate: record ? new Date(record.enteredBedAt) : undefined,
      endDate: record ? new Date(record.leftBedAt) : undefined,
    },
    { enabled: Boolean(record) },
  )

  if (!record) {
    return (
      <section className="rounded-xl bg-zinc-900 px-4 py-3">
        <p className="text-[13px] leading-[18px] text-zinc-500">{showSideName ? `${side === 'left' ? 'Left' : 'Right'} side` : 'This week'}</p>
        <p className="mt-0.5 text-[15px] text-zinc-400">No sleep recorded this week.</p>
      </section>
    )
  }

  const summary = summaryQuery.data
  const { hours, minutes } = durationParts(record.sleepDurationSeconds)
  const avgDuration = records.reduce((sum, r) => sum + r.sleepDurationSeconds, 0) / records.length
  const round = (v: number | null | undefined) => (v != null ? String(Math.round(v)) : '–')
  const caption = showSideName ? `${side === 'left' ? 'Left' : 'Right'} side` : 'Time asleep'

  return (
    <section className="rounded-xl bg-zinc-900">
      <div className="px-4 pb-3 pt-3">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-[15px] font-semibold text-zinc-500">{caption}</p>
          <SleepRecordActions
            recordId={record.id}
            enteredBedAt={record.enteredBedAt}
            leftBedAt={record.leftBedAt}
          />
        </div>

        <p className="ios-numeric mt-0.5 text-white" aria-label={`Time asleep ${formatDuration(record.sleepDurationSeconds)}`}>
          {hours > 0 && (
            <>
              <span className="text-[34px] font-bold leading-[41px]">{hours}</span>
              <span className="mr-1.5 text-[20px] font-semibold text-zinc-500">h</span>
            </>
          )}
          <span className="text-[34px] font-bold leading-[41px]">{minutes}</span>
          <span className="text-[20px] font-semibold text-zinc-500">m</span>
        </p>
        <p className="ios-numeric text-[15px] text-zinc-500">
          {formatTime(record.enteredBedAt)}
          {' – '}
          {formatTime(record.leftBedAt)}
          {record.timesExitedBed > 0 && ` · ${record.timesExitedBed} ${record.timesExitedBed === 1 ? 'exit' : 'exits'}`}
        </p>
      </div>

      <div className="grid grid-cols-3 border-t border-zinc-800 px-4 py-3">
        <Stat label="Sleeping HR" value={round(summary?.avgHeartRate)} unit="bpm" />
        <Stat label="HRV" value={round(summary?.avgHRV)} unit="ms" />
        <Stat label="Breathing" value={round(summary?.avgBreathingRate)} unit="br/min" />
      </div>

      {records.length > 1 && (
        <p className="ios-numeric border-t border-zinc-800 px-4 py-2.5 text-[13px] leading-[18px] text-zinc-500">
          Average this week
          {' '}
          <span className="text-white">{formatDuration(Math.round(avgDuration))}</span>
          {` · ${records.length} nights`}
        </p>
      )}
    </section>
  )
}

function Stat({ label, value, unit }: { label: string, value: string, unit: string }) {
  return (
    <div className="min-w-0">
      <p className="ios-numeric truncate">
        <span className="text-[22px] font-semibold leading-7 text-white">{value}</span>
        <span className="text-[13px] text-zinc-500">
          {' '}
          {unit}
        </span>
      </p>
      <p className="truncate text-[13px] leading-[18px] text-zinc-500">{label}</p>
    </div>
  )
}
