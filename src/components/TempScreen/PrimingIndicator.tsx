'use client'

import { Droplets } from 'lucide-react'

/**
 * Priming status row — shown while the pod water system is priming.
 */
export const PrimingIndicator = () => (
  <div role="status" className="flex min-h-[44px] items-center gap-3 rounded-xl bg-zinc-900 px-4 py-2.5">
    <Droplets size={20} className="shrink-0 animate-pulse text-sky-400" />
    <p className="flex-1 text-[15px] leading-5 text-white">Priming water system</p>
  </div>
)
