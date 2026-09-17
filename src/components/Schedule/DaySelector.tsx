'use client'

import { cn } from '@/lib/utils'
import { DAYS_OF_WEEK, getCurrentDay, type DayOfWeek } from '@/src/lib/scheduleTime'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export const DAYS = DAYS_OF_WEEK.map((key, index) => ({
  key,
  short: DAY_LABELS[index][0],
  label: DAY_LABELS[index],
})) as Array<{ key: DayOfWeek, short: string, label: string }>

export { getCurrentDay, type DayOfWeek }

/** Predefined day groups for "Apply to" shortcuts */
export const DAY_GROUPS = {
  weekdays: new Set<DayOfWeek>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
  weekends: new Set<DayOfWeek>(['saturday', 'sunday']),
  allDays: new Set<DayOfWeek>(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']),
}

/**
 * DaySelector supports two modes:
 *
 * 1. **Single-select** (activeDay + onActiveDayChange only):
 *    Simple day picker — tapping switches the active day.
 *
 * 2. **Multi-select** (selectedDays + onSelectedDaysChange):
 *    Multi-day picker for bulk operations. Primary day is highlighted,
 *    additional selected days shown with reduced opacity.
 *    - Tap unselected day → add to selection & make primary
 *    - Tap selected day (not last) → remove from selection
 *    - Tap sole selected day → no-op (always keep at least 1)
 */
interface DaySelectorProps {
  /** Primary active day for viewing */
  activeDay: DayOfWeek
  /** Called when active day changes */
  onActiveDayChange: (day: DayOfWeek) => void
  /** Set of all selected days (enables multi-select mode when provided) */
  selectedDays?: Set<DayOfWeek>
  /** Called when the selected days set changes (multi-select mode) */
  onSelectedDaysChange?: (days: Set<DayOfWeek>) => void
}

export function DaySelector({
  activeDay,
  onActiveDayChange,
  selectedDays,
  onSelectedDaysChange,
}: DaySelectorProps) {
  const isMultiSelect = !!selectedDays && !!onSelectedDaysChange

  const handleTap = (day: DayOfWeek) => {
    if (!isMultiSelect) {
      // Single-select mode: just switch active day
      onActiveDayChange(day)
      return
    }

    // Multi-select mode
    const isSelected = selectedDays.has(day)

    if (isSelected && selectedDays.size > 1) {
      // Deselect day (keep at least one)
      const next = new Set(selectedDays)
      next.delete(day)
      onSelectedDaysChange(next)
      // If we removed the primary day, switch to first remaining
      if (day === activeDay) {
        const first = DAYS.find(d => next.has(d.key))
        if (first) onActiveDayChange(first.key)
      }
    }
    else if (!isSelected) {
      // Add to selection and make primary
      const next = new Set(selectedDays)
      next.add(day)
      onSelectedDaysChange(next)
      onActiveDayChange(day)
    }
    else {
      // Sole selected day — just ensure it's primary
      onActiveDayChange(day)
    }
  }

  return (
    <div className="flex items-center justify-between gap-1">
      {DAYS.map(({ key, short, label }) => {
        const isPrimary = key === activeDay
        const isSelected = selectedDays?.has(key) ?? isPrimary

        return (
          <DayCircle key={key} short={short} label={label} selected={isSelected} onClick={() => handleTap(key)} />
        )
      })}
    </div>
  )
}

function DayCircle({ short, label, selected, onClick }: { short: string, label: string, selected: boolean, onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold transition-colors duration-150',
        selected
          ? 'bg-sky-500 text-white'
          : 'bg-zinc-800 text-zinc-300 active:bg-zinc-700',
      )}
    >
      {short}
    </button>
  )
}

interface DayPickerProps {
  value: ReadonlySet<DayOfWeek>
  onToggle: (day: DayOfWeek) => void
}

/** Seven round day toggles (S M T W T F S) for a grouped-list row. */
export function DayPicker({ value, onToggle }: DayPickerProps) {
  return (
    <div className="flex items-center justify-between gap-1 px-4 py-3">
      {DAYS.map(({ key, short, label }) => (
        <DayCircle key={key} short={short} label={label} selected={value.has(key)} onClick={() => onToggle(key)} />
      ))}
    </div>
  )
}
