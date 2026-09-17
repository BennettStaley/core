/**
 * Backtest panel — the transparency centerpiece. Renders the server's replay of
 * a rule against real recorded history: the compared signal trace, its windowed
 * average, the threshold, fire/suppressed markers, and the resulting clamped
 * setpoint. Hand-built multi-layer SVG (ported from the design) for precise
 * control over the overlay. Two modes: edge-triggered and continuous policy.
 */
'use client'

import { useEffect, useState } from 'react'

import type { BacktestResult } from '@/src/automation/backtest'

export interface NightOption { sleepRecordId: number, label: string, date: string }

function minToClock(m: number): string {
  const h = Math.floor((m / 60) % 24)
  const mm = Math.floor(m % 60)
  const ap = h < 12 ? 'a' : 'p'
  let hh = h % 12
  if (hh === 0) hh = 12
  return `${hh}${mm ? `:${String(mm).padStart(2, '0')}` : ''}${ap}`
}

function Stat({ label, value, tone = 'zinc' }: { label: string, value: string, tone?: 'zinc' | 'red' | 'accent' }) {
  const color = tone === 'red' ? 'text-red-400' : tone === 'accent' ? 'text-sky-400' : 'text-white'
  return (
    <div className="flex min-h-[40px] min-w-0 items-center justify-between gap-3 px-3 py-2 sm:block sm:rounded-lg sm:bg-zinc-800/60">
      <div className="truncate text-[13px] leading-[18px] text-zinc-500">{label}</div>
      <div className={`ios-numeric truncate text-[15px] font-semibold sm:mt-0.5 sm:text-[17px] ${color}`}>{value}</div>
    </div>
  )
}

function NightPicker({ nights, nightId, onNight }: { nights: NightOption[], nightId: number | null, onNight: (id: number) => void }) {
  return (
    <div className="no-scrollbar -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
      {nights.map(n => (
        <button
          key={n.sleepRecordId}
          type="button"
          onClick={() => onNight(n.sleepRecordId)}
          aria-pressed={n.sleepRecordId === nightId}
          className={`min-h-[32px] shrink-0 whitespace-nowrap rounded-full px-3 text-[13px] transition-colors ${n.sleepRecordId === nightId ? 'bg-sky-500 font-semibold text-white' : 'bg-zinc-800 text-zinc-300 active:bg-zinc-700'}`}
        >
          {n.label}
          {' '}
          <span className="opacity-70">{n.date}</span>
        </button>
      ))}
    </div>
  )
}

/** Measures its box so the SVG is drawn 1:1 in CSS pixels (legible 11px labels on phones). */
function useBoxWidth(fallback: number) {
  const [width, setWidth] = useState(fallback)
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!node) return
    const update = () => setWidth(Math.max(260, Math.round(node.clientWidth)))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(node)
    return () => ro.disconnect()
  }, [node])
  return [setNode, width] as const
}

function Chart({ r }: { r: BacktestResult }) {
  const [ref, width] = useBoxWidth(660)
  return <div ref={ref}><ChartSvg r={r} W={width} /></div>
}

