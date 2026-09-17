'use client'

import { useState, useCallback } from 'react'
import { trpc } from '@/src/utils/trpc'
import { useSideNames } from '@/src/hooks/useSideNames'
import { ChevronRight } from 'lucide-react'
import { ListRow, ListSection, SegmentedControl, Sheet } from '@/src/ui/ios'
import { ActionRow, ControlRow, Stepper } from './SettingsRows'

type TapType = 'doubleTap' | 'tripleTap' | 'quadTap'
type ActionType = 'temperature' | 'alarm'
type Side = 'left' | 'right'

interface GestureRecord {
  id: number
  side: Side
  tapType: TapType
  actionType: ActionType
  temperatureChange: 'increment' | 'decrement' | null
  temperatureAmount: number | null
  alarmBehavior: 'snooze' | 'dismiss' | null
  alarmSnoozeDuration: number | null
  alarmInactiveBehavior: 'power' | 'none' | null
}

const TAP_TYPES: { key: TapType, label: string, taps: number }[] = [
  { key: 'doubleTap', label: 'Double tap', taps: 2 },
  { key: 'tripleTap', label: 'Triple tap', taps: 3 },
  { key: 'quadTap', label: 'Quad tap', taps: 4 },
]

function gestureDescription(gesture: GestureRecord): string {
  if (gesture.actionType === 'temperature') {
    const dir = gesture.temperatureChange === 'increment' ? '+' : '-'
    return `${dir}${gesture.temperatureAmount}°`
  }
  return gesture.alarmBehavior === 'snooze' ? 'Snooze alarm' : 'Dismiss alarm'
}

interface EditState {
  side: Side
  tapType: TapType
  actionType: ActionType
  temperatureChange: 'increment' | 'decrement'
  temperatureAmount: number
  alarmBehavior: 'snooze' | 'dismiss'
  alarmSnoozeDuration: number
  alarmInactiveBehavior: 'power' | 'none'
}

const defaultEditState = (side: Side, tapType: TapType): EditState => ({
  side,
  tapType,
  actionType: 'temperature',
  temperatureChange: 'increment',
  temperatureAmount: 2,
  alarmBehavior: 'snooze',
  alarmSnoozeDuration: 300,
  alarmInactiveBehavior: 'none',
})

function editStateFromGesture(g: GestureRecord): EditState {
  return {
    side: g.side,
    tapType: g.tapType,
    actionType: g.actionType,
    temperatureChange: g.temperatureChange ?? 'increment',
    temperatureAmount: g.temperatureAmount ?? 2,
    alarmBehavior: g.alarmBehavior ?? 'snooze',
    alarmSnoozeDuration: g.alarmSnoozeDuration ?? 300,
    alarmInactiveBehavior: g.alarmInactiveBehavior ?? 'none',
  }
}

/**
 * Tap Gesture Configuration component.
 * Allows configuring double/triple/quad tap actions per side.
 * Matches iOS TapGestureConfigView feature set with editable controls.
 */
export function TapGestureConfig({ filterSide }: { filterSide?: 'left' | 'right' } = {}) {
  const { sideName } = useSideNames()
  const utils = trpc.useUtils()
  const settingsQuery = trpc.settings.getAll.useQuery({})
  const setGesture = trpc.settings.setGesture.useMutation({
    onSuccess: () => {
      utils.settings.getAll.invalidate()
      setEditing(null)
    },
  })
  const deleteGesture = trpc.settings.deleteGesture.useMutation({
    onSuccess: () => {
      utils.settings.getAll.invalidate()
    },
  })

  const [editing, setEditing] = useState<EditState | null>(null)

  const gestures = settingsQuery.data?.gestures as
    | { left: GestureRecord[], right: GestureRecord[] }
    | undefined

  const findGesture = useCallback(
    (side: Side, tapType: TapType): GestureRecord | undefined => {
      return gestures?.[side]?.find((g: GestureRecord) => g.tapType === tapType)
    },
    [gestures]
  )

  const handleSave = useCallback(() => {
    if (!editing) return

    if (editing.actionType === 'temperature') {
      setGesture.mutate({
        side: editing.side,
        tapType: editing.tapType,
        actionType: 'temperature',
        temperatureChange: editing.temperatureChange,
        temperatureAmount: editing.temperatureAmount,
      })
    }
    else {
      setGesture.mutate({
        side: editing.side,
        tapType: editing.tapType,
        actionType: 'alarm',
        alarmBehavior: editing.alarmBehavior,
        alarmSnoozeDuration:
          editing.alarmBehavior === 'snooze' ? editing.alarmSnoozeDuration : undefined,
        alarmInactiveBehavior: editing.alarmInactiveBehavior,
      })
    }
  }, [editing, setGesture])

  const handleDelete = useCallback(
    (side: Side, tapType: TapType) => {
      deleteGesture.mutate({ side, tapType })
    },
    [deleteGesture]
  )

  const handleDeleteEditing = useCallback(() => {
    if (!editing) return
    handleDelete(editing.side, editing.tapType)
    setEditing(null)
  }, [editing, handleDelete])

  const renderSideSection = (side: Side) => (
    <ListSection key={side} header={sideName(side)}>
      {TAP_TYPES.map(({ key, label }) => {
        const gesture = findGesture(side, key)
        return (
          <ListRow
            key={`${side}-${key}`}
            title={label}
            value={gesture ? gestureDescription(gesture) : 'Off'}
            onClick={() => setEditing(gesture ? editStateFromGesture(gesture) : defaultEditState(side, key))}
            accessory={<ChevronRight size={18} className="shrink-0 text-zinc-600" />}
          />
        )
      })}
    </ListSection>
  )

  if (settingsQuery.isLoading) {
    return <div className="h-[132px] animate-pulse rounded-xl bg-zinc-900" />
  }

  const editingLabel = editing ? TAP_TYPES.find(t => t.key === editing.tapType)?.label : undefined
  const editingExists = editing ? Boolean(findGesture(editing.side, editing.tapType)) : false

  return (
    <>
      <p className="px-4 text-[15px] leading-5 text-zinc-500">
        Tap the pod cover to change temperature or control an alarm.
      </p>

      {(!filterSide || filterSide === 'left') && renderSideSection('left')}
      {(!filterSide || filterSide === 'right') && renderSideSection('right')}

      {deleteGesture.error && (
        <p className="px-4 text-[13px] text-red-400">{deleteGesture.error.message}</p>
      )}

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editingLabel}
        trailing={(
          <button
            type="button"
            onClick={handleSave}
            disabled={setGesture.isPending}
            className="text-[17px] font-semibold text-sky-400 active:opacity-50 disabled:opacity-40"
          >
            {setGesture.isPending ? 'Saving…' : 'Save'}
          </button>
        )}
      >
        {editing && (
          <GestureEditPanel
            state={editing}
            sideLabel={sideName(editing.side)}
            onChange={setEditing}
            onDelete={editingExists ? handleDeleteEditing : undefined}
            isDeleting={deleteGesture.isPending}
            error={setGesture.error?.message}
          />
        )}
      </Sheet>
    </>
  )
}

