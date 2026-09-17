'use client'

import { Bell, BellOff, Clock } from 'lucide-react'
import { trpc } from '@/src/utils/trpc'
import { useSide } from '@/src/providers/SideProvider'

interface AlarmBannerProps {
  /** Which side(s) have active alarms */
  leftAlarmActive: boolean
  rightAlarmActive: boolean
  /** Snooze status per side (from snoozeManager.getSnoozeStatus) */
  snooze?: {
    left?: { active: boolean, snoozeUntil: number | null } | null
    right?: { active: boolean, snoozeUntil: number | null } | null
  }
  /** Called after alarm action to refresh status */
  onActionComplete?: () => void
}

/**
 * Alarm banner shown on Temp screen when vibration alarm is active.
 * Grouped card with an orange bell and Snooze / Stop actions along the bottom.
 */
export const AlarmBanner = ({
  leftAlarmActive,
  rightAlarmActive,
  snooze,
  onActionComplete,
}: AlarmBannerProps) => {
  const { activeSides } = useSide()

  const clearAlarmMutation = trpc.device.clearAlarm.useMutation()
  const snoozeAlarmMutation = trpc.device.snoozeAlarm.useMutation()

  const isAnyAlarmActive = leftAlarmActive || rightAlarmActive
  const leftSnoozed = snooze?.left?.active === true && snooze.left.snoozeUntil != null
  const rightSnoozed = snooze?.right?.active === true && snooze.right.snoozeUntil != null
  const isAnySnoozed = leftSnoozed || rightSnoozed

  if (!isAnyAlarmActive && !isAnySnoozed) return null

  const alarmSides = [
    leftAlarmActive && 'Left',
    rightAlarmActive && 'Right',
  ].filter(Boolean)

  const snoozeSides = [
    leftSnoozed && 'Left',
    rightSnoozed && 'Right',
  ].filter(Boolean)

  const handleStop = () => {
    // During snooze nothing is vibrating, so the stop targets are the
    // snoozed sides — building them from leftAlarmActive/rightAlarmActive
    // (both false) made the Cancel button a no-op and the alarm resumed.
    const stoppable = isAnyAlarmActive
      ? { left: leftAlarmActive, right: rightAlarmActive }
      : { left: leftSnoozed, right: rightSnoozed }

    const sidesToClear = activeSides.filter(s => stoppable[s])
    // If no active sides match, clear all stoppable alarms
    const targets = sidesToClear.length > 0
      ? sidesToClear
      : (['left', 'right'] as const).filter(s => stoppable[s])

    for (const side of targets) {
      clearAlarmMutation.mutate(
        { side },
        { onSettled: onActionComplete },
      )
    }
  }

  const handleSnooze = () => {
    const sidesToSnooze = activeSides.filter(
      s => (s === 'left' && leftAlarmActive) || (s === 'right' && rightAlarmActive),
    )
    const targets = sidesToSnooze.length > 0
      ? sidesToSnooze
      : [leftAlarmActive && 'left', rightAlarmActive && 'right'].filter(Boolean) as ('left' | 'right')[]

    for (const side of targets) {
      snoozeAlarmMutation.mutate(
        { side, duration: 300 },
        { onSettled: onActionComplete },
      )
    }
  }

  const formatSnoozeRemaining = (snoozeUntilSec: number): string => {
    // eslint-disable-next-line react-hooks/purity
    const remaining = Math.max(0, snoozeUntilSec - Math.floor(Date.now() / 1000))
    const mins = Math.ceil(remaining / 60)
    return `${mins}m`
  }

  const isPending = clearAlarmMutation.isPending || snoozeAlarmMutation.isPending

  return (
    <div className="overflow-hidden rounded-xl bg-zinc-900">
      {/* Active alarm */}
      {isAnyAlarmActive && (
        <>
          <div className="flex items-center gap-3 px-4 py-3">
            <Bell size={20} className="shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-semibold leading-[22px] text-white">Alarm</p>
              <p className="text-[15px] leading-5 text-zinc-500">
                {alarmSides.join(' & ')}
                {' '}
                side vibrating
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-zinc-800">
            <button
              onClick={handleSnooze}
              disabled={isPending}
              className="flex min-h-[44px] items-center justify-center gap-1.5 text-[17px] text-sky-400 active:bg-zinc-800 disabled:opacity-40"
            >
              <Clock size={17} />
              Snooze 5m
            </button>
            <button
              onClick={handleStop}
              disabled={isPending}
              className="flex min-h-[44px] items-center justify-center gap-1.5 border-l border-zinc-800 text-[17px] font-semibold text-sky-400 active:bg-zinc-800 disabled:opacity-40"
            >
              <BellOff size={17} />
              Stop
            </button>
          </div>
        </>
      )}

      {/* Snoozed alarm (when not actively vibrating) */}
      {!isAnyAlarmActive && isAnySnoozed && (
        <div className="flex min-h-[44px] items-center gap-3 py-1 pl-4 pr-2">
          <Clock size={20} className="shrink-0 text-amber-500" />
          <p className="ios-numeric min-w-0 flex-1 text-[15px] leading-5 text-white">
            Snoozed —
            {' '}
            {snoozeSides.join(' & ')}
            {' '}
            resumes in
            {' '}
            {snooze?.left?.snoozeUntil
              ? formatSnoozeRemaining(snooze.left.snoozeUntil)
              : snooze?.right?.snoozeUntil
                ? formatSnoozeRemaining(snooze.right.snoozeUntil)
                : ''}
          </p>
          <button
            onClick={handleStop}
            disabled={isPending}
            className="min-h-[44px] shrink-0 px-2 text-[17px] text-sky-400 active:opacity-50 disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
