'use client'

import { useState, useMemo, useCallback } from 'react'
import { trpc } from '@/src/utils/trpc'
import { Hypnogram } from './Hypnogram'
import { StageDistributionBar } from './StageDistributionBar'
import { TimeRangeSelector, type TimeRange } from './TimeRangeSelector'
import { WeeklySleepChart } from './WeeklySleepChart'
import { ChartCard } from '@/src/components/biometrics/ChartCard'
import { WeekNavigator } from '@/src/components/WeekNavigator/WeekNavigator'
import { useWeekNavigator } from '@/src/hooks/useWeekNavigator'
import {
  type StageDistribution,
  classifySleepStages,
  calculateDistribution,
  calculateQualityScore,
  formatDurationHM,
} from '@/src/lib/sleep-stages'

/** YYYY-MM-DD in local time (toISOString would shift evening bedtimes to the next UTC day). */
function localDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

interface SleepStagesCardProps {
  side: 'left' | 'right'
  /** Initial time range view. Defaults to 'night'. */
  defaultTimeRange?: TimeRange
  /** When true, hide the night/week/month picker (locks to defaultTimeRange) */
  hideTimeRangeSelector?: boolean
  /** Appended to the title in dual-side layouts, e.g. "Left". */
  sideLabel?: string
}

/** Get the start of the week (Sunday) for a given date */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

