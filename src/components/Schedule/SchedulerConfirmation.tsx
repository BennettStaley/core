'use client'

import { cn } from '@/lib/utils'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface SchedulerConfirmationProps {
  message: string | null
  isLoading?: boolean
  variant?: 'success' | 'error' | 'info'
}

/**
 * Capsule toast at the top of the viewport (like the iOS AirPods / silent-mode
 * HUD). Slides in when a message is present, auto-dismisses via parent timer.
 */
export function SchedulerConfirmation({
  message,
  isLoading = false,
  variant = 'success',
}: SchedulerConfirmationProps) {
  const visible = !!message || isLoading

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center transition-transform duration-300',
        visible ? 'translate-y-0' : '-translate-y-[150%]',
      )}
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.75rem)' }}
    >
      <div
        className="mx-4 flex max-w-full items-center gap-2 rounded-full bg-zinc-800/95 px-4 py-2.5 text-[15px] text-white backdrop-blur-xl"
        role="status"
        aria-live="polite"
      >
        {isLoading
          ? <Loader2 size={17} className="shrink-0 animate-spin text-zinc-400" />
          : variant === 'error'
            ? <AlertCircle size={17} className="shrink-0 text-red-400" />
            : <CheckCircle size={17} className={cn('shrink-0', variant === 'info' ? 'text-sky-400' : 'text-emerald-400')} />}
        <span className="truncate">{isLoading ? 'Saving…' : message}</span>
      </div>
    </div>
  )
}
