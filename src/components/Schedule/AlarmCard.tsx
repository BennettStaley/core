'use client'

import clsx from 'clsx'
import type { DayOfWeek } from './DaySelector'
import { formatTime12h } from './TimeInput'
import { useTemperatureUnit } from '@/src/hooks/useTemperatureUnit'
import { formatSetpointF } from '@/src/lib/tempUtils'
import { Switch } from '@/src/ui/ios'
import { formatDays, splitTime12h } from './scheduleFormat'

export interface AlarmGroup {
  /** All underlying alarm_schedules row ids in this group */
  ids: number[]
  days: DayOfWeek[]
  time: string
  vibrationIntensity: number
  vibrationPattern: 'rise' | 'double'
  duration: number
  alarmTemperature: number
  enabled: boolean
}

interface AlarmCardProps {
  group: AlarmGroup
  /** Opens the alarm editor (which hosts Test and Delete). */
  onEdit: () => void
  /** Flip enabled for every row in the group. */
  onToggle: (enabled: boolean) => void
  /** Disables the switch while a toggle is in flight. */
  isToggling?: boolean
}

/**
 * Clock.app-style alarm row: large light tabular time, a repeat/vibration
 * summary underneath and an on/off switch. Tap the text to edit.
 */
export function AlarmCard({ group, onEdit, onToggle, isToggling = false }: AlarmCardProps) {
  const { unit } = useTemperatureUnit()
  const label = formatDays(group.days)
  const [digits, period] = splitTime12h(formatTime12h(group.time))

  return (
    <div className="flex min-h-[88px] items-center gap-3 pr-4">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${formatTime12h(group.time)} ${label} alarm`}
        className="flex min-w-0 flex-1 flex-col items-start self-stretch justify-center py-2 pl-4 text-left active:opacity-60"
      >
        <span className={clsx('ios-numeric text-[34px] font-light leading-[41px]', group.enabled ? 'text-white' : 'text-zinc-500')}>
          {digits}
          <span className="ml-1 text-[22px]">{period}</span>
        </span>
        <span className="block max-w-full truncate text-[15px] leading-5 text-zinc-500">
          {label}
          {' · '}
          {group.duration}
          {' s vibration · '}
          {formatSetpointF(group.alarmTemperature, unit)}
        </span>
      </button>
      <Switch
        checked={group.enabled}
        onChange={onToggle}
        disabled={isToggling}
        aria-label={`${formatTime12h(group.time)} alarm`}
      />
    </div>
  )
}