/** Get start of month */
function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/** Format date range for display */
function formatDateRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`
}

/** Format single night date */
function formatNightDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Main sleep stages visualization card.
 *
 * Night view: Full hypnogram + quality score + distribution
 * Week view: 7-day stacked bar chart, tap to drill into single night
 * Month view: Sleep records list with duration + quality
 *
 * Wired to tRPC biometrics.getSleepStages and biometrics.getSleepRecords.
 */
export function SleepStagesCard({ side, defaultTimeRange = 'night', hideTimeRangeSelector = false, sideLabel }: SleepStagesCardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>(defaultTimeRange)
  const [weekOffset, setWeekOffset] = useState(0) // 0 = current week, -1 = last week, etc.
  const [monthOffset, setMonthOffset] = useState(0)
  const [selectedWeekNight, setSelectedWeekNight] = useState<string | null>(null)

  // When the card is locked (parent supplies the navigator), follow the
  // shared week from context so header arrows actually move the chart;
  // otherwise the card's own offset state drives navigation.
  const sharedWeek = useWeekNavigator()
  const useSharedWeek = hideTimeRangeSelector

  // Calculate date ranges
  const { startDate, endDate } = useMemo(() => {
    const now = new Date()

    if (timeRange === 'night') {
      // Night mode: let the backend find the latest sleep record
      return { startDate: undefined, endDate: undefined }
    }

    if (timeRange === 'week') {
      if (useSharedWeek) {
        return { startDate: sharedWeek.weekStart, endDate: sharedWeek.weekEnd }
      }
      const weekStart = getWeekStart(now)
      weekStart.setDate(weekStart.getDate() + weekOffset * 7)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)
      return { startDate: weekStart, endDate: weekEnd }
    }

    // Month
    const monthStart = getMonthStart(now)
    monthStart.setMonth(monthStart.getMonth() + monthOffset)
    const monthEnd = new Date(monthStart)
    monthEnd.setMonth(monthEnd.getMonth() + 1)
    return { startDate: monthStart, endDate: monthEnd }
  }, [timeRange, weekOffset, monthOffset, useSharedWeek, sharedWeek.weekStart, sharedWeek.weekEnd])

  // Night view: get sleep stages for the latest/selected night
  const nightStages = trpc.biometrics.getSleepStages.useQuery(
    { side },
    { enabled: timeRange === 'night' },
  )

  // Drill-in from weekly view: get stages for a specific night
  const drillInStages = trpc.biometrics.getSleepStages.useQuery(
    {
      side,
      // A "night" runs 6PM on the selected date to noon the next day, matching
      // the bedtime-date bucketing above (a midnight-to-midnight window split
      // two different nights into one hypnogram).
      startDate: selectedWeekNight ? new Date(selectedWeekNight + 'T18:00:00') : undefined,
      endDate: selectedWeekNight
        ? (() => {
            const d = new Date(selectedWeekNight + 'T12:00:00')
            d.setDate(d.getDate() + 1)
            return d
          })()
        : undefined,
    },
    { enabled: timeRange === 'week' && selectedWeekNight !== null },
  )

  // Week/Month view: get sleep records for the date range
  const sleepRecords = trpc.biometrics.getSleepRecords.useQuery(
    {
      side,
      startDate,
      endDate,
      limit: timeRange === 'month' ? 31 : 7,
    },
    { enabled: timeRange !== 'night' && !!startDate },
  )

  // Week/Month: also get vitals + movement for classification
  const vitalsQuery = trpc.biometrics.getVitals.useQuery(
    {
      side,
      startDate,
      endDate,
      limit: 10000,
    },
    { enabled: timeRange !== 'night' && !!startDate },
  )

  const movementQuery = trpc.biometrics.getMovement.useQuery(
    {
      side,
      startDate,
      endDate,
      limit: 1000,
    },
    { enabled: timeRange !== 'night' && !!startDate },
  )

  // Build weekly night summaries
  const weeklyNights = useMemo(() => {
    if (timeRange !== 'week' || !sleepRecords.data || !vitalsQuery.data || !startDate) return []

    const records = sleepRecords.data as Array<{
      id: number
      enteredBedAt: Date
      leftBedAt: Date
      sleepDurationSeconds: number
    }>

    const vitalsData = (vitalsQuery.data ?? []) as Array<{
      timestamp: Date
      heartRate: number | null
      hrv: number | null
      breathingRate: number | null
    }>

    const movData = (movementQuery.data ?? []) as Array<{
      timestamp: Date
      totalMovement: number
    }>

    // Group by night (using entered_bed_at date)
    const nightMap = new Map<string, typeof records>()
    for (const record of records) {
      const bedDate = new Date(record.enteredBedAt)
      // If entered bed after midnight but before 6AM, count as previous day's night
      const adjustedDate = new Date(bedDate)
      if (adjustedDate.getHours() < 6) {
        adjustedDate.setDate(adjustedDate.getDate() - 1)
      }
      const dateKey = localDateKey(adjustedDate)
      const existing = nightMap.get(dateKey)
      if (existing) {
        existing.push(record)
      }
      else {
        nightMap.set(dateKey, [record])
      }
    }

    // Build 7 days
    const nights = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(startDate)
      day.setDate(day.getDate() + i)
      const dateKey = localDateKey(day)
      const dayRecords = nightMap.get(dateKey) ?? []

      let totalSleepHours = 0
      let distribution: StageDistribution = { wake: 0, light: 0, deep: 0, rem: 0 }
      let qualityScore = 0

      if (dayRecords.length > 0) {
        totalSleepHours = dayRecords.reduce((sum, r) => sum + r.sleepDurationSeconds, 0) / 3600

        // Filter vitals/movement for this night's window
        const nightStart = dayRecords[0].enteredBedAt
        const nightEnd = dayRecords[dayRecords.length - 1].leftBedAt
        const nightVitals = vitalsData.filter((v) => {
          const t = new Date(v.timestamp).getTime()
          return t >= new Date(nightStart).getTime() && t <= new Date(nightEnd).getTime()
        })
        const nightMovement = movData.filter((m) => {
          const t = new Date(m.timestamp).getTime()
          return t >= new Date(nightStart).getTime() && t <= new Date(nightEnd).getTime()
        })

        if (nightVitals.length > 0) {
          const epochs = classifySleepStages(
            nightVitals.map(v => ({ ...v, timestamp: new Date(v.timestamp) })),
            nightMovement.map(m => ({ ...m, timestamp: new Date(m.timestamp) })),
          )
          distribution = calculateDistribution(epochs)
          qualityScore = calculateQualityScore(distribution)
        }
      }

      nights.push({
        date: dateKey,
        dayLabel: DAY_NAMES[day.getDay()],
        totalSleepHours,
        distribution,
        qualityScore,
      })
    }

    return nights
  }, [timeRange, sleepRecords.data, vitalsQuery.data, movementQuery.data, startDate])

  // Monthly summaries
  const monthlySummaries = useMemo(() => {
    if (timeRange !== 'month' || !sleepRecords.data) return []

    const records = sleepRecords.data as Array<{
      id: number
      enteredBedAt: Date
      leftBedAt: Date
      sleepDurationSeconds: number
      timesExitedBed: number
    }>

    return records.map((record) => {
      const bedDate = new Date(record.enteredBedAt)
      return {
        id: record.id,
        date: bedDate,
        sleepHours: record.sleepDurationSeconds / 3600,
        timesExited: record.timesExitedBed,
      }
    })
  }, [timeRange, sleepRecords.data])

  // Navigation handlers
  const canGoForward = useMemo(() => {
    if (timeRange === 'week') return weekOffset < 0
    if (timeRange === 'month') return monthOffset < 0
    return false
  }, [timeRange, weekOffset, monthOffset])

  const handlePrev = useCallback(() => {
    if (timeRange === 'week') setWeekOffset(o => o - 1)
    if (timeRange === 'month') setMonthOffset(o => o - 1)
  }, [timeRange])

  const handleNext = useCallback(() => {
    if (timeRange === 'week' && weekOffset < 0) setWeekOffset(o => o + 1)
    if (timeRange === 'month' && monthOffset < 0) setMonthOffset(o => o + 1)
  }, [timeRange, weekOffset, monthOffset])

  const handleWeekNightSelect = useCallback((date: string) => {
    setSelectedWeekNight(prev => (prev === date ? null : date))
  }, [])

  // Loading state
  const isLoading
    = (timeRange === 'night' && nightStages.isLoading)
      || (timeRange !== 'night' && sleepRecords.isLoading)

  // Error state
  const error = nightStages.error || sleepRecords.error

  // Current stages data (night view or drill-in)
  const stagesData = timeRange === 'night'
    ? nightStages.data
    : (selectedWeekNight ? drillInStages.data : null)

  const nightsWithSleep = weeklyNights.filter(n => n.totalSleepHours > 0)
  const weeklyAverageMs = nightsWithSleep.length > 0
    ? (nightsWithSleep.reduce((sum, n) => sum + n.totalSleepHours, 0) / nightsWithSleep.length) * 3_600_000
    : 0

  const title = timeRange === 'week' ? 'Time asleep' : timeRange === 'month' ? 'Sleep this month' : 'Sleep stages'

  let footnote: string | undefined
  if (timeRange === 'night' && stagesData?.enteredBedAt) footnote = formatNightDate(new Date(stagesData.enteredBedAt))
  if (timeRange === 'week' && !isLoading) {
    footnote = nightsWithSleep.length > 0
      ? `Average ${formatDurationHM(weeklyAverageMs)} over ${nightsWithSleep.length} ${nightsWithSleep.length === 1 ? 'night' : 'nights'}`
      : undefined
  }

  const trailing = timeRange === 'night' && stagesData && stagesData.epochs.length > 0
    ? (
        <>
          Score
          {' '}
          <span className="font-semibold text-white">{stagesData.qualityScore}</span>
        </>
      )
    : undefined

  return (
    <ChartCard title={sideLabel ? `${title} · ${sideLabel}` : title} footnote={footnote} trailing={trailing}>
      <div className="space-y-4">
        {!hideTimeRangeSelector && (
          <TimeRangeSelector
            value={timeRange}
            onChange={(r) => {
              setTimeRange(r)
              setSelectedWeekNight(null)
            }}
          />
        )}

        {/* Navigation for week/month — suppressed when a parent owns the week navigator */}
        {timeRange !== 'night' && startDate && endDate && !useSharedWeek && (
          <WeekNavigator
            label={formatDateRange(startDate, endDate)}
            isCurrentWeek={!canGoForward}
            onPrevious={handlePrev}
            onNext={handleNext}
            onToday={() => {
              setWeekOffset(0)
              setMonthOffset(0)
            }}
          />
        )}

        {isLoading && <div className="h-40" aria-busy="true" />}

        {error && <p className="py-6 text-center text-[15px] text-red-400">Couldn’t load sleep data.</p>}

        {/* Night view */}
        {!isLoading && !error && timeRange === 'night' && (
          stagesData && stagesData.epochs.length > 0
            ? (
                <>
                  <Hypnogram
                    blocks={stagesData.blocks}
                    epochs={stagesData.epochs}
                    startTime={stagesData.enteredBedAt ?? stagesData.epochs[0].start}
                    endTime={stagesData.leftBedAt ?? stagesData.epochs[stagesData.epochs.length - 1].start + stagesData.epochs[stagesData.epochs.length - 1].duration}
                  />
                  <StageDistributionBar distribution={stagesData.distribution} epochs={stagesData.epochs} />
                </>
              )
            : <p className="py-6 text-center text-[15px] text-zinc-500">No sleep stages recorded yet.</p>
        )}

        {/* Week view */}
        {!isLoading && !error && timeRange === 'week' && (
          <>
            <WeeklySleepChart
              nights={weeklyNights}
              onSelectNight={handleWeekNightSelect}
              selectedDate={selectedWeekNight}
            />

            {selectedWeekNight && drillInStages.data && drillInStages.data.epochs.length > 0 && (
              <div className="space-y-3 border-t border-zinc-800 pt-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[15px] font-semibold text-white">
                    {formatNightDate(new Date(selectedWeekNight + 'T12:00:00'))}
                  </p>
                  <p className="ios-numeric text-[15px] text-zinc-500">
                    Score
                    {' '}
                    <span className="font-semibold text-white">{drillInStages.data.qualityScore}</span>
                  </p>
                </div>
                <Hypnogram
                  blocks={drillInStages.data.blocks}
                  epochs={drillInStages.data.epochs}
                  startTime={drillInStages.data.enteredBedAt ?? drillInStages.data.epochs[0].start}
                  endTime={drillInStages.data.leftBedAt ?? drillInStages.data.epochs[drillInStages.data.epochs.length - 1].start + drillInStages.data.epochs[drillInStages.data.epochs.length - 1].duration}
                />
                <StageDistributionBar distribution={drillInStages.data.distribution} epochs={drillInStages.data.epochs} />
              </div>
            )}

            {selectedWeekNight && drillInStages.isLoading && <div className="h-20" aria-busy="true" />}

            {!selectedWeekNight && nightsWithSleep.length > 0 && (
              <p className="text-[13px] leading-[18px] text-zinc-500">Tap a night to see its stages.</p>
            )}
          </>
        )}

        {/* Month view */}
        {!isLoading && !error && timeRange === 'month' && (
          monthlySummaries.length === 0
            ? <p className="py-6 text-center text-[15px] text-zinc-500">No sleep recorded this month.</p>
            : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <MonthStat label="Nights" value={String(monthlySummaries.length)} />
                    <MonthStat
                      label="Average sleep"
                      value={formatDurationHM((monthlySummaries.reduce((s, n) => s + n.sleepHours, 0) / monthlySummaries.length) * 3_600_000)}
                    />
                    <MonthStat
                      label="Average exits"
                      value={(monthlySummaries.reduce((s, n) => s + n.timesExited, 0) / monthlySummaries.length).toFixed(1)}
                    />
                  </div>

                  <div className="max-h-64 overflow-y-auto [&>*+*]:border-t [&>*+*]:border-zinc-800">
                    {monthlySummaries.map(night => (
                      <div key={night.id} className="ios-numeric flex min-h-[44px] items-center justify-between gap-3 text-[15px]">
                        <span className="text-white">
                          {night.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-zinc-500">
                          {formatDurationHM((night.sleepHours ?? 0) * 3_600_000)}
                          {` · ${night.timesExited} ${night.timesExited === 1 ? 'exit' : 'exits'}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )
        )}
      </div>
    </ChartCard>
  )
}

function MonthStat({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <p className="ios-numeric text-[22px] font-semibold leading-7 text-white">{value}</p>
      <p className="text-[13px] leading-[18px] text-zinc-500">{label}</p>
    </div>
  )
}
