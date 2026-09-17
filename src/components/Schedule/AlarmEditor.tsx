'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Loader2, Square, Vibrate } from 'lucide-react'
import { ListRow, ListSection, SegmentedControl, Sheet } from '@/src/ui/ios'
import { trpc } from '@/src/utils/trpc'
import { FIXED_INTENSITY, FIXED_PATTERN, VIBRATION_PRESETS } from '@/src/lib/vibrationPatterns'
import { DayPicker, type DayOfWeek } from './DaySelector'
import { DestructiveRow, SheetAction } from './EditorRows'
import { formatDays, tempTint } from './scheduleFormat'
import { TimeInput } from './TimeInput'
import type { AlarmGroup } from './AlarmCard'
import { useTemperatureUnit } from '@/src/hooks/useTemperatureUnit'
import { displayToSetpointF, setpointFToDisplay } from '@/src/lib/tempUtils'

type Side = 'left' | 'right'

interface AlarmEditorProps {
  open: boolean
  onClose: () => void
  side: Side
  /** When provided, editor opens in edit mode for this group. */
  existingGroup?: AlarmGroup | null
  /** Called after a successful save so the parent can refetch. */
  onSaved?: () => void
}

const DEFAULT_TIME = '07:00'
const DEFAULT_DURATION = 30
const DEFAULT_TEMP = 75

const MIN_TEMP = 55
const MAX_TEMP = 110

/**
 * Sheet for creating or editing an alarm.
 * - Each saved alarm produces one row per selected day (same time/pattern/intensity/duration/temp).
 * - "Test" fires `device.setAlarm` immediately so the user can feel the pattern.
 * - On save, delete-then-create: removes existing rows for this group then writes new ones.
 */
