'use client'

import { useCallback, useMemo, useState } from 'react'
import { trpc } from '@/src/utils/trpc'
import { ListSection } from '@/src/ui/ios'
import type { DayOfWeek } from './DaySelector'
import { AlarmCard, type AlarmGroup } from './AlarmCard'
import { AlarmEditor } from './AlarmEditor'
import { AddRow } from './EditorRows'

type Side = 'left' | 'right'
type Pattern = 'rise' | 'double'

interface AlarmRow {
  id: number
  side: Side
  dayOfWeek: DayOfWeek
  time: string
  vibrationIntensity: number
  vibrationPattern: Pattern
  duration: number
  alarmTemperature: number
  enabled: boolean
}

const DAY_ORDER: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/**
 * Group alarm_schedules rows that share every field except day-of-week.
 * Rows are bucketed by a deterministic signature so "wake at 7am Mon–Fri" renders
 * as one row backed by five row ids.
 */
function groupAlarms(rows: AlarmRow[]): AlarmGroup[] {
  const buckets = new Map<string, AlarmGroup>()
  for (const r of rows) {
    const key = [
      r.time,
      r.vibrationIntensity,
      r.vibrationPattern,
      r.duration,
      r.alarmTemperature,
      r.enabled ? 1 : 0,
    ].join('|')
    const existing = buckets.get(key)
    if (existing) {
      existing.ids.push(r.id)
      existing.days.push(r.dayOfWeek)
    }
    else {
      buckets.set(key, {
        ids: [r.id],
        days: [r.dayOfWeek],
        time: r.time,
        vibrationIntensity: r.vibrationIntensity,
        vibrationPattern: r.vibrationPattern,
        duration: r.duration,
        alarmTemperature: r.alarmTemperature,
        enabled: r.enabled,
      })
    }
  }
  const groups = Array.from(buckets.values())
  for (const g of groups) {
    g.days.sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
  }
  groups.sort((a, b) => a.time.localeCompare(b.time))
  return groups
}

interface AlarmSectionProps {
  side: Side
}

/**
 * Alarms group on the schedule page, below the curves. Reads
 * `schedules.getAll.alarm`, groups identical rows across days into single
 * rows, toggles enabled in place and routes create/edit/test/delete through
 * `AlarmEditor`.
 */
export function AlarmSection({ side }: AlarmSectionProps) {
  const { data, isLoading } = trpc.schedules.getAll.useQuery({ side })
  const utils = trpc.useUtils()

  const [editing, setEditing] = useState<AlarmGroup | null>(null)
  const [creating, setCreating] = useState(false)
  const [togglingKey, setTogglingKey] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const batchUpdate = trpc.schedules.batchUpdate.useMutation()

  const groups = useMemo<AlarmGroup[]>(() => {
    const alarms = (data?.alarm ?? []) as AlarmRow[]
    return groupAlarms(alarms)
  }, [data?.alarm])

  const handleCreate = useCallback(() => {
    setEditing(null)
    setCreating(true)
  }, [])

  const handleEdit = useCallback((group: AlarmGroup) => {
    setEditing(group)
    setCreating(false)
  }, [])

  const handleCloseEditor = useCallback(() => {
    setEditing(null)
    setCreating(false)
  }, [])

  const handleToggle = useCallback(async (group: AlarmGroup, enabled: boolean) => {
    const key = group.ids.join(',')
    setTogglingKey(key)
    setToggleError(null)
    try {
      await batchUpdate.mutateAsync({
        updates: { alarm: group.ids.map(id => ({ id, enabled })) },
      })
      await utils.schedules.getAll.invalidate()
      void utils.schedules.getByDay.invalidate()
    }
    catch (err) {
      setToggleError(err instanceof Error ? err.message : 'Failed to update alarm')
    }
    finally {
      setTogglingKey(null)
    }
  }, [batchUpdate, utils])

  const footer = toggleError
    ? <span className="text-red-400">{`Couldn't update alarm: ${toggleError}`}</span>
    : groups.length === 0 && !isLoading
      ? 'The cover vibrates to wake you at the time you set.'
      : undefined

  return (
    <>
      <ListSection header="Alarms" footer={footer}>
        {isLoading && !data && <div className="h-[88px] animate-pulse" />}
        {groups.map((group) => {
          const key = group.ids.join(',')
          return (
            <AlarmCard
              key={key}
              group={group}
              onEdit={() => handleEdit(group)}
              onToggle={enabled => void handleToggle(group, enabled)}
              isToggling={togglingKey === key}
            />
          )
        })}
        <AddRow onClick={handleCreate}>Add Alarm</AddRow>
      </ListSection>

      <AlarmEditor
        open={creating || editing !== null}
        onClose={handleCloseEditor}
        side={side}
        existingGroup={editing}
      />
    </>
  )
}
