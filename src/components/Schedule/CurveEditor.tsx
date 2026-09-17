'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Flame, Scale, Snowflake, Sparkles } from 'lucide-react'
import { ListRow, ListSection, Sheet } from '@/src/ui/ios'
import { AICurveWizard } from './AICurveWizard'
import { CurveChart } from './CurveChart'
import { SetPointCard } from './SetPointCard'
import { SetPointEditor } from './SetPointEditor'
import { TimeInput } from './TimeInput'
import { DAYS, DayPicker, type DayOfWeek } from './DaySelector'
import { ConfirmDialog } from './ConfirmDialog'
import { AddRow, DestructiveRow, SheetAction, StepperRow } from './EditorRows'
import { tempTint } from './scheduleFormat'
import { useSchedule } from '@/src/hooks/useSchedule'
import type { SchedulePhase } from '@/src/hooks/useSchedules'
import type { CurvePoint, CoolingIntensity } from '@/src/lib/sleepCurve/types'
import {
  generateSleepCurve,
  curveToScheduleTemperatures,
  timeStringToMinutes,
} from '@/src/lib/sleepCurve/generate'
import { rebaseSetPoints } from '@/src/lib/sleepCurve/rebase'
import { sortChronological } from '@/src/lib/scheduleGrouping'
import { useTemperatureUnit } from '@/src/hooks/useTemperatureUnit'
import { displayToSetpointF, formatSetpointF, setpointFToDisplay, type TempUnit } from '@/src/lib/tempUtils'

interface CurveEditorProps {
  open: boolean
  onClose: () => void
  /** When provided, editor opens in edit mode for the existing curve. */
  initialDays?: DayOfWeek[]
  /** Initial set points. Empty array = create mode with empty list. */
  initialSetPoints?: Array<{ time: string, temperature: number }>
  /** Edit mode only: shows a destructive "Delete Curve" row. The parent confirms and deletes. */
  onDelete?: () => void
}

interface LocalSetPoint {
  localId: number
  time: string
  temperature: number
}

interface PresetDef {
  id: CoolingIntensity
  label: string
  description: string
  icon: typeof Snowflake
}

const PRESETS: PresetDef[] = [
  { id: 'cool', label: 'Hot sleeper', description: 'Cooler through the night', icon: Snowflake },
  { id: 'balanced', label: 'Balanced', description: 'Cool for deep sleep, warm to wake', icon: Scale },
  { id: 'warm', label: 'Cold sleeper', description: 'Stays warmer overall', icon: Flame },
]

const DEFAULT_BEDTIME = '22:00'
const DEFAULT_WAKE = '07:00'
const DEFAULT_MIN_TEMP = 68
const DEFAULT_MAX_TEMP = 86
const TEMP_FLOOR = 55
const TEMP_CEIL = 110

function toPhase(point: LocalSetPoint): SchedulePhase {
  return {
    id: point.localId,
    name: '',
    icon: 'moon',
    time: point.time,
    temperature: point.temperature,
    enabled: true,
  }
}

function buildCurveData(points: LocalSetPoint[]) {
  if (points.length === 0) return null
  const sorted = [...points].sort((a, b) => a.time.localeCompare(b.time))
  const temps = sorted.map(p => p.temperature)
  const min = Math.min(...temps)
  const max = Math.max(...temps)
  const btMin = timeStringToMinutes(sorted[0].time)

  const curvePoints: CurvePoint[] = sorted.map((p, i) => {
    let tMin = timeStringToMinutes(p.time) - btMin
    if (tMin < -120) tMin += 24 * 60
    const frac = sorted.length > 1 ? i / (sorted.length - 1) : 0
    const phase
      = frac < 0.1
        ? ('warmUp' as const)
        : frac < 0.25
          ? ('coolDown' as const)
          : frac < 0.55
            ? ('deepSleep' as const)
            : frac < 0.75
              ? ('maintain' as const)
              : frac < 0.9
                ? ('preWake' as const)
                : ('wake' as const)
    return { minutesFromBedtime: tMin, tempOffset: p.temperature - 80, phase }
  }).sort((a, b) => a.minutesFromBedtime - b.minutesFromBedtime)

  return { points: curvePoints, bedtimeMinutes: btMin, minTempF: min, maxTempF: max }
}

/**
 * Sheet for creating or editing a curve.
 * Local state until "Save" — then writes via `useSchedule.saveCurve` (one batch).
 */
