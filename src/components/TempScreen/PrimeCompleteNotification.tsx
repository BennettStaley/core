'use client'

import { CheckCircle, X } from 'lucide-react'
import { trpc } from '@/src/utils/trpc'

interface PrimeCompleteNotificationProps {
  /** Called after dismissal to refresh status */
  onDismiss?: () => void
}

/**
 * Notification shown when pod priming has completed.
 * Dismissible via device.dismissPrimeNotification mutation.
 */
export const PrimeCompleteNotification = ({ onDismiss }: PrimeCompleteNotificationProps) => {
  const dismissMutation = trpc.device.dismissPrimeNotification.useMutation()

  const handleDismiss = () => {
    dismissMutation.mutate(
      {},
      { onSettled: onDismiss },
    )
  }

  return (
    <div className="flex min-h-[44px] items-center gap-3 rounded-xl bg-zinc-900 py-1.5 pl-4 pr-1">
      <CheckCircle size={20} className="shrink-0 text-emerald-500" />
      <p className="flex-1 text-[15px] leading-5 text-white">
        Priming complete — your pod is ready
      </p>
      <button
        onClick={handleDismiss}
        disabled={dismissMutation.isPending}
        aria-label="Dismiss priming complete notification"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-500 active:opacity-50 disabled:opacity-40"
      >
        <X size={18} />
      </button>
    </div>
  )
}
