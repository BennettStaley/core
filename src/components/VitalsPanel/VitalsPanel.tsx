'use client'

import { useSide } from '@/src/hooks/useSide'
import { useWeekNavigator } from '@/src/hooks/useWeekNavigator'
import { trpc } from '@/src/utils/trpc'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SegmentedControl } from '@/src/ui/ios'
import { ChartCard, METRIC_COLORS, MetricValue, SECONDARY_SERIES_COLOR } from '@/src/components/biometrics/ChartCard'
import { WeekNavigator } from '@/src/components/WeekNavigator/WeekNavigator'
import { VitalsChart } from '../VitalsChart/VitalsChart'

// Population zones (40/60/100/140 etc.) intentionally retired for sleep view —
// they're awake-fitness conventions that mislabel medical signals (sustained
// HR > 100 asleep is tachycardia, not "Elevated, keep going"). The personal
// baseline band carries the in-range / out-of-range signal instead. See
// industry convention (Oura/Whoop/Garmin/Apple/Fitbit) for sleep vitals.
interface Zone {
  label: string
  min: number
  max: number
  color: string
}
const NO_ZONES: Zone[] = []

interface VitalsRecord {
  id: number
  side: string
  timestamp: Date
  heartRate: number | null
  hrv: number | null
  breathingRate: number | null
}

interface DataPoint {
  timestamp: Date
  value: number
}

interface SleepSession {
  id: number
  enteredBedAt: Date
  leftBedAt: Date | null
}

interface Baseline {
  mean: number | null
  sd: number | null
}

interface MetricSpec {
  key: 'hr' | 'hrv' | 'br'
  title: string
  color: string
  unit: string
  zones: Zone[]
  gradientId: string
}

// One system colour per metric (see ChartCard METRIC_COLORS). Out-of-baseline
// emphasis is carried by opacity/dots, not by extra hues.
const METRICS: MetricSpec[] = [
  {
    key: 'hr',
    title: 'Heart rate',
    color: METRIC_COLORS.hr,
    unit: 'bpm',
    zones: NO_ZONES,
    gradientId: 'hr-gradient',
  },
  {
    key: 'hrv',
    title: 'Heart rate variability',
    color: METRIC_COLORS.hrv,
    unit: 'ms',
    zones: NO_ZONES,
    gradientId: 'hrv-gradient',
  },
  {
    key: 'br',
    title: 'Breathing rate',
    color: METRIC_COLORS.br,
    unit: 'br/min',
    zones: NO_ZONES,
    gradientId: 'br-gradient',
  },
]

/**
 * Drop physiologically impossible values. Bounds are deliberately permissive:
 * the previous HR floor of 45 silently flatlined endurance athletes whose
 * sleeping HR sits in the high 30s, and HRV > 300 ms is unusual but not
 * impossible. Filter at the edges of plausibility, not at "looks weird."
 */
function filterOutliers(records: VitalsRecord[]): VitalsRecord[] {
  return records.filter((r) => {
    if (r.heartRate != null && (r.heartRate < 30 || r.heartRate > 180)) return false
    if (r.hrv != null && (r.hrv <= 0 || r.hrv > 400)) return false
    if (r.breathingRate != null && (r.breathingRate < 6 || r.breathingRate > 30)) return false
    return true
  })
}

/**
 * HRV trend from per-night medians vs personal baseline. The previous
 * implementation split within-session HRV samples in half and reported ±10 %
 * deltas — given how much HRV swings with sleep stages, that was random walk
 * noise dressed up as a trend chip. We now require:
 *   - at least 4 nights of per-night medians in the visible week
 *   - a baseline mean to score against
 *   - |z| > 1.0 (recent median sits more than one personal SD from baseline)
 * Anything weaker returns null and we hide the chip.
 */