export function AlarmEditor({
  open,
  onClose,
  side,
  existingGroup = null,
  onSaved,
}: AlarmEditorProps) {
  const isEdit = existingGroup !== null
  const { unit } = useTemperatureUnit()
  const minDisplayTemp = Math.round(setpointFToDisplay(MIN_TEMP, unit) ?? MIN_TEMP)
  const maxDisplayTemp = Math.round(setpointFToDisplay(MAX_TEMP, unit) ?? MAX_TEMP)
  const defaultDisplayTemp = Math.round(setpointFToDisplay(DEFAULT_TEMP, unit) ?? DEFAULT_TEMP)

  const [days, setDays] = useState<Set<DayOfWeek>>(new Set())
  const [time, setTime] = useState(DEFAULT_TIME)
  const [duration, setDuration] = useState(DEFAULT_DURATION)
  const [displayTemperature, setDisplayTemperature] = useState(defaultDisplayTemp)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Reset local state when opening
  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect */
    if (existingGroup) {
      setDays(new Set(existingGroup.days))
      setTime(existingGroup.time)
      setDuration(existingGroup.duration)
      setDisplayTemperature(Math.round(setpointFToDisplay(existingGroup.alarmTemperature, unit) ?? existingGroup.alarmTemperature))
    }
    else {
      setDays(new Set())
      setTime(DEFAULT_TIME)
      setDuration(DEFAULT_DURATION)
      setDisplayTemperature(defaultDisplayTemp)
    }
    setSaveError(null)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, existingGroup, unit, defaultDisplayTemp])

  const batchUpdate = trpc.schedules.batchUpdate.useMutation()
  const testAlarm = trpc.device.setAlarm.useMutation()
  const clearAlarm = trpc.device.clearAlarm.useMutation()
  const utils = trpc.useUtils()

  const isMutating = batchUpdate.isPending

  const toggleDay = useCallback((day: DayOfWeek) => {
    setDays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }, [])

  const applyPreset = useCallback((preset: typeof VIBRATION_PRESETS[number]) => {
    setDuration(preset.duration)
  }, [])

  const handleTest = useCallback(() => {
    testAlarm.mutate({ side, vibrationIntensity: FIXED_INTENSITY, vibrationPattern: FIXED_PATTERN, duration })
  }, [testAlarm, side, duration])

  const handleStopTest = useCallback(() => {
    clearAlarm.mutate({ side })
  }, [clearAlarm, side])

  const handleSave = useCallback(async () => {
    if (days.size === 0) {
      setSaveError('Pick at least one day')
      return
    }
    setSaveError(null)

    const targetDays = Array.from(days)
    const temperatureF = Math.round(displayToSetpointF(displayTemperature, unit) ?? DEFAULT_TEMP)
    // Preserve enabled state when editing a paused alarm; new alarms default to enabled.
    const enabled = existingGroup?.enabled ?? true
    const creates = targetDays.map(dayOfWeek => ({
      side,
      dayOfWeek,
      time,
      vibrationIntensity: FIXED_INTENSITY,
      vibrationPattern: FIXED_PATTERN,
      duration,
      alarmTemperature: temperatureF,
      enabled,
    }))

    try {
      await batchUpdate.mutateAsync({
        deletes: { alarm: existingGroup?.ids ?? [] },
        creates: { alarm: creates },
      })
      void utils.schedules.getAll.invalidate()
      void utils.schedules.getByDay.invalidate()
      onSaved?.()
      onClose()
    }
    catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save alarm')
    }
  }, [days, side, time, duration, displayTemperature, unit, existingGroup, batchUpdate, utils, onSaved, onClose])

  const handleDelete = useCallback(async () => {
    if (!existingGroup) return
    setSaveError(null)
    try {
      await batchUpdate.mutateAsync({
        deletes: { alarm: existingGroup.ids },
      })
      void utils.schedules.getAll.invalidate()
      void utils.schedules.getByDay.invalidate()
      onSaved?.()
      onClose()
    }
    catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to delete alarm')
    }
  }, [existingGroup, batchUpdate, utils, onSaved, onClose])

  const presetValue = VIBRATION_PRESETS.find(p => p.duration === duration)?.name ?? ''

  return (
    <Sheet
      open={open}
      onClose={() => {
        if (!isMutating) onClose()
      }}
      title={isEdit ? 'Edit Alarm' : 'Add Alarm'}
      leading={(
        <button type="button" onClick={onClose} disabled={isMutating} className="text-[17px] text-sky-400 active:opacity-50 disabled:text-zinc-600">
          Cancel
        </button>
      )}
      trailing={(
        <SheetAction onClick={() => void handleSave()} disabled={isMutating || days.size === 0}>
          {isMutating ? 'Saving…' : 'Save'}
        </SheetAction>
      )}
    >
      <div className="space-y-6">
        <ListSection>
          <TimeInput label="Time" value={time} onChange={setTime} disabled={isMutating} />
        </ListSection>

        <ListSection header="Repeat" footer={days.size === 0 ? 'Pick at least one day.' : formatDays(Array.from(days))}>
          <DayPicker value={days} onToggle={toggleDay} />
        </ListSection>

        <ListSection
          header="Vibration"
          footer="Pod 5 firmware fixes intensity and pattern, so only the length of the buzz changes."
        >
          <div className="px-4 py-2.5">
            <SegmentedControl
              aria-label="Vibration length"
              options={VIBRATION_PRESETS.map(p => ({ value: p.name, label: p.name }))}
              value={presetValue}
              onChange={(name) => {
                const preset = VIBRATION_PRESETS.find(p => p.name === name)
                if (preset) applyPreset(preset)
              }}
            />
          </div>
          <SliderRow
            label="Duration"
            value={`${duration} s`}
            min={1}
            max={180}
            current={duration}
            onChange={setDuration}
          />
        </ListSection>

        <ListSection header="Bed temperature at wake">
          <SliderRow
            label="Temperature"
            value={(
              <span style={{ color: tempTint(Math.round(displayToSetpointF(displayTemperature, unit) ?? DEFAULT_TEMP)) }}>
                {displayTemperature}
                °
                {unit}
              </span>
            )}
            min={minDisplayTemp}
            max={maxDisplayTemp}
            current={displayTemperature}
            onChange={setDisplayTemperature}
          />
        </ListSection>

        <ListSection
          footer={testAlarm.error
            ? <span className="text-red-400">{testAlarm.error.message}</span>
            : `Buzzes the ${side} side now with this duration.`}
        >
          <ListRow
            icon={Vibrate}
            title="Test Vibration"
            onClick={handleTest}
            disabled={testAlarm.isPending}
            accessory={testAlarm.isPending ? <Loader2 size={17} className="shrink-0 animate-spin text-zinc-500" /> : undefined}
          />
          <ListRow
            icon={Square}
            title="Stop"
            onClick={handleStopTest}
            disabled={clearAlarm.isPending}
          />
        </ListSection>

        {saveError && (
          <p className="px-4 text-[13px] text-red-400">{saveError}</p>
        )}

        {isEdit && (
          <ListSection>
            <DestructiveRow onClick={() => void handleDelete()} disabled={isMutating}>Delete Alarm</DestructiveRow>
          </ListSection>
        )}
      </div>
    </Sheet>
  )
}

interface SliderRowProps {
  label: string
  value: ReactNode
  min: number
  max: number
  current: number
  onChange: (value: number) => void
}

/** Title + value on one line, a full-width slider underneath. */
function SliderRow({ label, value, min, max, current, onChange }: SliderRowProps) {
  return (
    <div className="px-4 pb-1.5 pt-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[17px] text-white">{label}</span>
        <span className="ios-numeric text-[17px] text-zinc-500">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={current}
        onChange={e => onChange(parseInt(e.target.value, 10))}
        aria-label={label}
        className="m-0 mt-2 block h-7 w-full accent-sky-500"
      />
    </div>
  )
}