export function CurveEditor({
  open,
  onClose,
  initialDays = [],
  initialSetPoints = [],
  onDelete,
}: CurveEditorProps) {
  const { saveCurve, detectCurveConflicts, isMutating } = useSchedule()
  const { unit } = useTemperatureUnit()

  const isEdit = initialDays.length > 0
  const initialSorted = useMemo(() => sortChronological(initialSetPoints), [initialSetPoints])
  const initialBedtime = initialSorted[0]?.time ?? DEFAULT_BEDTIME
  const initialWake = initialSorted[initialSorted.length - 1]?.time ?? DEFAULT_WAKE
  const initialMinTemp = initialSetPoints.length > 0
    ? Math.min(...initialSetPoints.map(p => p.temperature))
    : DEFAULT_MIN_TEMP
  const initialMaxTemp = initialSetPoints.length > 0
    ? Math.max(...initialSetPoints.map(p => p.temperature))
    : DEFAULT_MAX_TEMP

  const [days, setDays] = useState<Set<DayOfWeek>>(new Set(initialDays))
  const [points, setPoints] = useState<LocalSetPoint[]>(() =>
    initialSetPoints.map((p, i) => ({ localId: -(i + 1), time: p.time, temperature: p.temperature })),
  )
  const [bedtime, setBedtime] = useState(initialBedtime)
  const [wakeTime, setWakeTime] = useState(initialWake)
  const [minTemp, setMinTemp] = useState(initialMinTemp)
  const [maxTemp, setMaxTemp] = useState(initialMaxTemp)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [pendingConflict, setPendingConflict] = useState<DayOfWeek[] | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [aiWizardOpen, setAIWizardOpen] = useState(false)
  const idCounter = useRef(-1000)

  // Reset state when opening (avoid stale state from previous open)
  useEffect(() => {
    if (!open) return
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setDays(new Set(initialDays))

    setPoints(initialSetPoints.map((p, i) => ({ localId: -(i + 1), time: p.time, temperature: p.temperature })))

    setBedtime(initialBedtime)

    setWakeTime(initialWake)

    setMinTemp(initialMinTemp)

    setMaxTemp(initialMaxTemp)

    setEditorOpen(false)

    setEditingId(null)

    setPendingConflict(null)

    setSaveError(null)

    setAIWizardOpen(false)
  }, [open, initialDays, initialSetPoints, initialBedtime, initialWake, initialMinTemp, initialMaxTemp])

  const curveData = useMemo(() => buildCurveData(points), [points])

  // Phases sorted chronologically (handles overnight wrap), with auto-on/off
  // labels for the first and last entries so the user knows which point drives
  // the Pod's auto power-on and auto power-off times.
  const orderedPhases = useMemo(() => {
    const sorted = sortChronological(points.map(p => ({ time: p.time, temperature: p.temperature })))
    return sorted.map((sp) => {
      const original = points.find(p => p.time === sp.time && p.temperature === sp.temperature)
      return original
    }).filter((p): p is LocalSetPoint => p !== undefined).map(p => toPhase(p))
  }, [points])

  const autoOnId = orderedPhases[0]?.id ?? null
  const autoOffId = orderedPhases.length > 1 ? orderedPhases[orderedPhases.length - 1].id : null

  const toggleDay = useCallback((day: DayOfWeek) => {
    setDays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }, [])

  const handleAddPoint = useCallback(() => {
    setEditingId(null)
    setEditorOpen(true)
  }, [])

  const handleEditPoint = useCallback((phase: SchedulePhase) => {
    setEditingId(phase.id)
    setEditorOpen(true)
  }, [])

  const handleAdjustTemp = useCallback((id: number, delta: number) => {
    setPoints(prev => prev.map(p =>
      p.localId === id
        ? { ...p, temperature: Math.max(55, Math.min(110, p.temperature + delta)) }
        : p,
    ))
  }, [])

  const handleDeletePoint = useCallback((id: number) => {
    setPoints(prev => prev.filter(p => p.localId !== id))
  }, [])

  const handleEditorCreate = useCallback((time: string, temperature: number) => {
    const newId = idCounter.current--
    setPoints(prev => [...prev, { localId: newId, time, temperature }])
  }, [])

  const handleEditorUpdate = useCallback(
    (id: number, updates: { time?: string, temperature?: number }) => {
      setPoints(prev => prev.map(p =>
        p.localId === id
          ? { ...p, ...updates }
          : p,
      ))
    },
    [],
  )

  const handleEditorDelete = useCallback((id: number) => {
    handleDeletePoint(id)
  }, [handleDeletePoint])

  const handleApplyAICurve = useCallback((config: {
    setPoints: Array<{ time: string, temperature: number }>
    bedtime: string
    wakeTime: string
  }) => {
    const next: LocalSetPoint[] = config.setPoints.map((sp, i) => ({
      localId: -(i + 1),
      time: sp.time,
      temperature: Math.round(Math.max(TEMP_FLOOR, Math.min(TEMP_CEIL, sp.temperature))),
    }))
    setPoints(next)
    setBedtime(config.bedtime)
    setWakeTime(config.wakeTime)
    const temps = next.map(p => p.temperature)
    if (temps.length > 0) {
      setMinTemp(Math.min(...temps))
      setMaxTemp(Math.max(...temps))
    }
  }, [])

  // Bedtime/wake are the canonical sleep-window controls — changing them
  // rebases the existing set points so the curve shape stays intact within
  // the new window. Without this rewire the inputs only drove preset
  // generation, so users who edited the window without clicking a preset
  // saw their change silently dropped on save.
  const handleBedtimeChange = useCallback((next: string) => {
    setPoints(prev => rebaseSetPoints(prev, bedtime, wakeTime, next, wakeTime))
    setBedtime(next)
  }, [bedtime, wakeTime])

  const handleWakeTimeChange = useCallback((next: string) => {
    setPoints(prev => rebaseSetPoints(prev, bedtime, wakeTime, bedtime, next))
    setWakeTime(next)
  }, [bedtime, wakeTime])

  const handleApplyPreset = useCallback((preset: PresetDef) => {
    const bedtimeMinutes = timeStringToMinutes(bedtime)
    const wakeMinutes = timeStringToMinutes(wakeTime)
    const curvePoints = generateSleepCurve({
      bedtimeMinutes,
      wakeMinutes,
      intensity: preset.id,
      minTempF: minTemp,
      maxTempF: maxTemp,
    })
    const scheduleTemps = curveToScheduleTemperatures(curvePoints, bedtimeMinutes)
    const next: LocalSetPoint[] = Object.entries(scheduleTemps).map(([time, temperature], i) => ({
      localId: -(i + 1),
      time,
      temperature: Math.round(Math.max(TEMP_FLOOR, Math.min(TEMP_CEIL, temperature))),
    }))
    setPoints(next)
  }, [bedtime, wakeTime, minTemp, maxTemp])

  const performSave = useCallback(async (force = false) => {
    const targetDays = Array.from(days)
    if (targetDays.length === 0) {
      setSaveError('Pick at least one day')
      return
    }
    if (points.length === 0) {
      setSaveError('Add at least one set point')
      return
    }

    if (!force) {
      const conflicts = detectCurveConflicts(targetDays, initialDays)
      if (conflicts.length > 0) {
        setPendingConflict(conflicts)
        return
      }
    }

    try {
      await saveCurve({
        targetDays,
        setPoints: points.map(p => ({ time: p.time, temperature: p.temperature })),
        originalDays: initialDays,
      })
      setPendingConflict(null)
      onClose()
    }
    catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    }
  }, [days, points, initialDays, detectCurveConflicts, saveCurve, onClose])

  const editingPhase = editingId !== null ? orderedPhases.find(p => p.id === editingId) ?? null : null

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={isEdit ? 'Edit Curve' : 'New Curve'}
        trailing={(
          <SheetAction
            onClick={() => void performSave()}
            disabled={isMutating || days.size === 0 || points.length === 0}
          >
            {isMutating ? 'Saving…' : 'Save'}
          </SheetAction>
        )}
      >
        <div className="space-y-6">
          <ListSection header="Days">
            <DayPicker value={days} onToggle={toggleDay} />
          </ListSection>

          <ListSection
            header="Sleep window"
            footer="The Pod turns on at the first set point and off at the last. Changing these shifts the curve to fit."
          >
            <TimeInput label="Bedtime" value={bedtime} onChange={handleBedtimeChange} />
            <TimeInput label="Wake up" value={wakeTime} onChange={handleWakeTimeChange} />
          </ListSection>

          <ListSection header="Temperature range" footer="Used when you start from a preset.">
            <TempStepper
              label="Coolest"
              value={minTemp}
              onChange={v => setMinTemp(Math.min(v, maxTemp - 2))}
              unit={unit}
            />
            <TempStepper
              label="Warmest"
              value={maxTemp}
              onChange={v => setMaxTemp(Math.max(v, minTemp + 2))}
              unit={unit}
            />
          </ListSection>

          {points.length === 0
            ? (
                <ListSection header="Start from a preset" footer="Or add set points one at a time.">
                  {PRESETS.map(preset => (
                    <ListRow
                      key={preset.id}
                      icon={preset.icon}
                      title={preset.label}
                      subtitle={preset.description}
                      onClick={() => handleApplyPreset(preset)}
                    />
                  ))}
                  <ListRow
                    icon={Sparkles}
                    title="Custom AI curve"
                    subtitle="Describe how you sleep, get a curve"
                    onClick={() => setAIWizardOpen(true)}
                    accessory={<ChevronRight size={18} className="shrink-0 text-zinc-600" />}
                  />
                  <AddRow onClick={handleAddPoint}>Add Set Point</AddRow>
                </ListSection>
              )
            : (
                <>
                  {curveData && (
                    <section className="rounded-xl bg-zinc-900 pb-2 pl-1 pr-2 pt-3">
                      <CurveChart
                        points={curveData.points}
                        bedtimeMinutes={curveData.bedtimeMinutes}
                        minTempF={curveData.minTempF}
                        maxTempF={curveData.maxTempF}
                        compact
                      />
                    </section>
                  )}
                  <ListSection header="Set points" footer="Tap a time to change it or delete the set point.">
                    {orderedPhases.map(phase => (
                      <SetPointCard
                        key={phase.id}
                        phase={phase}
                        onAdjustTemp={handleAdjustTemp}
                        onDelete={handleDeletePoint}
                        onTapCard={handleEditPoint}
                        disabled={isMutating}
                        autoLabel={
                          phase.id === autoOnId
                            ? 'on'
                            : phase.id === autoOffId
                              ? 'off'
                              : null
                        }
                      />
                    ))}
                    <AddRow onClick={handleAddPoint} disabled={isMutating}>Add Set Point</AddRow>
                  </ListSection>
                </>
              )}

          {saveError && (
            <p className="px-4 text-[13px] text-red-400">{saveError}</p>
          )}

          {isEdit && onDelete && (
            <ListSection>
              <DestructiveRow onClick={onDelete} disabled={isMutating}>Delete Curve</DestructiveRow>
            </ListSection>
          )}
        </div>
      </Sheet>

      {/* Custom AI curve wizard */}
      <AICurveWizard
        open={open && aiWizardOpen}
        onClose={() => setAIWizardOpen(false)}
        onApply={handleApplyAICurve}
      />

      {/* Per-point editor sheet */}
      <SetPointEditor
        editingPhase={editingPhase}
        open={open && editorOpen}
        onClose={() => {
          setEditorOpen(false)
          setEditingId(null)
        }}
        onCreate={handleEditorCreate}
        onUpdate={handleEditorUpdate}
        onDelete={handleEditorDelete}
      />

      {/* Conflict confirm dialog */}
      <ConfirmDialog
        open={open && pendingConflict !== null}
        title="Move days from another curve?"
        message={pendingConflict
          ? `${pendingConflict.map(d => DAYS.find(x => x.key === d)?.label).join(', ')} ${pendingConflict.length === 1 ? 'is' : 'are'} already part of another curve. Saving will move ${pendingConflict.length === 1 ? 'it' : 'them'} to this curve.`
          : ''}
        confirmLabel={isMutating ? 'Saving…' : 'Move'}
        busy={isMutating}
        onConfirm={() => void performSave(true)}
        onCancel={() => setPendingConflict(null)}
      />
    </>
  )
}

