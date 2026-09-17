/**
 * Diagnostics / status panel — live Autopilot state and the audit trail. Global
 * kill-switch, a per-rule group (status, last fire, fires today, dry-run switch),
 * and the run log: every evaluation that mattered, which is the transparency
 * Eight Sleep's black box lacks.
 */
'use client'

import type { ReactNode } from 'react'
import { Icon } from './icons'
import { Badge, SideBadge, StatusBadge, Toggle } from './primitives'
import { formatSetpointF } from '@/src/lib/tempUtils'

export interface RuleStatus {
  id: number
  name: string
  enabled: boolean
  dryRun: boolean
  side: 'left' | 'right' | null
  cooldownMin: number | null
  lastOutcome: string | null
  lastFiredAt: Date | string | null
  firesToday: number
}

export interface RunRow {
  id: number
  automationId: number
  ruleName: string | null
  firedAt: Date | string
  outcome: 'fired' | 'skipped' | 'clamped' | 'dry_run' | 'error'
  detail: unknown
}

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d)
}

function ago(d: Date | string | null): string {
  if (!d) return 'never'
  const ms = Date.now() - toDate(d).getTime()
  if (ms < 60_000) return 'just now'
  const m = Math.floor(ms / 60_000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function hhmm(d: Date | string): string {
  const x = toDate(d)
  return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`
}

function statusMode(r: RuleStatus): 'active' | 'dryrun' | 'paused' {
  if (!r.enabled) return 'paused'
  return r.dryRun ? 'dryrun' : 'active'
}

function verdictTone(v: RunRow['outcome']): 'red' | 'zinc' | 'amber' {
  if (v === 'fired' || v === 'clamped') return 'red'
  if (v === 'dry_run') return 'amber'
  return 'zinc'
}

function verdictLabel(v: RunRow['outcome']): string {
  const s = v.replace('_', ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

interface ActionDetail { kind?: string, side?: string, temp?: number, on?: boolean, sent?: boolean, dryRun?: boolean, clamped?: boolean, antiThrash?: boolean, skipped?: string, notified?: boolean }
function actionText(detail: unknown): string {
  if (!detail || typeof detail !== 'object') return ''
  const d = detail as { actions?: ActionDetail[], reason?: string }
  if (d.reason) return d.reason.replace(/-/g, ' ')
  const a = d.actions?.[0]
  if (!a) return ''
  if (a.kind === 'notify') return 'notify'
  if (a.kind === 'setPower') return `power ${a.on ? 'on' : 'off'}`
  if (a.kind === 'setTemperature') {
    if (a.skipped) return a.skipped.replace(/-/g, ' ')
    const verb = a.sent ? 'set' : a.dryRun ? 'would set' : a.antiThrash ? 'held' : 'set'
    return a.temp != null ? `${verb} ${formatSetpointF(a.temp, 'F')}${a.clamped ? ' (clamped)' : ''}` : verb
  }
  return a.kind ?? ''
}

function GroupHeader({ children }: { children: ReactNode }) {
  return <h2 className="px-4 text-[13px] leading-[18px] text-zinc-500">{children}</h2>
}

function ValueRow({ label, value }: { label: string, value: ReactNode }) {
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-3 px-4">
      <span className="text-[17px] text-white">{label}</span>
      <span className="ios-numeric truncate text-right text-[17px] text-zinc-500">{value}</span>
    </div>
  )
}

function RuleStatusCard({ a, onDry }: { a: RuleStatus, onDry: (id: number, dryRun: boolean) => void }) {
  return (
    <div className="overflow-hidden rounded-xl bg-zinc-900 [&>*+*]:border-t [&>*+*]:border-zinc-800">
      <div className="px-4 py-3">
        <div className="truncate text-[17px] font-semibold leading-[22px] text-white">{a.name}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3">
          <StatusBadge mode={statusMode(a)} />
          <SideBadge side={a.side} />
        </div>
      </div>
      <div className="flex min-h-[44px] items-center justify-between gap-3 px-4 py-1.5">
        <span className="text-[17px] text-white">Dry run</span>
        <Toggle checked={a.dryRun} onChange={() => onDry(a.id, !a.dryRun)} aria-label={`${a.name} dry run`} />
      </div>
      <ValueRow label="Last outcome" value={a.lastOutcome ?? '—'} />
      <ValueRow label="Last fired" value={ago(a.lastFiredAt)} />
      <ValueRow label="Today" value={`${a.firesToday} fire${a.firesToday === 1 ? '' : 's'}`} />
      <ValueRow label="Cooldown" value={a.cooldownMin ? `${a.cooldownMin} min` : 'None'} />
    </div>
  )
}

function RunLog({ runs }: { runs: RunRow[] }) {
  return (
    <section className="space-y-1.5">
      <GroupHeader>Run log</GroupHeader>
      <div className="overflow-hidden rounded-xl bg-zinc-900">
        {runs.length === 0 && (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <Icon.List size={28} className="mb-2 text-zinc-600" />
            <div className="text-[17px] font-semibold text-white">No evaluations yet</div>
            <div className="mt-1 text-[15px] leading-5 text-zinc-500">Every evaluation that fires, skips or gets clamped shows up here.</div>
          </div>
        )}

        {/* phone: list rows */}
        {runs.length > 0 && (
          <div className="max-h-[520px] overflow-y-auto md:hidden [&>*+*]:border-t [&>*+*]:border-zinc-800">
            {runs.map(r => (
              <div key={r.id} className="flex min-h-[44px] items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[17px] leading-[22px] text-white">{r.ruleName ?? `Rule ${r.automationId}`}</div>
                  <div className={`truncate text-[13px] leading-[18px] ${r.outcome === 'fired' ? 'text-sky-400' : 'text-zinc-500'}`}>{actionText(r.detail) || '—'}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="ios-numeric text-[15px] text-zinc-500">{hhmm(r.firedAt)}</div>
                  <Badge tone={verdictTone(r.outcome)} dot>{verdictLabel(r.outcome)}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* md+: table */}
        {runs.length > 0 && (
          <div className="hidden max-h-[420px] overflow-y-auto md:block">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-zinc-900">
                <tr className="text-[13px] text-zinc-500">
                  <th className="px-4 py-2 font-normal">Time</th>
                  <th className="px-2 py-2 font-normal">Rule</th>
                  <th className="px-2 py-2 font-normal">Verdict</th>
                  <th className="px-4 py-2 font-normal">Action or reason</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.id} className="border-t border-zinc-800 hover:bg-zinc-800/40">
                    <td className="ios-numeric whitespace-nowrap px-4 py-2.5 text-[15px] text-zinc-400">{hhmm(r.firedAt)}</td>
                    <td className="px-2 py-2.5 text-[15px] text-white">{r.ruleName ?? `Rule ${r.automationId}`}</td>
                    <td className="px-2 py-2.5"><Badge tone={verdictTone(r.outcome)} dot>{verdictLabel(r.outcome)}</Badge></td>
                    <td className={`whitespace-nowrap px-4 py-2.5 text-[15px] ${r.outcome === 'fired' ? 'text-sky-400' : 'text-zinc-500'}`}>{actionText(r.detail)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

export function StatusPanel({ globalEnabled, onKill, rules, runs, loading, onDry }: {
  globalEnabled: boolean
  onKill: (enabled: boolean) => void
  rules: RuleStatus[]
  runs: RunRow[]
  loading: boolean
  onDry: (id: number, dryRun: boolean) => void
}) {
  const killed = !globalEnabled
  return (
    <div className="flex h-full flex-col">
      <div className="hidden border-b border-zinc-800 px-5 py-4 md:block">
        <h1 className="text-[22px] font-bold leading-7 text-white">Diagnostics</h1>
        <p className="text-[13px] text-zinc-500">Live Autopilot state and audit trail</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto md:p-5">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="space-y-1.5">
            <div className="overflow-hidden rounded-xl bg-zinc-900">
              <div className="flex min-h-[60px] items-center gap-3 px-4 py-2">
                <span className={`grid h-[29px] w-[29px] shrink-0 place-items-center rounded-[7px] text-white ${killed ? 'bg-red-500' : 'bg-emerald-500'}`}>
                  <Icon.Power size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[17px] leading-[22px] text-white">Autopilot</div>
                  <div className={`text-[13px] leading-[18px] ${killed ? 'text-red-400' : 'text-zinc-500'}`}>{killed ? 'Halted, all rules suspended' : 'Running'}</div>
                </div>
                <Toggle checked={!killed} onChange={() => onKill(killed)} aria-label="Autopilot kill switch" />
              </div>
            </div>
            <p className="px-4 text-[13px] leading-[18px] text-zinc-500">
              {killed
                ? 'Kill switch engaged. No rule will command hardware; manual control only.'
                : 'Turn off to immediately stop every rule from touching the bed.'}
            </p>
          </section>

          {loading
            ? <div className="py-16 text-center text-[15px] text-zinc-500">Loading status…</div>
            : (
                <>
                  {rules.length > 0 && (
                    <section className="space-y-1.5">
                      <GroupHeader>Rules</GroupHeader>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {rules.map(a => <RuleStatusCard key={a.id} a={a} onDry={onDry} />)}
                      </div>
                    </section>
                  )}
                  <RunLog runs={runs} />
                </>
              )}
        </div>
      </div>
    </div>
  )
}