function computeTrend(
  nightlyHrvMedians: number[],
  baselineMean: number | null,
  baselineSD: number | null,
): { text: string, direction: 'up' | 'down' | 'stable' } | null {
  if (nightlyHrvMedians.length < 4) return null
  if (baselineMean == null || baselineSD == null || baselineSD <= 0) return null

  const recentMedian
    = [...nightlyHrvMedians].sort((a, b) => a - b)[Math.floor(nightlyHrvMedians.length / 2)]
  const z = (recentMedian - baselineMean) / baselineSD
  const deltaPct = Math.round(((recentMedian - baselineMean) / baselineMean) * 100)

  if (z > 1.0) return { text: `HRV above baseline (+${deltaPct}%)`, direction: 'up' }
  if (z < -1.0) return { text: `HRV below baseline (${deltaPct}%)`, direction: 'down' }
  return null
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function medianStr(values: number[]): string {
  const m = median(values)
  return m == null ? '--' : Math.round(m).toString()
}

/** 5-point centered moving average for visual smoothing. */
function smoothData<T extends Record<string, unknown>>(
  data: T[],
  key: keyof T,
  windowSize = 5,
): T[] {
  return data.map((point, i) => {
    const start = Math.max(0, i - Math.floor(windowSize / 2))
    const end = Math.min(data.length, i + Math.ceil(windowSize / 2))
    const windowSlice = data.slice(start, end)
    const nums = windowSlice.map(w => w[key]).filter((v): v is T[keyof T] & number => typeof v === 'number')
    if (nums.length === 0) return point
    const smoothedAvg = nums.reduce((sum: number, v) => sum + v, 0) / nums.length
    return { ...point, [key]: smoothedAvg }
  })
}

/** Median + interquartile range for a list of numbers. */
function summarise(values: number[]): { median: number, q1: number, q3: number, min: number, max: number } | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const q = (p: number): number => {
    const idx = p * (sorted.length - 1)
    const lo = Math.floor(idx)
    const hi = Math.ceil(idx)
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
  }
  return {
    median: q(0.5),
    q1: q(0.25),
    q3: q(0.75),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  }
}

// Date only: the in-bed span shown beside it would contradict the "time
// asleep" hero number, which excludes awake time.
function formatSessionLabel(session: SleepSession): string {
  return session.enteredBedAt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatNightLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })
}

// Side colors for dual-side comparison
const SIDE_COLORS = {
  left: { primary: SECONDARY_SERIES_COLOR, label: 'Left' },
  right: { primary: SECONDARY_SERIES_COLOR, label: 'Right' },
} as const

// Minimum session duration that counts as "sleep". The sleep-detector accepts
// anything ≥ 5 min, but sub-30-min entries are usually presence blips, not
// nights — and they'd default the night view to an empty chart.
const MIN_SESSION_MS = 30 * 60 * 1000

interface VitalsPanelProps {
  /** When true, fetch and overlay both sides on each chart */
  dualSide?: boolean
  /** When true, hide the built-in week navigator + side toggle */
  hideNav?: boolean
  /** When true, hide the summary card (BPM/HRV/BR block) */
  hideSummary?: boolean
}

/**
 * Pod-derived vitals panel. Two views:
 *  - Night: stacked HR/HRV/BR panels for one selected sleep session, sharing
 *    a clock-time x-axis so events line up vertically (PSG convention).
 *  - Week: one summary row per night per metric with median dot + IQR bar
 *    and a personal-baseline band behind the rows (Whoop/Oura convention).
 */
