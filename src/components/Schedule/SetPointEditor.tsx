'use client'

import { useState, useEffect, useCallback } from 'react'
import { Minus, Plus } from 'lucide-react'
import { TimeInput } from './TimeInput'
import type { SchedulePhase } from '@/src/hooks/useSchedules'
import { useTemperatureUnit } from '@/src/hooks/useTemperatureUnit'
import { displayToSetpointF, setpointFToDisplay } from '@/src/lib/tempUtils'
import { ListRow, ListSection, Sheet, Switch } from '@/src/ui/ios'
import { DestructiveRow, SheetAction } from './EditorRows'
import { tempTint } from './scheduleFormat'

interface SetPointEditorProps {
  /** Phase to edit, or null for create mode */
  editingPhase: SchedulePhase | null
  /** Whether the editor is visible */
  open: boolean
  /** Close the editor */
  onClose: () => void
  /** Called with (time, temperature) for creation */
  onCreate: (time: string, temperature: number) => void
  /** Called with (id, { time, temperature, enabled }) for updates */
  onUpdate: (id: number, updates: { time?: string, temperature?: number, enabled?: boolean }) => void
  /** Called with (id) for deletion */
  onDelete: (id: number) => void
}

const MIN_TEMP = 55
const MAX_TEMP = 110
const DEFAULT_TEMP = 78
const DEFAULT_TIME = '22:00'

/**
 * Sheet for creating or editing a temperature set point: a large tinted
 * temperature with ± buttons and a slider, then time / enabled rows and a
 * destructive Delete row (tap twice to confirm).
 */
export function SetPointEditor({
  editingPhase,
  open,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: SetPointEditorProps) {
  const isEditing = editingPhase !== null
  const { unit } = useTemperatureUnit()
  const minDisplayTemp = Math.round(setpointFToDisplay(MIN_TEMP, unit) ?? MIN_TEMP)
  const maxDisplayTemp = Math.round(setpointFToDisplay(MAX_TEMP, unit) ?? MAX_TEMP)
  const defaultDisplayTemp = Math.round(setpointFToDisplay(DEFAULT_TEMP, unit) ?? DEFAULT_TEMP)

  const [time, setTime] = useState(DEFAULT_TIME)
  const [displayTemperature, setDisplayTemperature] = useState(defaultDisplayTemp)
  const [enabled, setEnabled] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Sync form state when editingPhase changes
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (editingPhase) {
      setTime(editingPhase.time)
      setDisplayTemperature(Math.round(setpointFToDisplay(editingPhase.temperature, unit) ?? editingPhase.temperature))
      setEnabled(editingPhase.enabled)
    }
    else {
      setTime(DEFAULT_TIME)
      setDisplayTemperature(defaultDisplayTemp)
      setEnabled(true)
    }
    setShowDeleteConfirm(false)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [editingPhase, open, unit, defaultDisplayTemp])

  const handleSave = useCallback(() => {
    const temperatureF = Math.round(displayToSetpointF(displayTemperature, unit) ?? DEFAULT_TEMP)
    if (isEditing && editingPhase) {
      const updates: { time?: string, temperature?: number, enabled?: boolean } = {}
      if (time !== editingPhase.time) updates.time = time
      if (temperatureF !== editingPhase.temperature) updates.temperature = temperatureF
      if (enabled !== editingPhase.enabled) updates.enabled = enabled
      // Only call update if something changed
      if (Object.keys(updates).length > 0) {
        onUpdate(editingPhase.id, updates)
      }
    }
    else {
      onCreate(time, temperatureF)
    }
    onClose()
  }, [isEditing, editingPhase, time, displayTemperature, unit, enabled, onCreate, onUpdate, onClose])

  const handleDelete = useCallback(() => {
    if (editingPhase) {
      onDelete(editingPhase.id)
      onClose()
    }
  }, [editingPhase, onDelete, onClose])

  const adjustTemp = (delta: number) => {
    setDisplayTemperature(prev => Math.max(minDisplayTemp, Math.min(maxDisplayTemp, prev + delta)))
  }

  const temperatureF = Math.round(displayToSetpointF(displayTemperature, unit) ?? DEFAULT_TEMP)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit Set Point' : 'Add Set Point'}
      trailing={<SheetAction onClick={handleSave}>{isEditing ? 'Done' : 'Add'}</SheetAction>}
    >
      <div className="space-y-6">
        <div className="rounded-xl bg-zinc-900 px-4 pb-2 pt-5">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => adjustTemp(-2)}
              disabled={displayTemperature <= minDisplayTemp}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-white active:bg-zinc-700 disabled:text-zinc-600"
              aria-label="Decrease temperature"
            >
              <Minus size={20} />
            </button>
            <div className="text-center">
              <div className="ios-numeric text-[56px] font-light leading-none" style={{ color: tempTint(temperatureF) }}>
                {displayTemperature}
                °
                <span className="text-[34px]">{unit}</span>
              </div>
              <div className="ios-numeric mt-1.5 text-[13px] text-zinc-500">
                {minDisplayTemp}
                °–
                {maxDisplayTemp}
                °
              </div>
            </div>
            <button
              type="button"
              onClick={() => adjustTemp(2)}
              disabled={displayTemperature >= maxDisplayTemp}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-white active:bg-zinc-700 disabled:text-zinc-600"
              aria-label="Increase temperature"
            >
              <Plus size={20} />
            </button>
          </div>
          <input
            type="range"
            min={minDisplayTemp}
            max={maxDisplayTemp}
            step={1}
            value={displayTemperature}
            onChange={e => setDisplayTemperature(Number(e.target.value))}
            className="m-0 mt-4 block h-7 w-full accent-sky-500"
            aria-label="Temperature slider"
          />
        </div>

        <ListSection>
          <TimeInput label="Time" value={time} onChange={setTime} />
          {isEditing && (
            <ListRow
              title="Enabled"
              accessory={<Switch checked={enabled} onChange={setEnabled} aria-label="Enabled" />}
            />
          )}
        </ListSection>

        {isEditing && (
          <ListSection footer={showDeleteConfirm ? 'Tap again to remove this set point.' : undefined}>
            <DestructiveRow
              onClick={() => {
                if (showDeleteConfirm) handleDelete()
                else setShowDeleteConfirm(true)
              }}
            >
              {showDeleteConfirm ? 'Confirm Delete' : 'Delete Set Point'}
            </DestructiveRow>
          </ListSection>
        )}
      </div>
    </Sheet>
  )
}