interface TempStepperProps {
  label: string
  value: number
  onChange: (value: number) => void
  unit: TempUnit
}

function TempStepper({ label, value, onChange, unit }: TempStepperProps) {
  const displayValue = Math.round(setpointFToDisplay(value, unit) ?? value)
  const minDisplay = Math.round(setpointFToDisplay(TEMP_FLOOR, unit) ?? TEMP_FLOOR)
  const maxDisplay = Math.round(setpointFToDisplay(TEMP_CEIL, unit) ?? TEMP_CEIL)
  const applyDisplayDelta = (delta: number) => {
    const nextDisplay = Math.max(minDisplay, Math.min(maxDisplay, displayValue + delta))
    const nextF = Math.round(displayToSetpointF(nextDisplay, unit) ?? value)
    onChange(Math.max(TEMP_FLOOR, Math.min(TEMP_CEIL, nextF)))
  }

  return (
    <StepperRow
      label={label}
      value={<span style={{ color: tempTint(value) }}>{formatSetpointF(value, unit)}</span>}
      onDecrement={() => applyDisplayDelta(-1)}
      onIncrement={() => applyDisplayDelta(1)}
      decrementDisabled={value <= TEMP_FLOOR}
      incrementDisabled={value >= TEMP_CEIL}
    />
  )
}
