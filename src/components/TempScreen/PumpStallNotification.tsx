'use client'

import { AlertTriangle, X } from 'lucide-react'
import { trpc } from '@/src/utils/trpc'

interface PumpStallNotificationProps {
  side: 'left' | 'right'
  rpm: number
  /** unix seconds */
  trippedAt: number
  /** pump_alerts row id from the notice; 0 when the trip-time insert failed. */
  alertId?: number
  /** Called after either re-enable or dismiss settles so the parent can refetch. */
  onAction?: () => void
}

const formatTime = (unixSeconds: number): string => {
  const d = new Date(unixSeconds * 1000)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/**
 * Notification shown when the pump stall guard powered a side off.
 * Two actions:
 *   Re-enable — restores the pre-stall setpoint via the normal command
 *     path. If the pump is still bad, the guard re-trips on the next
 *     frame; the banner returns.
 *   Dismiss — clears the notification and re-arms stall protection; the
 *     side stays off until the user powers it back on, and any command
 *     path re-triggers the guard if the pump is still bad.
 */
export const PumpStallNotification = ({ side, rpm, trippedAt, alertId, onAction }: PumpStallNotificationProps) => {
  const acknowledge = trpc.pumpAlerts.acknowledgeAndRestore.useMutation()
  const dismiss = trpc.pumpAlerts.dismissNotification.useMutation()
  // Correlate the mutation with the incident shown here — the server then
  // stamps exactly this row even across a restart. 0 means "no row".
  const alertRef = alertId || undefined

  // While either mutation is in flight, both actions stay disabled — the
  // two paths race for the same guard state and alert row.
  const busy = acknowledge.isPending || dismiss.isPending

  return (
    <div role="alert" className="rounded-xl bg-zinc-900">
      <div className="flex items-start gap-3 py-3 pl-4 pr-1">
        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-500" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-5 text-white">
            {side === 'left' ? 'Left' : 'Right'}
            {' '}
            side powered off — pump stall detected
          </p>
          <p className="mt-0.5 text-[15px] leading-5 text-zinc-500">
            Pump RPM dropped to
            {' '}
            {rpm}
            {' '}
            at
            {' '}
            {formatTime(trippedAt)}
            . The side is off for safety. Re-enable to retry.
          </p>
        </div>
        <button
          onClick={() => dismiss.mutate({ side, alertId: alertRef }, { onSettled: onAction })}
          disabled={busy}
          aria-label="Dismiss pump stall notification"
          className="-mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-500 active:opacity-50 disabled:opacity-40"
        >
          <X size={18} />
        </button>
      </div>
      <div className="border-t border-zinc-800">
        <button
          onClick={() => acknowledge.mutate({ side, alertId: alertRef }, { onSettled: onAction })}
          disabled={busy}
          className="flex min-h-[44px] w-full items-center px-4 text-[17px] text-sky-400 active:bg-zinc-800 disabled:opacity-40"
        >
          Re-enable
        </button>
      </div>
    </div>
  )
}
