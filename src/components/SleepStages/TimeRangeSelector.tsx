'use client'

import { SegmentedControl } from '@/src/ui/ios'

export type TimeRange = 'night' | 'week' | 'month'

interface TimeRangeSelectorProps {
  value: TimeRange
  onChange: (range: TimeRange) => void
}

const ranges: ReadonlyArray<{ value: TimeRange, label: string }> = [
  { value: 'night', label: 'Night' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

/** Night / Week / Month segmented control. */
export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return <SegmentedControl options={ranges} value={value} onChange={onChange} aria-label="Time range" className="w-[220px]" />
}