function ChartSvg({ r, W }: { r: BacktestResult, W: number }) {
  const N = r.clockMin.length
  if (N < 2) return <div className="px-2 py-8 text-center text-[15px] text-zinc-500">Not enough data in this window to replay.</div>

  // Policy overlays ambient + setpoint on one shared temperature scale.
  const policy = r.mode === 'policy'

  const mL = 34, mR = 36, mT = 14
  const iw = W - mL - mR
  // Edge mode reserves a dedicated event rail beneath the plot so the plot
  // itself stays clean at any event density; policy keeps the original layout.
  const plotH = 152
  const ih = policy ? plotH : plotH - 2
  const railGap = 8
  const railH = 14
  const railTop = mT + ih + railGap
  const railBottom = railTop + railH
  const labelY = policy ? mT + ih + 16 : railBottom + 11
  const H = policy ? mT + ih + 22 : labelY + 5
  const x = (i: number) => mL + (i / (N - 1)) * iw
  const stepX = iw / (N - 1)
  const primA = r.primaryAxis
  const tempA = r.tempAxis ?? { min: 60, max: 80 }
  const sharedMin = policy ? Math.min(primA?.min ?? tempA.min, tempA.min) : tempA.min
  const sharedMax = policy ? Math.max(primA?.max ?? tempA.max, tempA.max) : tempA.max

  const yPrimary = (v: number) => {
    const a = policy ? { min: sharedMin, max: sharedMax } : (primA ?? { min: 0, max: 1 })
    return mT + ih - ((v - a.min) / (a.max - a.min || 1)) * ih
  }
  const yTemp = (v: number) => {
    const lo = policy ? sharedMin : tempA.min
    const hi = policy ? sharedMax : tempA.max
    return mT + ih - ((v - lo) / (hi - lo || 1)) * ih
  }

  const linePath = (arr: (number | null)[], yf: (v: number) => number) => {
    let d = ''
    let pen = false
    arr.forEach((v, i) => {
      if (v == null) {
        pen = false
        return
      }
      d += `${pen ? 'L' : 'M'} ${x(i).toFixed(1)} ${yf(v).toFixed(1)} `
      pen = true
    })
    return d.trim()
  }
  // setpoint as a step line
  const stepPath = (() => {
    let d = ''
    let prev: number | null = null
    r.setpoint.forEach((v, i) => {
      if (v == null) {
        prev = null
        return
      }
      const px = x(i).toFixed(1)
      if (prev == null) d += `M ${px} ${yTemp(v).toFixed(1)} `
      else d += `L ${px} ${yTemp(prev).toFixed(1)} L ${px} ${yTemp(v).toFixed(1)} `
      prev = v
    })
    return d.trim()
  })()

  // time ticks at ~6 even index positions
  const tickCount = W < 480 ? 4 : 6
  const tickIdx = Array.from({ length: tickCount }, (_, k) => Math.round((k / (tickCount - 1)) * (N - 1)))

  // Collapse consecutive suppressed indices into cooldown runs so a dense
  // burst reads as a single band rather than N stacked marks (edge only).
  const cooldownBands: Array<[number, number]> = (() => {
    if (policy || r.suppressed.length === 0) return []
    const sorted = [...r.suppressed].sort((a, b) => a - b)
    const runs: Array<[number, number]> = []
    let s = sorted[0]
    let p = sorted[0]
    for (let k = 1; k < sorted.length; k++) {
      const i = sorted[k]
      if (i === p + 1) {
        p = i
        continue
      }
      runs.push([s, p])
      s = i
      p = i
    }
    runs.push([s, p])
    return runs
  })()

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((g, i) => (
          <line key={i} x1={mL} x2={W - mR} y1={mT + ih * g} y2={mT + ih * g} stroke="#2C2C2E" strokeWidth="1" />
        ))}
        {tickIdx.map((idx, i) => (
          <g key={i}>
            <line x1={x(idx)} x2={x(idx)} y1={mT} y2={mT + ih} stroke="#242426" strokeWidth="1" />
            <text x={x(idx)} y={labelY} textAnchor="middle" className="mono" style={{ fontSize: 11, fill: '#8E8E93' }}>{minToClock(r.clockMin[idx])}</text>
          </g>
        ))}

        {/* time-window shade */}
        {r.timeWindow && (() => {
          const win = r.timeWindow
          if (!win) return null
          const inWin = r.clockMin.map(m => isIn(m, win))
          // draw contiguous shaded spans
          const spans: Array<[number, number]> = []
          let s = -1
          inWin.forEach((on, i) => {
            if (on && s < 0) s = i
            if (!on && s >= 0) {
              spans.push([s, i - 1])
              s = -1
            }
          })
          if (s >= 0) spans.push([s, N - 1])
          return spans.map(([a, b], i) => (
            <rect key={i} x={x(a)} y={mT} width={Math.max(1, x(b) - x(a))} height={ih} fill="rgba(255,255,255,0.02)" />
          ))
        })()}

        {/* cooldown bands — one rect per suppressed run, padded half a step */}
        {cooldownBands.map(([a, b], k) => {
          const x0 = Math.max(mL, x(a) - stepX / 2)
          const x1 = Math.min(W - mR, x(b) + stepX / 2)
          return <rect key={`cb${k}`} x={x0} y={mT} width={Math.max(1, x1 - x0)} height={ih} fill="#71717a" opacity="0.07" />
        })}

        {/* policy clamp band */}
        {policy && r.clamp && (
          <>
            <rect x={mL} y={yTemp(r.clamp.max)} width={iw} height={Math.max(0, yTemp(r.clamp.min) - yTemp(r.clamp.max))} fill="color-mix(in srgb, var(--accent) 6%, transparent)" />
            <line x1={mL} x2={W - mR} y1={yTemp(r.clamp.max)} y2={yTemp(r.clamp.max)} stroke="var(--accent)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <line x1={mL} x2={W - mR} y1={yTemp(r.clamp.min)} y2={yTemp(r.clamp.min)} stroke="var(--accent)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
          </>
        )}

        {/* fire zone — faint red tint above the threshold (edge) */}
        {!policy && r.threshold != null && r.primaryAxis && (
          <rect x={mL} y={mT} width={iw} height={Math.max(0, yPrimary(r.threshold) - mT)} fill="#ef4444" opacity="0.05" />
        )}

        {/* threshold (edge) */}
        {!policy && r.threshold != null && r.primaryAxis && (
          <>
            <line x1={mL} x2={W - mR} y1={yPrimary(r.threshold)} y2={yPrimary(r.threshold)} stroke="#ef4444" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.6" />
            <text x={W - mR + 3} y={yPrimary(r.threshold) + 3} className="mono" style={{ fontSize: 11, fill: '#ef4444' }}>{r.threshold}</text>
          </>
        )}

        {/* primary raw trace — soft hairline behind the avg (edge) */}
        {r.primary && <path d={linePath(r.primary.values, yPrimary)} fill="none" stroke="#3f3f46" strokeWidth={policy ? 1.3 : 1} opacity={policy ? 1 : 0.5} />}
        {/* policy raw (pre-clamp) ghost */}
        {policy && r.setpointRaw && <path d={linePath(r.setpointRaw, yTemp)} fill="none" stroke="#52525b" strokeWidth="1" strokeDasharray="3 3" />}
        {/* windowed avg — brightest, heaviest trace (edge) */}
        {r.avg && <path d={linePath(r.avg.values, yPrimary)} fill="none" stroke={policy ? '#d4d4d8' : '#fafafa'} strokeWidth={policy ? 1.8 : 2} />}

        {/* setpoint */}
        <path d={policy ? linePath(r.setpoint, yTemp) : stepPath} fill="none" stroke="var(--accent)" strokeWidth="2.1" />

        {/* fire dots on the avg curve (edge) */}
        {!policy && r.fires.map((i, k) => {
          const yv = r.avg?.values[i] ?? r.primary?.values[i] ?? null
          return yv == null
            ? null
            : <circle key={`f${k}`} cx={x(i)} cy={yPrimary(yv)} r="4" fill="#ef4444" stroke="#0a0a0b" strokeWidth="1.5" />
        })}

        {/* event rail — carries all event density so the plot stays clean (edge) */}
        {!policy && (
          <g>
            <rect x={mL} y={railTop} width={iw} height={railH} rx={3} fill="#2C2C2E" stroke="none" strokeWidth="1" />
            {r.suppressed.map((i, k) => (
              <line key={`rs${k}`} x1={x(i)} x2={x(i)} y1={railTop + 3.5} y2={railBottom - 3.5} stroke="#52525b" strokeWidth="1" opacity="0.8" />
            ))}
            {r.fires.map((i, k) => (
              <line key={`rf${k}`} x1={x(i)} x2={x(i)} y1={railTop + 1.5} y2={railBottom - 1.5} stroke="#ef4444" strokeWidth="1.8" />
            ))}
          </g>
        )}

        {/* axes labels */}
        {!policy && r.primaryAxis && (
          <>
            <text x={mL - 5} y={yPrimary(r.primaryAxis.max) + 3} textAnchor="end" className="mono" style={{ fontSize: 11, fill: '#8E8E93' }}>{Math.round(r.primaryAxis.max)}</text>
            <text x={mL - 5} y={yPrimary(r.primaryAxis.min) - 1} textAnchor="end" className="mono" style={{ fontSize: 11, fill: '#8E8E93' }}>{Math.round(r.primaryAxis.min)}</text>
          </>
        )}
        <text x={W - mR + 3} y={yTemp(policy ? sharedMax : tempA.max) + 8} className="mono" style={{ fontSize: 11, fill: 'var(--accent)' }}>
          {Math.round(policy ? sharedMax : tempA.max)}
          °
        </text>
        <text x={W - mR + 3} y={yTemp(policy ? sharedMin : tempA.min)} className="mono" style={{ fontSize: 11, fill: 'var(--accent)' }}>
          {Math.round(policy ? sharedMin : tempA.min)}
          °
        </text>
      </svg>
    </div>
  )
}

