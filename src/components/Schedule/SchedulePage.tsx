'use client'

import { useCallback, useMemo, useState } from 'react'
import { trpc } from '@/src/utils/trpc'
import { useSchedule } from '@/src/hooks/useSchedule'
import { useScheduleActive } from '@/src/hooks/useScheduleActive'
import { useSide } from '@/src/providers/SideProvider'
import type { SideSelection } from '@/src/providers/SideProvider'
import { useSideNames } from '@/src/hooks/useSideNames'
import { groupDaysBySharedCurve } from '@/src/lib/scheduleGrouping'
import type { ScheduleGroup } from '@/src/lib/scheduleGrouping'
import type { DayOfWeek } from './DaySelector'
import { getCurrentDay } from './DaySelector'
import { CurveCard } from './CurveCard'
import { CurveEditor } from './CurveEditor'
import { ConfirmDialog } from './ConfirmDialog'
import { ScheduleToggle } from './ScheduleToggle'
import { SchedulerConfirmation } from './SchedulerConfirmation'
import { AlarmSection } from './AlarmSection'
import { AddRow } from './EditorRows'
import { formatDays } from './scheduleFormat'
import { ListSection, PageHeader, SegmentedControl } from '@/src/ui/ios'

/**
 * Schedule tab: large title, side switcher, master schedule switch, then
 * inset grouped lists of curves (groups of days sharing a temperature
 * schedule) and alarms. Tapping a curve opens `CurveEditor` in a sheet, which
 * also hosts Delete.
 */
export function SchedulePage() {
  const { primarySide: side, selectedSide, selectSide } = useSide()
  const {
    confirmMessage,
    isPowerEnabled,
    isApplying,
    isMutating,
    toggleAllSchedules,
    deleteCurve,
    setSelectedDays,
    isLoading: hookLoading,
  } = useSchedule()

  const { nextEvent } = useScheduleActive()
  const { leftName, rightName } = useSideNames()
  const { data, isLoading, error } = trpc.schedules.getAll.useQuery({ side })

  const [editingCurve, setEditingCurve] = useState<{ days: DayOfWeek[], setPoints: Array<{ time: string, temperature: number }> } | null>(null)
  const [creatingCurve, setCreatingCurve] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ days: DayOfWeek[], label: string } | null>(null)

  // Recompute each render — React Compiler's lint (react-hooks/
  // preserve-manual-memoization) objects to the previous useMemo here
  // because it can't match the manual memo to its own plan. The
  // computation is cheap relative to the tRPC fetch that precedes it.
  const groups: ScheduleGroup[] = data?.temperature
    ? groupDaysBySharedCurve(data.temperature)
    : []

  // Curves to render: ones with set points OR explicitly paused
  const visibleGroups = groups.filter(g => g.setPoints.length > 0 || g.allDisabled)

  const hasAnyCurves = visibleGroups.length > 0

  // The "active" curve = the one whose days include today; gets the
  // next-event annotation since that's what's actually running.
  const activeCurveKey = useMemo(() => {
    if (!isPowerEnabled) return null
    const today = getCurrentDay()
    return visibleGroups.find(g => g.days.includes(today) && g.setPoints.length > 0)?.key ?? null
  }, [visibleGroups, isPowerEnabled])

  const handleEdit = useCallback((group: ScheduleGroup) => {
    setEditingCurve({ days: group.days, setPoints: group.setPoints })
    setSelectedDays(new Set(group.days))
  }, [setSelectedDays])

  const handleCreate = useCallback(() => {
    setCreatingCurve(true)
  }, [])

  const handleDelete = useCallback((days: DayOfWeek[]) => {
    const labelDays = days.length === 7 ? 'every day' : formatDays(days)
    setPendingDelete({ days, label: labelDays })
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return
    try {
      await deleteCurve(pendingDelete.days)
      // The curve is gone — close its editor too.
      setEditingCurve(null)
      setCreatingCurve(false)
    }
    finally {
      setPendingDelete(null)
    }
  }, [pendingDelete, deleteCurve])

  const closeEditor = useCallback(() => {
    setEditingCurve(null)
    setCreatingCurve(false)
  }, [])

  const sideOptions: Array<{ value: SideSelection, label: string }> = [
    { value: 'left', label: leftName },
    { value: 'right', label: rightName },
    { value: 'both', label: 'Both' },
  ]

  return (
    <div className="space-y-6 pb-4">
      <PageHeader title="Schedule" />

      {/* Side selector — left / right / both (writes apply to selection) */}
      <SegmentedControl
        aria-label="Side"
        options={sideOptions}
        value={selectedSide}
        onChange={selectSide}
      />

      <ScheduleToggle
        enabled={isPowerEnabled}
        onToggle={() => void toggleAllSchedules()}
        isLoading={isMutating || hookLoading}
      />

      {/* Confirmation toast */}
      <SchedulerConfirmation
        message={confirmMessage}
        isLoading={isApplying}
        variant={confirmMessage?.includes('Failed') ? 'error' : 'success'}
      />

      {error && (
        <p className="px-4 text-[15px] text-red-400">
          Couldn&apos;t load schedules:
          {' '}
          {error.message}
        </p>
      )}

      {isLoading && !data && (
        <div className="h-[132px] animate-pulse rounded-xl bg-zinc-900" />
      )}

      {/* Empty state */}
      {!isLoading && !hasAnyCurves && (
        <div className="pb-2 pt-6 text-center">
          <p className="text-[20px] font-semibold leading-[25px] text-white">No Sleep Curves</p>
          <p className="mx-auto mt-1.5 max-w-[320px] px-4 text-[15px] leading-5 text-zinc-500">
            Curves cool and warm the bed through the night, and switch the Pod on and off for you.
          </p>
          <button
            type="button"
            onClick={handleCreate}
            className="mt-5 h-[50px] w-full rounded-xl bg-sky-500 text-[17px] font-semibold text-white active:bg-sky-600"
          >
            Create Sleep Curve
          </button>
        </div>
      )}

      {/* Curves list */}
      {hasAnyCurves && (
        <ListSection header="Curves">
          {visibleGroups.map(group => (
            <CurveCard
              key={group.key}
              group={group}
              onEdit={() => handleEdit(group)}
              isActive={group.key === activeCurveKey}
              nextEvent={group.key === activeCurveKey ? nextEvent : null}
            />
          ))}
          <AddRow onClick={handleCreate}>New Curve</AddRow>
        </ListSection>
      )}

      {/* Alarms — wake the user with a cover vibration at a scheduled time */}
      <AlarmSection side={side} />

      {/* Edit / Create editor */}
      <CurveEditor
        open={editingCurve !== null || creatingCurve}
        onClose={closeEditor}
        initialDays={editingCurve?.days ?? []}
        initialSetPoints={editingCurve?.setPoints ?? []}
        onDelete={editingCurve ? () => handleDelete(editingCurve.days) : undefined}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete Curve?"
        message={`This removes the schedule for ${pendingDelete?.label ?? ''}. The Pod won't change temperature on those days until you create a new curve.`}
        confirmLabel="Delete"
        variant="danger"
        busy={isMutating}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
