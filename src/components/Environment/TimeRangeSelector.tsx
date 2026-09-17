'use client'

import { SegmentedControl } from '@/src/ui/ios'

export type TimeRange = '1h' | '6h' | '12h' | '24h'

const ranges: { value: TimeRange, label: string }[] = [
  { value: '1h', label: '1h' },
  { value: '6h', label: '6h' },
  { value: '12h', label: '12h' },
  { value: '24h', label: '24h' },
]

export function getDateRangeFromTimeRange(range: TimeRange): { startDate: Date, endDate: Date } {
  const now = new Date()
  const hours = parseInt(range)
  const startDate = new Date(now.getTime() - hours * 60 * 60 * 1000)
  return { startDate, endDate: now }
}

interface TimeRangeSelectorProps {
  value: TimeRange
  onChange: (range: TimeRange) => void
  className?: string
}

export function TimeRangeSelector({ value, onChange, className }: TimeRangeSelectorProps) {
  return (
    <SegmentedControl
      aria-label="Time range"
      options={ranges}
      value={value}
      onChange={onChange}
      className={className}
    />
  )
}