/**
 * Sheet body for configuring a tap gesture action.
 */
function GestureEditPanel({
  state,
  sideLabel,
  onChange,
  onDelete,
  isDeleting,
  error,
}: {
  state: EditState
  sideLabel: string
  onChange: (s: EditState) => void
  onDelete?: () => void
  isDeleting: boolean
  error?: string
}) {
  return (
    <div className="space-y-6">
      <SegmentedControl
        aria-label="Action"
        options={[
          { value: 'temperature', label: 'Temperature' },
          { value: 'alarm', label: 'Alarm' },
        ]}
        value={state.actionType}
        onChange={actionType => onChange({ ...state, actionType })}
      />

      {state.actionType === 'temperature' && (
        <ListSection footer={`Applies to the ${sideLabel} side.`}>
          <ControlRow title="Direction">
            <SegmentedControl
              aria-label="Direction"
              className="w-[140px] shrink-0"
              options={[
                { value: 'increment', label: 'Warmer' },
                { value: 'decrement', label: 'Cooler' },
              ]}
              value={state.temperatureChange}
              onChange={temperatureChange => onChange({ ...state, temperatureChange })}
            />
          </ControlRow>
          <ControlRow title="Amount">
            <span className="ios-numeric text-[17px] text-zinc-500">
              {state.temperatureAmount}
              °
            </span>
            <Stepper
              label="amount"
              canDecrement={state.temperatureAmount > 1}
              canIncrement={state.temperatureAmount < 10}
              onDecrement={() => onChange({ ...state, temperatureAmount: Math.max(1, state.temperatureAmount - 1) })}
              onIncrement={() => onChange({ ...state, temperatureAmount: Math.min(10, state.temperatureAmount + 1) })}
            />
          </ControlRow>
        </ListSection>
      )}

      {state.actionType === 'alarm' && (
        <ListSection footer={`Applies to the ${sideLabel} side. "When no alarm" controls what the gesture does while no alarm is ringing.`}>
          <ControlRow title="Behavior">
            <SegmentedControl
              aria-label="Behavior"
              className="w-[150px] shrink-0"
              options={[
                { value: 'snooze', label: 'Snooze' },
                { value: 'dismiss', label: 'Dismiss' },
              ]}
              value={state.alarmBehavior}
              onChange={alarmBehavior => onChange({ ...state, alarmBehavior })}
            />
          </ControlRow>
          {state.alarmBehavior === 'snooze' && (
            <ControlRow title="Snooze for">
              <span className="ios-numeric text-[17px] text-zinc-500">
                {Math.round(state.alarmSnoozeDuration / 60)}
                {' '}
                min
              </span>
              <Stepper
                label="snooze duration"
                canDecrement={state.alarmSnoozeDuration > 60}
                canIncrement={state.alarmSnoozeDuration < 600}
                onDecrement={() => onChange({ ...state, alarmSnoozeDuration: Math.max(60, state.alarmSnoozeDuration - 60) })}
                onIncrement={() => onChange({ ...state, alarmSnoozeDuration: Math.min(600, state.alarmSnoozeDuration + 60) })}
              />
            </ControlRow>
          )}
          <div className="space-y-2 px-4 py-2.5">
            <span className="block text-[17px] leading-[22px] text-white">When no alarm</span>
            <SegmentedControl
              aria-label="When no alarm"
              options={[
                { value: 'none', label: 'Nothing' },
                { value: 'power', label: 'Power off' },
              ]}
              value={state.alarmInactiveBehavior}
              onChange={alarmInactiveBehavior => onChange({ ...state, alarmInactiveBehavior })}
            />
          </div>
        </ListSection>
      )}

      {error && <p className="px-4 text-[13px] text-red-400">{error}</p>}

      {onDelete && (
        <ListSection>
          <ActionRow title="Remove gesture" destructive onClick={onDelete} disabled={isDeleting} />
        </ListSection>
      )}
    </div>
  )
}