export function VitalsPanel({ dualSide = false, hideNav = false, hideSummary = false }: VitalsPanelProps) {
  const { side, setSide } = useSide()
  const week = useWeekNavigator()
  const [view, setView] = useState<'night' | 'week'>('night')
  // Track the user's explicit pick by session ID so the selection survives
  // week navigation when possible; defaults to the most recent session.
  const [pickedSessionId, setPickedSessionId] = useState<number | null>(null)

  const primarySide = side
  const otherSide: 'left' | 'right' = side === 'left' ? 'right' : 'left'

  // ── Queries ───────────────────────────────────────────────
  const vitalsQuery = trpc.biometrics.getVitals.useQuery({
    side: primarySide,
    startDate: week.weekStart,
    endDate: week.weekEnd,
    limit: 10000,
  })

  const sessionsQuery = trpc.biometrics.getSleepRecords.useQuery({
    side: primarySide,
    startDate: week.weekStart,
    endDate: week.weekEnd,
    limit: 100,
  })

  const baselineQuery = trpc.biometrics.getVitalsBaseline.useQuery({
    side: primarySide,
    days: 30,
  })

  const otherVitalsQuery = trpc.biometrics.getVitals.useQuery(
    {
      side: otherSide,
      startDate: week.weekStart,
      endDate: week.weekEnd,
      limit: 10000,
    },
    { enabled: dualSide },
  )

  // ── Derived state ─────────────────────────────────────────
  const rawRecords = useMemo<VitalsRecord[]>(() => vitalsQuery.data ?? [], [vitalsQuery.data])
  const sortedRecords = useMemo(
    () => filterOutliers(rawRecords).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    ),
    [rawRecords],
  )

  const otherRawRecords = useMemo<VitalsRecord[]>(() => otherVitalsQuery.data ?? [], [otherVitalsQuery.data])
  const otherSortedRecords = useMemo(
    () => filterOutliers(otherRawRecords).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    ),
    [otherRawRecords],
  )

  const sessions = useMemo<SleepSession[]>(
    () =>
      (sessionsQuery.data ?? [])
        .map(s => ({
          id: s.id,
          enteredBedAt: new Date(s.enteredBedAt),
          leftBedAt: s.leftBedAt ? new Date(s.leftBedAt) : null,
        }))
        .filter((s) => {
          const end = s.leftBedAt ?? new Date()
          return end.getTime() - s.enteredBedAt.getTime() >= MIN_SESSION_MS
        })
        .sort((a, b) => a.enteredBedAt.getTime() - b.enteredBedAt.getTime()),
    [sessionsQuery.data],
  )

  // Resolve the effective session index without state-in-effect: prefer the
  // user's pick when it's still in this week's list, otherwise default to the
  // most recent session.
  const selectedSessionIndex = useMemo<number | null>(() => {
    if (sessions.length === 0) return null
    if (pickedSessionId != null) {
      const idx = sessions.findIndex(s => s.id === pickedSessionId)
      if (idx >= 0) return idx
    }
    return sessions.length - 1
  }, [sessions, pickedSessionId])

  const handleSelectIndex = (next: number): void => {
    const clamped = Math.max(0, Math.min(sessions.length - 1, next))
    setPickedSessionId(sessions[clamped]?.id ?? null)
  }

  const baseline = baselineQuery.data

  // Per-metric smoothed point arrays for primary side (full week).
  const metricSeries = useMemo(() => extractMetricSeries(sortedRecords), [sortedRecords])
  const otherMetricSeries = useMemo(() => extractMetricSeries(otherSortedRecords), [otherSortedRecords])

  // Summary numbers are view-aware: in Night view we restrict to the selected
  // session window so the hero number describes *this night*. In Week view we
  // use the whole visible week. The previous behavior showed the same
  // week-aggregate number in both modes, which contradicted the chart below it
  // when the user was looking at a single night.
  const selectedSession = selectedSessionIndex != null ? sessions[selectedSessionIndex] : null
  const summaryWindow = useMemo(() => {
    if (view === 'night' && selectedSession) {
      const start = selectedSession.enteredBedAt.getTime()
      const end = (selectedSession.leftBedAt ?? new Date()).getTime()
      return sortedRecords.filter((r) => {
        const t = new Date(r.timestamp).getTime()
        return t >= start && t <= end
      })
    }
    return sortedRecords
  }, [view, selectedSession, sortedRecords])

  const otherSummaryWindow = useMemo(() => {
    if (view === 'night' && selectedSession) {
      const start = selectedSession.enteredBedAt.getTime()
      const end = (selectedSession.leftBedAt ?? new Date()).getTime()
      return otherSortedRecords.filter((r) => {
        const t = new Date(r.timestamp).getTime()
        return t >= start && t <= end
      })
    }
    return otherSortedRecords
  }, [view, selectedSession, otherSortedRecords])

  const hrValues = summaryWindow.map(r => r.heartRate).filter((v): v is number => v != null)
  const hrvValues = summaryWindow.map(r => r.hrv).filter((v): v is number => v != null)
  const brValues = summaryWindow.map(r => r.breathingRate).filter((v): v is number => v != null)
  const otherHrValues = otherSummaryWindow.map(r => r.heartRate).filter((v): v is number => v != null)
  const otherHrvValues = otherSummaryWindow.map(r => r.hrv).filter((v): v is number => v != null)
  const otherBrValues = otherSummaryWindow.map(r => r.breathingRate).filter((v): v is number => v != null)

  // Per-night HRV medians for the visible window — fed to the trend chip
  // (z-score vs personal baseline) and rendered as bars in the HRV night block.
  const nightlyHrvMedians = useMemo(() => {
    const stats = computeNightStats(sortedRecords, sessions, 'hrv')
    return stats.map(s => s.median)
  }, [sortedRecords, sessions])

  const trend = useMemo(
    () => computeTrend(nightlyHrvMedians, baseline?.hrvMean ?? null, baseline?.hrvSD ?? null),
    [nightlyHrvMedians, baseline],
  )

  const isLoading = vitalsQuery.isLoading && rawRecords.length === 0

  const VIEW_OPTIONS = [
    { value: 'night', label: 'Night' },
    { value: 'week', label: 'Week' },
  ] as const

  return (
    <div className="space-y-3">
      {!hideNav && (
        <div className="space-y-2">
          <WeekNavigator
            label={week.label}
            isCurrentWeek={week.isCurrentWeek}
            onPrevious={week.goToPreviousWeek}
            onNext={week.goToNextWeek}
            onToday={week.goToCurrentWeek}
          />
          <SegmentedControl
            aria-label="Side"
            options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]}
            value={side}
            onChange={setSide}
          />
        </div>
      )}

      <SegmentedControl aria-label="Vitals range" options={VIEW_OPTIONS} value={view} onChange={setView} />

      {isLoading && <p className="py-10 text-center text-[15px] text-zinc-500">Loading vitals…</p>}

      {!isLoading && (
        <>
          {!hideSummary && (
            <ChartCard
              title={view === 'night' ? 'This night' : 'This week'}
              footnote={trend?.text ?? 'Median values'}
            >
              {dualSide && (
                <p className="mb-2 text-[13px] leading-[18px] text-zinc-500">
                  {`${SIDE_COLORS[primarySide].label} solid · ${SIDE_COLORS[otherSide].label} dashed`}
                </p>
              )}
              <div className="grid grid-cols-3 gap-2">
                <SummaryItem
                  label="Sleeping HR"
                  value={medianStr(hrValues)}
                  unit="bpm"
                  secondaryValue={dualSide ? medianStr(otherHrValues) : undefined}
                />
                <SummaryItem
                  label="HRV"
                  value={medianStr(hrvValues)}
                  unit="ms"
                  secondaryValue={dualSide ? medianStr(otherHrvValues) : undefined}
                />
                <SummaryItem
                  label="Breathing"
                  value={medianStr(brValues)}
                  unit="br/min"
                  secondaryValue={dualSide ? medianStr(otherBrValues) : undefined}
                />
              </div>
            </ChartCard>
          )}

          {view === 'night'
            ? (
                <NightView
                  sessions={sessions}
                  selectedIndex={selectedSessionIndex}
                  onSelectIndex={handleSelectIndex}
                  metricSeries={metricSeries}
                  otherMetricSeries={dualSide ? otherMetricSeries : null}
                  baseline={baseline ?? null}
                  primaryLabel={dualSide ? SIDE_COLORS[primarySide].label : undefined}
                  secondaryLabel={dualSide ? SIDE_COLORS[otherSide].label : undefined}
                  secondaryColor={SIDE_COLORS[otherSide].primary}
                />
              )
            : (
                <WeekView
                  sortedRecords={sortedRecords}
                  otherSortedRecords={dualSide ? otherSortedRecords : null}
                  sessions={sessions}
                  baseline={baseline ?? null}
                  primaryLabel={dualSide ? SIDE_COLORS[primarySide].label : undefined}
                  secondaryLabel={dualSide ? SIDE_COLORS[otherSide].label : undefined}
                />
              )}
        </>
      )}

      {vitalsQuery.isError && (
        <div className="rounded-xl bg-zinc-900 px-4 py-3 text-center">
          <p className="text-[15px] text-red-400">Couldn’t load vitals.</p>
          <button
            type="button"
            onClick={() => vitalsQuery.refetch()}
            className="min-h-[44px] px-3 text-[17px] text-sky-400 active:opacity-50"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────

function SummaryItem({
  label,
  value,
  unit,
  secondaryValue,
}: {
  label: string
  value: string
  unit: string
  secondaryValue?: string
}) {
  return (
    <div className="min-w-0">
      <p className="ios-numeric truncate">
        <span className="text-[22px] font-semibold leading-7 text-white">{value}</span>
        {secondaryValue && secondaryValue !== '--' && (
          <span className="text-[15px] text-zinc-500">
            {' / '}
            {secondaryValue}
          </span>
        )}
        <span className="text-[13px] text-zinc-500">
          {' '}
          {unit}
        </span>
      </p>
      <p className="truncate text-[13px] leading-[18px] text-zinc-500">{label}</p>
    </div>
  )
}

// ── Night view ──────────────────────────────────────────────────────

type MetricSeries = Record<'hr' | 'hrv' | 'br', DataPoint[]>

function extractMetricSeries(records: VitalsRecord[]): MetricSeries {
  const series: MetricSeries = { hr: [], hrv: [], br: [] }
  series.hr = smoothData(
    records.filter(r => r.heartRate != null).map(r => ({ timestamp: new Date(r.timestamp), value: r.heartRate ?? 0 })),
    'value',
  )
  // HRV is intentionally not smoothed — variability *is* the signal. A 5-pt
  // moving average over RMSSD-like values deletes that signal and leaves only
  // the noise floor. Within-night HRV is consumed as 30-min binned bars +
  // overnight median (see HrvNightBlock), not as a continuous line.
  series.hrv = records
    .filter(r => r.hrv != null)
    .map(r => ({ timestamp: new Date(r.timestamp), value: r.hrv ?? 0 }))
  series.br = smoothData(
    records.filter(r => r.breathingRate != null).map(r => ({ timestamp: new Date(r.timestamp), value: r.breathingRate ?? 0 })),
    'value',
  )
  return series
}

function metricBaseline(metric: MetricSpec['key'], baseline: { hrMean: number | null, hrSD: number | null, hrvMean: number | null, hrvSD: number | null, brMean: number | null, brSD: number | null } | null): Baseline {
  if (!baseline) return { mean: null, sd: null }
  if (metric === 'hr') return { mean: baseline.hrMean, sd: baseline.hrSD }
  if (metric === 'hrv') return { mean: baseline.hrvMean, sd: baseline.hrvSD }
  return { mean: baseline.brMean, sd: baseline.brSD }
}

function filterToWindow(points: DataPoint[], start: number, end: number): DataPoint[] {
  return points.filter((p) => {
    const t = p.timestamp.getTime()
    return t >= start && t <= end
  })
}

interface BaselineRow { hrMean: number | null, hrSD: number | null, hrvMean: number | null, hrvSD: number | null, brMean: number | null, brSD: number | null }

function typicalText(mean: number | null, sd: number | null, unit: string): string | undefined {
  if (mean == null) return undefined
  return `Typical ${Math.round(mean)}${sd != null ? ` ± ${Math.round(sd)}` : ''} ${unit}`
}

function EmptyVitals({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-zinc-900 px-4 py-6 text-center">
      <p className="text-[15px] text-zinc-500">{children}</p>
    </div>
  )
}

function NightView({
  sessions,
  selectedIndex,
  onSelectIndex,
  metricSeries,
  otherMetricSeries,
  baseline,
  primaryLabel,
  secondaryLabel,
  secondaryColor,
}: {
  sessions: SleepSession[]
  selectedIndex: number | null
  onSelectIndex: (next: number) => void
  metricSeries: MetricSeries
  otherMetricSeries: MetricSeries | null
  baseline: BaselineRow | null
  primaryLabel?: string
  secondaryLabel?: string
  secondaryColor: string
}) {
  if (sessions.length === 0 || selectedIndex == null) {
    return <EmptyVitals>No vitals recorded this week.</EmptyVitals>
  }

  const session = sessions[Math.min(selectedIndex, sessions.length - 1)]
  const start = session.enteredBedAt.getTime()
  const end = (session.leftBedAt ?? new Date()).getTime()

  return (
    <>
      {/* Session stepper */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onSelectIndex(Math.max(0, selectedIndex - 1))}
          disabled={selectedIndex === 0}
          className="-ml-2 flex h-11 w-11 items-center justify-center text-sky-400 active:opacity-50 disabled:text-zinc-700"
          aria-label="Previous session"
        >
          <ChevronLeft size={22} strokeWidth={2.25} />
        </button>
        <div className="min-w-0 text-center">
          <p className="ios-numeric truncate text-[15px] font-semibold text-white">{formatSessionLabel(session)}</p>
          <p className="ios-numeric text-[13px] leading-[18px] text-zinc-500">
            {formatClock(session.enteredBedAt)}
            {' – '}
            {session.leftBedAt ? formatClock(session.leftBedAt) : 'now'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelectIndex(Math.min(sessions.length - 1, selectedIndex + 1))}
          disabled={selectedIndex >= sessions.length - 1}
          className="-mr-2 flex h-11 w-11 items-center justify-center text-sky-400 active:opacity-50 disabled:text-zinc-700"
          aria-label="Next session"
        >
          <ChevronRight size={22} strokeWidth={2.25} />
        </button>
      </div>

      {/* HR / HRV / BR share the session's clock-time axis */}
      {METRICS.map((metric) => {
        if (metric.key === 'hrv') {
          const primary = filterToWindow(metricSeries.hrv, start, end)
          const secondary = otherMetricSeries ? filterToWindow(otherMetricSeries.hrv, start, end) : []
          const { mean, sd } = metricBaseline('hrv', baseline)
          return (
            <HrvNightBlock
              key="hrv"
              metric={metric}
              primary={primary}
              secondary={secondary}
              baselineMean={mean}
              baselineSD={sd}
              sessionStart={start}
              sessionEnd={end}
              primaryLabel={primaryLabel}
              secondaryLabel={secondaryLabel}
            />
          )
        }

        const primary = filterToWindow(metricSeries[metric.key], start, end)
        const secondary = otherMetricSeries ? filterToWindow(otherMetricSeries[metric.key], start, end) : []
        const { mean, sd } = metricBaseline(metric.key, baseline)
        const baselineMin = mean != null && sd != null ? mean - sd : undefined
        const baselineMax = mean != null && sd != null ? mean + sd : undefined
        const nightMedian = median(primary.map(p => p.value))

        return (
          <ChartCard
            key={metric.key}
            title={metric.title}
            trailing={nightMedian != null ? <MetricValue value={Math.round(nightMedian)} unit={metric.unit} /> : undefined}
            footnote={typicalText(mean, sd, metric.unit)}
          >
            <VitalsChart
              data={primary}
              color={metric.color}
              gradientId={`${metric.gradientId}-night`}
              zones={metric.zones}
              unit={metric.unit}
              height={120}
              label={primaryLabel}
              xMin={start}
              xMax={end}
              baselineMin={baselineMin}
              baselineMax={baselineMax}
              compact
              secondary={secondary.length > 0
                ? {
                    data: secondary,
                    color: secondaryColor,
                    gradientId: `${metric.gradientId}-night-other`,
                    label: secondaryLabel ?? '',
                  }
                : undefined}
            />
          </ChartCard>
        )
      })}
    </>
  )
}

/**
 * HRV night block. Replaces the misleading high-frequency HRV line: shows one
 * overnight median (the number every consumer sleep product hero's), a
 * vs-baseline delta, and 30-min binned bars so within-night variation is
 * legible without inviting moment-to-moment interpretation.
 */
function HrvNightBlock({
  metric,
  primary,
  secondary,
  baselineMean,
  baselineSD,
  sessionStart,
  sessionEnd,
  primaryLabel,
  secondaryLabel,
}: {
  metric: MetricSpec
  primary: DataPoint[]
  secondary: DataPoint[]
  baselineMean: number | null
  baselineSD: number | null
  sessionStart: number
  sessionEnd: number
  primaryLabel?: string
  secondaryLabel?: string
}) {
  const overnightMedian = median(primary.map(p => p.value))
  const secondaryMedian = median(secondary.map(p => p.value))

  const deltaPct
    = overnightMedian != null && baselineMean != null && baselineMean > 0
      ? Math.round(((overnightMedian - baselineMean) / baselineMean) * 100)
      : null

  const binMs = 30 * 60 * 1000
  const bins: { t: number, value: number }[] = []
  for (let t = sessionStart; t < sessionEnd; t += binMs) {
    const slice = primary.filter(p => p.timestamp.getTime() >= t && p.timestamp.getTime() < t + binMs)
    const m = median(slice.map(p => p.value))
    if (m != null) bins.push({ t, value: m })
  }
  const bandLo = baselineMean != null && baselineSD != null ? baselineMean - baselineSD : null
  const bandHi = baselineMean != null && baselineSD != null ? baselineMean + baselineSD : null
  const inBand = (v: number) => bandLo == null || bandHi == null || (v >= bandLo && v <= bandHi)

  const maxBinValue = Math.max(1, ...bins.map(b => b.value), bandHi ?? 0)

  const footnoteParts = [
    deltaPct != null ? `${deltaPct >= 0 ? '+' : ''}${deltaPct}% vs typical` : null,
    typicalText(baselineMean, baselineSD, 'ms'),
    secondaryMedian != null ? `${secondaryLabel ?? 'Other side'} ${Math.round(secondaryMedian)} ms` : null,
  ].filter(Boolean)

  return (
    <ChartCard
      title={metric.title}
      trailing={(
        <>
          {primaryLabel && <span className="mr-1.5">{primaryLabel}</span>}
          <MetricValue value={overnightMedian != null ? Math.round(overnightMedian) : '--'} unit="ms" />
        </>
      )}
      footnote={footnoteParts.length > 0 ? footnoteParts.join(' · ') : undefined}
    >
      {bins.length > 0
        ? (
            <div className="flex h-14 items-end gap-0.5" aria-label="30-minute HRV medians">
              {bins.map(b => (
                <div
                  key={b.t}
                  className="flex-1 rounded-t-[2px]"
                  style={{
                    height: `${Math.max(2, (b.value / maxBinValue) * 56)}px`,
                    backgroundColor: metric.color,
                    opacity: inBand(b.value) ? 0.45 : 1,
                  }}
                  title={`${new Date(b.t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} — ${Math.round(b.value)} ms`}
                />
              ))}
            </div>
          )
        : <p className="py-4 text-center text-[15px] text-zinc-500">No HRV for this night.</p>}
    </ChartCard>
  )
}

// ── Week view ───────────────────────────────────────────────────────

interface NightStat {
  date: Date
  median: number
  q1: number
  q3: number
}

function computeNightStats(
  records: VitalsRecord[],
  sessions: SleepSession[],
  metric: 'hr' | 'hrv' | 'br',
): NightStat[] {
  if (sessions.length === 0) return []
  const stats: NightStat[] = []
  const field
    = metric === 'hr'
      ? 'heartRate'
      : metric === 'hrv' ? 'hrv' : 'breathingRate'
  for (const session of sessions) {
    const start = session.enteredBedAt.getTime()
    const end = (session.leftBedAt ?? new Date()).getTime()
    const vals: number[] = []
    for (const r of records) {
      const t = new Date(r.timestamp).getTime()
      if (t < start || t > end) continue
      const v = r[field]
      if (v != null) vals.push(v)
    }
    const s = summarise(vals)
    if (s) {
      stats.push({ date: session.enteredBedAt, median: s.median, q1: s.q1, q3: s.q3 })
    }
  }
  return stats
}

function WeekView({
  sortedRecords,
  otherSortedRecords,
  sessions,
  baseline,
  primaryLabel,
  secondaryLabel,
}: {
  sortedRecords: VitalsRecord[]
  otherSortedRecords: VitalsRecord[] | null
  sessions: SleepSession[]
  baseline: BaselineRow | null
  primaryLabel?: string
  secondaryLabel?: string
}) {
  if (sessions.length === 0) {
    return <EmptyVitals>No vitals recorded this week.</EmptyVitals>
  }

  return (
    <>
      {METRICS.map((metric) => {
        const primaryStats = computeNightStats(sortedRecords, sessions, metric.key)
        const secondaryStats = otherSortedRecords ? computeNightStats(otherSortedRecords, sessions, metric.key) : []
        const { mean, sd } = metricBaseline(metric.key, baseline)
        return (
          <WeekMetricCard
            key={metric.key}
            metric={metric}
            primaryStats={primaryStats}
            secondaryStats={secondaryStats}
            baselineMean={mean}
            baselineSD={sd}
            primaryLabel={primaryLabel}
            secondaryLabel={secondaryLabel}
          />
        )
      })}
    </>
  )
}

function WeekMetricCard({
  metric,
  primaryStats,
  secondaryStats,
  baselineMean,
  baselineSD,
  primaryLabel,
  secondaryLabel,
}: {
  metric: MetricSpec
  primaryStats: NightStat[]
  secondaryStats: NightStat[]
  baselineMean: number | null
  baselineSD: number | null
  primaryLabel?: string
  secondaryLabel?: string
}) {
  const allStats = [...primaryStats, ...secondaryStats]
  if (allStats.length === 0) {
    return (
      <ChartCard title={metric.title}>
        <p className="py-4 text-center text-[15px] text-zinc-500">No data this week.</p>
      </ChartCard>
    )
  }

  // Shared scale: extend domain to include the baseline band (if any) so the
  // band frames the dots rather than the dots framing the band.
  let domainLo = Math.min(...allStats.map(s => s.q1))
  let domainHi = Math.max(...allStats.map(s => s.q3))
  if (baselineMean != null && baselineSD != null) {
    domainLo = Math.min(domainLo, baselineMean - baselineSD)
    domainHi = Math.max(domainHi, baselineMean + baselineSD)
  }
  const range = domainHi - domainLo || 1
  domainLo -= range * 0.08
  domainHi += range * 0.08

  const scale = (v: number) => ((v - domainLo) / (domainHi - domainLo)) * 100 // %
  const typical = typicalText(baselineMean, baselineSD, metric.unit)

  return (
    <ChartCard
      title={metric.title}
      footnote={typical ? `Nightly median · ${typical}` : 'Nightly median'}
    >
      <div className="[&>*+*]:border-t [&>*+*]:border-zinc-800">
        {primaryStats.map((stat, idx) => {
          const otherStat = secondaryStats.find(s => s.date.getTime() === stat.date.getTime())
          return (
            <NightSummaryRow
              key={idx}
              stat={stat}
              otherStat={otherStat ?? null}
              color={metric.color}
              primaryLabel={primaryLabel}
              secondaryLabel={secondaryLabel}
              baselineMean={baselineMean}
              baselineSD={baselineSD}
              scale={scale}
              unit={metric.unit}
            />
          )
        })}
      </div>
    </ChartCard>
  )
}

function NightSummaryRow({
  stat,
  otherStat,
  color,
  primaryLabel,
  secondaryLabel,
  baselineMean,
  baselineSD,
  scale,
  unit,
}: {
  stat: NightStat
  otherStat: NightStat | null
  color: string
  primaryLabel?: string
  secondaryLabel?: string
  baselineMean: number | null
  baselineSD: number | null
  scale: (v: number) => number
  unit: string
}) {
  const outsideBand
    = baselineMean != null && baselineSD != null
      ? Math.abs(stat.median - baselineMean) > baselineSD
      : false

  const bandStart = baselineMean != null && baselineSD != null ? scale(baselineMean - baselineSD) : null
  const bandEnd = baselineMean != null && baselineSD != null ? scale(baselineMean + baselineSD) : null

  return (
    <div className="grid min-h-[36px] grid-cols-[84px_1fr_36px] items-center gap-2">
      <span className="ios-numeric text-[13px] text-zinc-500">
        {formatNightLabel(stat.date)}
      </span>
      <div className="relative h-5">
        {/* Baseline band */}
        {bandStart != null && bandEnd != null && (
          <div
            className="absolute inset-y-0.5 rounded-sm"
            style={{
              left: `${bandStart}%`,
              width: `${Math.max(0, bandEnd - bandStart)}%`,
              backgroundColor: color,
              opacity: 0.12,
            }}
          />
        )}
        {/* IQR bar */}
        <div
          className="absolute top-[8px] h-1 rounded-full"
          style={{
            left: `${scale(stat.q1)}%`,
            width: `${Math.max(2, scale(stat.q3) - scale(stat.q1))}%`,
            backgroundColor: color,
            opacity: 0.4,
          }}
          title={`${primaryLabel ?? 'IQR'}: ${Math.round(stat.q1)}–${Math.round(stat.q3)} ${unit}`}
        />
        {/* Primary median dot */}
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-zinc-900"
          style={{
            left: `${scale(stat.median)}%`,
            backgroundColor: outsideBand ? color : '#8E8E93',
          }}
          title={`${primaryLabel ?? 'Median'}: ${Math.round(stat.median)} ${unit}`}
        />
        {/* Secondary (other-side) median */}
        {otherStat && (
          <div
            className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-1 ring-zinc-900"
            style={{ left: `${scale(otherStat.median)}%` }}
            title={`${secondaryLabel ?? 'Other'}: ${Math.round(otherStat.median)} ${unit}`}
          />
        )}
      </div>
      <span className="ios-numeric text-right text-[15px] text-white">
        {Math.round(stat.median)}
      </span>
    </div>
  )
}
