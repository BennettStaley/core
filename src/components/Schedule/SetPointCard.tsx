'use client'

import clsx from 'clsx'
import type { SchedulePhase } from '@/src/hooks/useSchedules'
import { formatTime12h } from './TimeInput'
import { useTemperatureUnit } from '@/src/hooks/useTemperatureUnit'
import { formatSetpointF } from '@/src/lib/tempUtils'
import { Stepper } from './EditorRows'
import { tempTint } from './scheduleFormat'

interface SetPointCardProps {
  phase: SchedulePhase
  onAdjustTemp: (id: number, delta: number) => void
  /**
   * Kept for API compatibility. Deleting now happens from the set point
   * sheet (tap the row) rather than an inline trash icon.
   */
  onDelete?: (id: number) => void
  onTapCard: (phase: SchedulePhase) => void
  disabled?: boolean
  /** Optional caption under the time (e.g. "Auto on", "Auto off") */
  autoLabel?: 'on' | 'off' | null
}

/**
 * Set point as a grouped-list row: time (tap to edit), tinted temperature
 * and a UIStepper for quick ±2° nudges.
 */
export function SetPointCard({
  phase,
  onAdjustTemp,
  onTapCard,
  disabled = false,
  autoLabel = null,
}: SetPointCardProps) {
  const { unit } = useTemperatureUnit()

  return (
    <div
      className={clsx(
        'flex min-h-[44px] items-center gap-3 px-4 py-1.5 transition-opacity',
        !phase.enabled && 'opacity-40',
        disabled && 'opacity-60',
      )}
    >
      <button
        type="button"
        onClick={() => onTapCard(phase)}
        disabled={disabled}
        aria-label={`Edit set point at ${formatTime12h(phase.time)}`}
        className="-my-1.5 -ml-4 flex min-h-[44px] min-w-0 flex-1 items-center gap-3 py-1.5 pl-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="ios-numeric block text-[17px] leading-[22px] text-white">{formatTime12h(phase.time)}</span>
          {autoLabel && (
            <span className="block text-[13px] leading-[18px] text-zinc-500">
              {autoLabel === 'on' ? 'Pod turns on' : 'Pod turns off'}
            </span>
          )}
        </span>
        <span className="ios-numeric shrink-0 text-[17px]" style={{ color: tempTint(phase.temperature) }}>
          {formatSetpointF(phase.temperature, unit)}
        </span>
      </button>
      <Stepper
        label="temperature"
        onDecrement={() => onAdjustTemp(phase.id, -2)}
        onIncrement={() => onAdjustTemp(phase.id, 2)}
        decrementDisabled={disabled || phase.temperature <= 55}
        incrementDisabled={disabled || phase.temperature >= 110}
      />
    </div>
  )
}

interface SetPointListProps {
  phases: SchedulePhase[]
  onAdjustTemp: (id: number, delta: number) => void
  onDelete?: (id: number) => void
  onTapCard: (phase: SchedulePhase) => void
  disabled?: boolean
}

/**
 * Grouped list of set point rows.
 */
export function SetPointList({
  phases,
  onAdjustTemp,
  onDelete,
  onTapCard,
  disabled = false,
}: SetPointListProps) {
  return (
    <div className="overflow-hidden rounded-xl bg-zinc-900 [&>*+*]:border-t [&>*+*]:border-zinc-800">
      {phases.map(phase => (
        <SetPointCard
          key={phase.id}
          phase={phase}
          onAdjustTemp={onAdjustTemp}
          onDelete={onDelete}
          onTapCard={onTapCard}
          disabled={disabled}
        />
      ))}
    </div>
  )
}
