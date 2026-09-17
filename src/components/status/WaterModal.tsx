'use client'

import { useState, useCallback, useMemo } from 'react'
import { trpc } from '@/src/utils/trpc'
import { X, Play, AlertTriangle, TrendingDown, TrendingUp, Minus, Loader2 } from 'lucide-react'
import { Sheet } from '@/src/ui/ios'

function trendIcon(trend: string) {
  if (trend === 'declining') return <TrendingDown size={14} className="text-amber-400" />
  if (trend === 'rising') return <TrendingUp size={14} className="text-emerald-400" />
  return <Minus size={14} className="text-zinc-500" />
}

/**
 * Water level + priming modal. Opens from the HealthCircle water status chip.
 * Contains: current level, 24h trend, 7-day chart, alerts, and prime controls.
 */
export function WaterModal({ open, onClose }: { open: boolean, onClose: () => void }) {
  const utils = trpc.useUtils()
  const [showPrimeConfirm, setShowPrimeConfirm] = useState(false)

  const { data: latest, isLoading } = trpc.waterLevel.getLatest.useQuery(
    {},
    { refetchInterval: 30_000, enabled: open },
  )

  const { data: trend } = trpc.waterLevel.getTrend.useQuery(
    { hours: 24 },
    { refetchInterval: 60_000, enabled: open },
  )

  const { data: history } = trpc.waterLevel.getHistory.useQuery(
    {
      // eslint-disable-next-line react-hooks/purity
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      limit: 10000,
    },
    { refetchInterval: 60_000, enabled: open },
  )

  const { data: alerts } = trpc.waterLevel.getAlerts.useQuery(
    {},
    { refetchInterval: 30_000, enabled: open },
  )

  const dismissAlertMutation = trpc.waterLevel.dismissAlert.useMutation({
    onSuccess: () => utils.waterLevel.getAlerts.invalidate(),
  })

  const startPrimeMutation = trpc.device.startPriming.useMutation({
    onSuccess: () => {
      setShowPrimeConfirm(false)
      utils.device.getStatus.invalidate()
    },
  })

  const handleDismissAlert = useCallback((id: number) => {
    dismissAlertMutation.mutate({ id })
  }, [dismissAlertMutation])

  const handleStartPrime = () => {
    startPrimeMutation.mutate({})
  }

  const activeAlerts = alerts ?? []

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Water & priming"
      leading={<span />}
      trailing={(
        <button type="button" onClick={onClose} className="text-[17px] font-semibold text-sky-400 active:opacity-50">
          Done
        </button>
      )}
    >
      <div className="space-y-6">
        {/* Current level + trend + 7-day chart */}
        <div className="rounded-xl bg-zinc-900 p-4">
          {isLoading
            ? (
                <div className="flex h-16 items-center justify-center">
                  <Loader2 size={20} className="animate-spin text-zinc-600" />
                </div>
              )
            : latest
              ? (
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[13px] text-zinc-500">Water level</p>
                      <p className={`text-[34px] font-bold leading-[41px] ${latest.level === 'ok' ? 'text-white' : 'text-amber-400'}`}>
                        {latest.level === 'ok' ? 'OK' : 'Low'}
                      </p>
                      <p className="ios-numeric text-[13px] text-zinc-500">
                        {'Updated '}
                        {new Date(latest.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    {trend && (
                      <div className="mb-1 flex items-center gap-1.5">
                        {trendIcon(trend.trend)}
                        <span className="text-[15px] text-zinc-500">
                          {trend.trend === 'stable' && 'Stable'}
                          {trend.trend === 'declining' && `Declining (${trend.lowPercent}% low)`}
                          {trend.trend === 'rising' && 'Rising'}
                          {trend.trend === 'unknown' && 'Insufficient data'}
                        </span>
                      </div>
                    )}
                  </div>
                )
              : (
                  <p className="text-[15px] text-zinc-500">No water level data</p>
                )}

          <div className="mt-4">
            <WaterLevelChart history={history} />
          </div>
        </div>

        {/* Active alerts */}
        {activeAlerts.length > 0 && (
          <section className="space-y-1.5">
            <h2 className="px-4 text-[13px] text-zinc-500">Alerts</h2>
            <div className="overflow-hidden rounded-xl bg-zinc-900 [&>*+*]:border-t [&>*+*]:border-zinc-800">
              {activeAlerts.map(alert => (
                <div key={alert.id} className="flex min-h-[44px] items-center gap-3 pl-4 pr-1">
                  <AlertTriangle size={18} className="shrink-0 text-amber-400" />
                  <span className="min-w-0 flex-1 py-2.5 text-[15px] text-white">{alert.message}</span>
                  <button
                    type="button"
                    onClick={() => handleDismissAlert(alert.id)}
                    disabled={dismissAlertMutation.isPending}
                    aria-label="Dismiss alert"
                    className="grid h-11 w-11 shrink-0 place-items-center text-zinc-500 active:opacity-50"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Prime controls */}
        <section className="space-y-1.5">
          {!showPrimeConfirm
            ? (
                <button
                  type="button"
                  onClick={() => setShowPrimeConfirm(true)}
                  className="flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 text-[17px] text-sky-400 active:bg-zinc-800"
                >
                  <Play size={18} />
                  Start prime
                </button>
              )
            : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleStartPrime}
                    disabled={startPrimeMutation.isPending}
                    className="flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-sky-500 text-[17px] font-semibold text-white active:opacity-80 disabled:opacity-50"
                  >
                    {startPrimeMutation.isPending
                      ? <Loader2 size={18} className="animate-spin" />
                      : <Play size={18} />}
                    Confirm prime
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPrimeConfirm(false)}
                    className="h-[44px] w-full text-[17px] text-sky-400 active:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
          <p className="px-4 text-[13px] leading-[18px] text-zinc-500">
            Priming circulates water through the system. It takes about 5 minutes.
          </p>
          {startPrimeMutation.isError && (
            <p className="px-4 text-[13px] text-red-400">
              {startPrimeMutation.error?.message ?? 'Failed to start prime'}
            </p>
          )}
        </section>
      </div>
    </Sheet>
  )
}

function WaterLevelChart({ history }: { history?: { timestamp: Date, level: string }[] }) {
  const points = useMemo(() => {
    if (!history || history.length < 2) return null
    const sorted = [...history].reverse()
    const values = sorted.map(r => ({
      ts: new Date(r.timestamp).getTime(),
      level: r.level === 'low' ? 30 : 80,
    }))
    const step = Math.max(1, Math.floor(values.length / 200))
    return values.filter((_, i) => i % step === 0 || i === values.length - 1)
  }, [history])

  const W = 300
  const H = 48
  const PAD = 2

  // Day labels — must be called before early return (rules-of-hooks)
  const dayLabels = useMemo(() => {
    if (!points || points.length < 2) return []
    const minTs = points[0].ts
    const maxTs = points[points.length - 1].ts
    const tsRange = maxTs - minTs || 1
    const toX = (ts: number) => PAD + ((ts - minTs) / tsRange) * (W - PAD * 2)

    const labels: { x: number, label: string }[] = []
    const seen = new Set<string>()
    for (const p of points) {
      const d = new Date(p.ts)
      const day = d.toLocaleDateString('en-US', { weekday: 'short' })
      if (!seen.has(day)) {
        seen.add(day)
        labels.push({ x: toX(p.ts), label: day })
      }
    }
    return labels
  }, [points, W, PAD])

  if (!points || points.length < 2) return null

  const minTs = points[0].ts
  const maxTs = points[points.length - 1].ts
  const tsRange = maxTs - minTs || 1

  const toX = (ts: number) => PAD + ((ts - minTs) / tsRange) * (W - PAD * 2)
  const toY = (level: number) => H - PAD - ((level - 10) / 90) * (H - PAD * 2)

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.ts).toFixed(1)},${toY(p.level).toFixed(1)}`)
    .join(' ')

  const areaD = `${pathD} L${toX(points[points.length - 1].ts).toFixed(1)},${H} L${toX(points[0].ts).toFixed(1)},${H} Z`

  const lastLevel = points[points.length - 1].level
  const color = lastLevel <= 30 ? '#FF9F0A' : '#0A84FF'

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="h-auto w-full">
        <defs>
          <linearGradient id="waterModalFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#waterModalFill)" />
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        {dayLabels.map((d, i) => (
          <text key={i} x={d.x} y={H + 14} fill="#8E8E93" fontSize="11" textAnchor="start">
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  )
}
