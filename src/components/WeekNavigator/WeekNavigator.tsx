'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface WeekNavigatorProps {
  label: string
  isCurrentWeek: boolean
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
}

/**
 * iOS-style date range stepper: plain chevron buttons flanking the range label.
 * Tapping the label jumps back to the current week.
 */
export function WeekNavigator({
  label,
  isCurrentWeek,
  onPrevious,
  onNext,
  onToday,
}: WeekNavigatorProps) {
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={onPrevious}
        className="-ml-2 flex h-11 w-11 items-center justify-center text-sky-400 active:opacity-50"
        aria-label="Previous week"
      >
        <ChevronLeft size={24} strokeWidth={2.25} />
      </button>

      <button
        type="button"
        onClick={onToday}
        disabled={isCurrentWeek}
        className="flex min-h-[44px] flex-col items-center justify-center px-3 active:opacity-50 disabled:active:opacity-100"
        aria-label="Go to current week"
      >
        <span className="ios-numeric text-[17px] font-semibold text-white">{label}</span>
        {!isCurrentWeek && <span className="text-[13px] leading-4 text-sky-400">This week</span>}
      </button>

      <button
        type="button"
        onClick={onNext}
        disabled={isCurrentWeek}
        className="-mr-2 flex h-11 w-11 items-center justify-center text-sky-400 active:opacity-50 disabled:text-zinc-700"
        aria-label="Next week"
      >
        <ChevronRight size={24} strokeWidth={2.25} />
      </button>
    </div>
  )
}
