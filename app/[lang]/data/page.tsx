'use client'

import { useSide, type SideSelection } from '@/src/providers/SideProvider'
import { useWeekNavigator } from '@/src/hooks/useWeekNavigator'
import { trpc } from '@/src/utils/trpc'
import { PageHeader, SegmentedControl } from '@/src/ui/ios'

import { SleepStagesCard } from '@/src/components/SleepStages/SleepStagesCard'
import { VitalsPanel } from '@/src/components/VitalsPanel/VitalsPanel'
import { MovementChart } from '@/src/components/MovementChart/MovementChart'
import { SleepSummaryCard, nightCaption } from '@/src/components/biometrics/SleepSummaryCard'
import { RawDataButton } from '@/src/components/biometrics/RawDataButton'
import { WeekNavigator } from '@/src/components/WeekNavigator/WeekNavigator'
import type { SleepRecord } from '@/src/components/biometrics/types'

const SIDE_OPTIONS: ReadonlyArray<{ value: SideSelection, label: string }> = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'both', label: 'Both' },
]

/**
 * Sleep tab — Health-style vertical flow:
 *   header (side filter) → week stepper → last-night summary →
 *   stages → vitals (night/week) → weekly timeline → movement → export.
 * Chart sections collapse into a single message until a night is recorded.
 */
export default function DataPage() {
  const { selectedSide, activeSides, primarySide, selectSide } = useSide()
  const week = useWeekNavigator()

  const showBothSides = selectedSide === 'both'
  const leftActive = activeSides.includes('left')
  const rightActive = activeSides.includes('right')

  // Sleep records for each active side in the visible week
  const leftSleepQuery = trpc.biometrics.getSleepRecords.useQuery(
    { side: 'left', startDate: week.weekStart, endDate: week.weekEnd, limit: 7 },
    { enabled: leftActive },
  )
  const rightSleepQuery = trpc.biometrics.getSleepRecords.useQuery(
    { side: 'right', startDate: week.weekStart, endDate: week.weekEnd, limit: 7 },
    { enabled: rightActive },
  )

  // Whether any night has ever been recorded — distinguishes a fresh install
  // from an empty week.
  const leftLatestQuery = trpc.biometrics.getLatestSleep.useQuery({ side: 'left' }, { enabled: leftActive })
  const rightLatestQuery = trpc.biometrics.getLatestSleep.useQuery({ side: 'right' }, { enabled: rightActive })

  const leftRecords: SleepRecord[] = leftActive
    ? ((leftSleepQuery.data ?? []) as Omit<SleepRecord, 'side'>[]).map(r => ({ ...r, side: 'left' as const }))
    : []
  const rightRecords: SleepRecord[] = rightActive
    ? ((rightSleepQuery.data ?? []) as Omit<SleepRecord, 'side'>[]).map(r => ({ ...r, side: 'right' as const }))
    : []
  const byNewest = (a: SleepRecord, b: SleepRecord) => new Date(b.enteredBedAt).getTime() - new Date(a.enteredBedAt).getTime()
  leftRecords.sort(byNewest)
  rightRecords.sort(byNewest)
  const allSleepRecords = [...leftRecords, ...rightRecords].sort(byNewest)

  const isLoading = (leftActive && leftSleepQuery.isLoading) || (rightActive && rightSleepQuery.isLoading)
  const hasWeekData = allSleepRecords.length > 0
  const hasHistory = Boolean((leftActive && leftLatestQuery.data) || (rightActive && rightLatestQuery.data))
  const historyLoading = (leftActive && leftLatestQuery.isLoading) || (rightActive && rightLatestQuery.isLoading)

  const latest = allSleepRecords[0]
  // The week range already sits in the stepper below; the subtitle names the night shown.
  const subtitle = latest ? nightCaption(latest) : (week.isCurrentWeek ? 'This week' : 'Earlier week')

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        title="Sleep"
        subtitle={subtitle}
        trailing={(
          <SegmentedControl
            aria-label="Side"
            options={SIDE_OPTIONS}
            value={selectedSide}
            onChange={selectSide}
            className="w-[204px]"
          />
        )}
      />

      <WeekNavigator
        label={week.label}
        isCurrentWeek={week.isCurrentWeek}
        onPrevious={week.goToPreviousWeek}
        onNext={week.goToNextWeek}
        onToday={week.goToCurrentWeek}
      />

      {isLoading && <div className="h-[196px] rounded-xl bg-zinc-900" aria-busy="true" />}

      {!isLoading && !hasWeekData && (
        <section className="rounded-xl bg-zinc-900 px-4 py-5 text-center">
          <p className="text-[17px] text-white">
            {hasHistory || historyLoading ? 'No sleep recorded this week.' : 'Sleep data will appear after your first night.'}
          </p>
        </section>
      )}

      {!isLoading && hasWeekData && (
        <div className="space-y-6">
          {/* Last night */}
          {showBothSides
            ? (
                <div className="space-y-3">
                  <SleepSummaryCard side="left" records={leftRecords} showSideName />
                  <SleepSummaryCard side="right" records={rightRecords} showSideName />
                </div>
              )
            : <SleepSummaryCard side={primarySide} records={allSleepRecords} />}

          {/* Stages for the latest night */}
          {showBothSides
            ? (
                <div className="space-y-3">
                  <SleepStagesCard side="left" defaultTimeRange="night" hideTimeRangeSelector sideLabel="Left" />
                  <SleepStagesCard side="right" defaultTimeRange="night" hideTimeRangeSelector sideLabel="Right" />
                </div>
              )
            : <SleepStagesCard side={primarySide} defaultTimeRange="night" hideTimeRangeSelector />}

          {/* Vitals: night / week */}
          <VitalsPanel dualSide={showBothSides} hideNav hideSummary />

          {/* Weekly timeline */}
          {showBothSides
            ? (
                <div className="space-y-3">
                  <SleepStagesCard side="left" defaultTimeRange="week" hideTimeRangeSelector sideLabel="Left" />
                  <SleepStagesCard side="right" defaultTimeRange="week" hideTimeRangeSelector sideLabel="Right" />
                </div>
              )
            : <SleepStagesCard side={primarySide} defaultTimeRange="week" hideTimeRangeSelector />}

          <MovementChart dualSide={showBothSides} hideNav />
        </div>
      )}

      <div className="pt-2">
        <RawDataButton />
      </div>
    </div>
  )
}
