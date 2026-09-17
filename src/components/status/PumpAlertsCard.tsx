'use client'

import { useCallback } from 'react'
import { trpc } from '@/src/utils/trpc'
import { AlertTriangle, X } from 'lucide-react'

function formatAge(timestamp: Date): string {
  const ageMs = Date.now() - new Date(timestamp).getTime()
  const minutes = Math.round(ageMs / 60_000)
  if (minutes < 60) return `${Math.max(minutes, 0)}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/**
 * PumpAlertsCard — active (unacknowledged, undismissed) pump alerts with
 * per-row dismiss. These rows are exactly the set the stall guard would
 * resurrect as a block at the next service start, so pruning them here is
 * the escape hatch when a backlog accumulates. Renders nothing when the
 * active list is empty.
 *
 * Wires into:
 * - pumpAlerts.list → active alerts
 * - pumpAlerts.dismissAlert → per-row dismiss (also releases the live
 *   block server-side when the row is the current incident)
 */
export function PumpAlertsCard() {
  const utils = trpc.useUtils()

  // Schema-max limit so one dismiss-all pass drains even a large backlog
  // instead of paging through the 50-row default.
  const { data: alerts } = trpc.pumpAlerts.list.useQuery(
    { limit: 500 },
    { refetchInterval: 30_000 },
  )

  const dismissAlertMutation = trpc.pumpAlerts.dismissAlert.useMutation({
    // NOT_FOUND means another client (or a restart race) already dismissed
    // the row — the list refetch below resolves it either way.
    onSettled: () => utils.pumpAlerts.list.invalidate(),
  })

  const handleDismissAlert = useCallback((id: number) => {
    dismissAlertMutation.mutate({ id })
  }, [dismissAlertMutation])

  const handleDismissAll = useCallback(async () => {
    for (const alert of alerts ?? []) {
      try {
        await dismissAlertMutation.mutateAsync({ id: alert.id })
      }
      catch {
        // Already dismissed elsewhere, or refused because the side is
        // still confirming its power-off — keep draining the rest; the
        // refetch surfaces whatever remains.
      }
    }
  }, [alerts, dismissAlertMutation])

  const activeAlerts = alerts ?? []
  if (activeAlerts.length === 0) return null

  return (
    <section className="space-y-1.5">
      <div className="flex items-baseline justify-between px-4">
        <h2 className="text-[13px] leading-[18px] text-zinc-500">Pump alerts</h2>
        {activeAlerts.length > 1 && (
          <button
            type="button"
            onClick={handleDismissAll}
            disabled={dismissAlertMutation.isPending}
            className="text-[15px] text-sky-400 active:opacity-50 disabled:opacity-40"
          >
            Dismiss all
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl bg-zinc-900 [&>*+*]:border-t [&>*+*]:border-zinc-800">
        {activeAlerts.map(alert => (
          <div key={alert.id} className="flex min-h-[44px] items-center gap-3 pl-4 pr-1">
            <AlertTriangle size={18} className="shrink-0 text-red-400" />
            <span className="ios-numeric min-w-0 flex-1 py-2.5 text-[15px] text-white">
              {alert.side === 'left' ? 'Left' : alert.side === 'right' ? 'Right' : 'Both'}
              {' — '}
              {alert.rpm != null ? `${alert.rpm} rpm` : alert.type}
              {' — '}
              {formatAge(alert.timestamp)}
            </span>
            <button
              type="button"
              onClick={() => handleDismissAlert(alert.id)}
              disabled={dismissAlertMutation.isPending}
              aria-label={`Dismiss pump alert ${alert.id}`}
              className="grid h-11 w-11 shrink-0 place-items-center text-zinc-500 active:opacity-50"
            >
              <X size={18} />
            </button>
          </div>
        ))}
      </div>

      <p className="px-4 text-[13px] leading-[18px] text-zinc-500">
        Unresolved alerts re-block their side at the next service restart. Dismiss alerts that no longer reflect the pump&apos;s state.
      </p>
    </section>
  )
}