function isIn(nowMin: number, w: { startMin: number, endMin: number }): boolean {
  if (w.startMin === w.endMin) return false
  if (w.startMin < w.endMin) return nowMin >= w.startMin && nowMin < w.endMin
  return nowMin >= w.startMin || nowMin < w.endMin
}

export function BacktestPanel({
  result, loading, message, nights, nightId, onNight,
}: {
  result: BacktestResult | null
  loading: boolean
  message?: string
  nights: NightOption[]
  nightId: number | null
  onNight: (id: number) => void
}) {
  const r = result
  return (
    <div>
      <div className="mb-3 space-y-2 md:flex md:flex-wrap md:items-center md:justify-between md:gap-2 md:space-y-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[17px] font-semibold text-white">Backtest</span>
          {r && <span className="text-[13px] text-zinc-500">{r.mode === 'policy' ? 'Continuous policy' : 'Edge-triggered'}</span>}
        </div>
        <NightPicker nights={nights} nightId={nightId} onNight={onNight} />
      </div>

      {loading && <div className="grid h-[180px] place-items-center text-[15px] text-zinc-500">Replaying…</div>}
      {!loading && message && <div className="py-6 text-center text-[15px] leading-5 text-zinc-500">{message}</div>}
      {!loading && !message && r && (
        <>
          <Chart r={r} />
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-zinc-500">
            {r.avg && <Legend swatch={r.mode === 'edge' ? '#fafafa' : '#d4d4d8'}>{r.avg.label}</Legend>}
            {r.primary && <Legend swatch="#3f3f46">{r.mode === 'policy' ? r.primary.label.toLowerCase() : `raw ${r.primary.label.toLowerCase()}`}</Legend>}
            {r.mode === 'policy' && r.setpointRaw && <Legend dashed swatch="#52525b">pre-clamp</Legend>}
            {r.mode === 'edge' && r.threshold != null && <Legend dashed swatch="#ef4444">threshold</Legend>}
            <Legend swatch="var(--accent)">setpoint</Legend>
            {r.mode === 'edge' && (
              <>
                <Dot color="#ef4444">fired</Dot>
                <Tick color="#52525b">suppressed</Tick>
                <Block color="#71717a">cooldown</Block>
              </>
            )}
          </div>
          <div className="mt-3 overflow-hidden rounded-lg bg-zinc-800/60 sm:grid sm:grid-cols-3 sm:gap-2 sm:bg-transparent [&>*+*]:border-t [&>*+*]:border-zinc-700/50 sm:[&>*+*]:border-t-0">
            {r.mode === 'policy'
              ? (
                  <>
                    <Stat label="Mode" value="Continuous" tone="accent" />
                    <Stat label="Clamp hits" value={`${r.summary.clampHits}×`} tone={r.summary.clampHits ? 'red' : 'zinc'} />
                    <Stat label="Setpoint range" value={r.summary.setpointRange ? `${Math.round(r.summary.setpointRange[0])}–${Math.round(r.summary.setpointRange[1])}°F` : '—'} />
                  </>
                )
              : (
                  <>
                    <Stat label="Would fire" value={`${r.summary.wouldFire}×`} tone="red" />
                    <Stat label="Suppressed (cooldown)" value={`${r.summary.suppressed}×`} />
                    <Stat label="Net effect" value={r.summary.netEffect ?? '—'} tone="accent" />
                  </>
                )}
          </div>
        </>
      )}
    </div>
  )
}

function Legend({ swatch, dashed, children }: { swatch: string, dashed?: boolean, children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-0.5 w-4 rounded ${dashed ? 'border-t border-dashed' : ''}`} style={dashed ? { borderColor: swatch } : { background: swatch }} />
      {children}
    </span>
  )
}
function Dot({ color, children }: { color: string, children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {children}
    </span>
  )
}
function Tick({ color, children }: { color: string, children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-0.5" style={{ background: color }} />
      {children}
    </span>
  )
}
function Block({ color, children }: { color: string, children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-3 rounded-sm" style={{ background: color, opacity: 0.18 }} />
      {children}
    </span>
  )
}
