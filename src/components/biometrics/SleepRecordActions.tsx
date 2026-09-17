'use client'

import { useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { trpc } from '@/src/utils/trpc'
import { ListRow, ListSection, Sheet } from '@/src/ui/ios'

interface SleepRecordActionsProps {
  recordId: number
  enteredBedAt: Date
  leftBedAt: Date
  onActionComplete?: () => void
}

function formatDateTimeLocal(date: Date): string {
  const d = new Date(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * "Edit" bar button that opens a sheet for adjusting or deleting a sleep record.
 *
 * Wires into:
 * - biometrics.updateSleepRecord → edit bed/wake times
 * - biometrics.deleteSleepRecord → remove record
 */
export function SleepRecordActions({
  recordId,
  enteredBedAt,
  leftBedAt,
  onActionComplete,
}: SleepRecordActionsProps) {
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editBedTime, setEditBedTime] = useState(formatDateTimeLocal(enteredBedAt))
  const [editWakeTime, setEditWakeTime] = useState(formatDateTimeLocal(leftBedAt))

  const utils = trpc.useUtils()

  const close = useCallback(() => {
    setOpen(false)
    setConfirmDelete(false)
  }, [])

  const onSuccess = () => {
    utils.biometrics.getSleepRecords.invalidate()
    utils.biometrics.getLatestSleep.invalidate()
    close()
    onActionComplete?.()
  }

  const updateMutation = trpc.biometrics.updateSleepRecord.useMutation({ onSuccess })
  const deleteMutation = trpc.biometrics.deleteSleepRecord.useMutation({ onSuccess })

  const openEditor = useCallback(() => {
    setEditBedTime(formatDateTimeLocal(enteredBedAt))
    setEditWakeTime(formatDateTimeLocal(leftBedAt))
    setOpen(true)
  }, [enteredBedAt, leftBedAt])

  const handleSave = useCallback(() => {
    updateMutation.mutate({
      id: recordId,
      enteredBedAt: new Date(editBedTime),
      leftBedAt: new Date(editWakeTime),
    })
  }, [recordId, editBedTime, editWakeTime, updateMutation])

  const handleDelete = useCallback(() => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    deleteMutation.mutate({ id: recordId })
  }, [confirmDelete, recordId, deleteMutation])

  const isPending = updateMutation.isPending || deleteMutation.isPending
  const error = updateMutation.error?.message ?? deleteMutation.error?.message

  return (
    <>
      <button
        type="button"
        onClick={openEditor}
        className="-mr-2 min-h-[44px] shrink-0 px-2 text-[17px] text-sky-400 active:opacity-50"
      >
        Edit
      </button>

      <Sheet
        open={open}
        onClose={close}
        title="Edit sleep"
        trailing={(
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-1.5 text-[17px] font-semibold text-sky-400 active:opacity-50 disabled:opacity-40"
          >
            {updateMutation.isPending && <Loader2 size={16} className="animate-spin" />}
            Save
          </button>
        )}
      >
        <div className="space-y-6">
          <ListSection footer={error}>
            <ListRow
              title="Bedtime"
              accessory={(
                <input
                  type="datetime-local"
                  aria-label="Bedtime"
                  value={editBedTime}
                  onChange={e => setEditBedTime(e.target.value)}
                  className="ios-numeric min-h-[34px] rounded-lg bg-zinc-800 px-2 text-[15px] text-white outline-none focus:ring-2 focus:ring-sky-500"
                />
              )}
            />
            <ListRow
              title="Wake"
              accessory={(
                <input
                  type="datetime-local"
                  aria-label="Wake"
                  value={editWakeTime}
                  onChange={e => setEditWakeTime(e.target.value)}
                  className="ios-numeric min-h-[34px] rounded-lg bg-zinc-800 px-2 text-[15px] text-white outline-none focus:ring-2 focus:ring-sky-500"
                />
              )}
            />
          </ListSection>

          <ListSection footer={confirmDelete ? 'Tap again to permanently delete this night.' : undefined}>
            <ListRow
              title={confirmDelete ? 'Confirm delete' : 'Delete sleep record'}
              destructive
              onClick={handleDelete}
              disabled={isPending}
              accessory={deleteMutation.isPending ? <Loader2 size={16} className="animate-spin text-zinc-500" /> : undefined}
            />
          </ListSection>
        </div>
      </Sheet>
    </>
  )
}
