/**
 * Rule editor. On phones it is an iOS page sheet (Cancel / title / Save bar,
 * grouped When / If / Then cards, then the live "reads as" sentence and the
 * backtest). From md up it is full-screen and two-pane. The backtest re-runs
 * against real history as you edit. Local state until explicit Save.
 */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { trpc } from '@/src/utils/trpc'
import { Icon, type IconName } from './icons'
import { Button, Card, NumberField, SectionLabel, Segmented, Select, Toggle } from './primitives'
import { BacktestPanel } from './BacktestPanel'
import { CapZoneViz } from './CapZoneViz'
import {
  AGGS,
  type BuilderRule,
  buildSentence,
  DEFAULT_CLAMP,
  fmtClock,
  type IfSpec,
  parseExpr,
  SIGNALS,
  sigUnit,
  type ThenSpec,
  toAST,
  UI_OPS,
  type UiOp,
  type WhenSpec,
} from './builderModel'

function clone(r: BuilderRule): BuilderRule {
  return JSON.parse(JSON.stringify(r))
}

const numSignalOpts = SIGNALS.map(s => ({ value: s.id, label: s.label, icon: s.icon as IconName }))

// ---------- live sentence preview ----------
function SentencePreview({ rule }: { rule: BuilderRule }) {
  const chunks = buildSentence(rule)
  return (
    <section className="space-y-1.5">
      <h3 className="px-4 text-[13px] leading-[18px] text-zinc-500">Reads as</h3>
      <Card className="px-4 py-3">
        <p className="text-[17px] leading-[24px] text-zinc-300" style={{ textWrap: 'pretty' }}>
          {chunks.map((c, i) => (
            <span key={i} className={c.hot ? 'font-medium text-sky-400' : ''}>{c.text}</span>
          ))}
        </p>
      </Card>
    </section>
  )
}

const TimeField = ({ value, onChange }: { value: string, onChange: (v: string) => void }) => {
  const hours = Array.from({ length: 24 }, (_, h) => ({ value: `${String(h).padStart(2, '0')}:00`, label: fmtClock(`${String(h).padStart(2, '0')}:00`) }))
  return <Select chip value={value} options={hours} onChange={onChange} />
}

// ---------- WHEN ----------
function WhenEditor({ rule, set }: { rule: BuilderRule, set: (r: BuilderRule) => void }) {
  const w = rule.when
  const setW = (patch: Partial<WhenSpec>) => set({ ...rule, when: { ...w, ...patch } as WhenSpec })
  const types = [
    { value: 'agg', label: 'Aggregate' },
    { value: 'cond', label: 'Threshold' },
    { value: 'change', label: 'Change' },
    { value: 'time', label: 'Time' },
  ] as const
  const switchType = (t: WhenSpec['type']) => {
    if (t === 'agg') set({ ...rule, when: { type: 'agg', agg: 'avg', signal: '{side}.movement', window: 10, op: '>', value: 200 } })
    if (t === 'cond') set({ ...rule, when: { type: 'cond', signal: '{side}.heartRate', op: '>', value: 60 } })
    if (t === 'change') set({ ...rule, when: { type: 'change', signal: 'water.low' } })
    if (t === 'time') set({ ...rule, when: { type: 'time', between: ['23:00', '06:00'] } })
  }

  return (
    <Card className="p-4">
      <SectionLabel kicker="When" color="#0A84FF" icon="Zap" desc="The trigger that starts evaluation" />
      <div className="mb-3"><Segmented full value={w.type} options={types} onChange={switchType} /></div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[15px] text-zinc-400">
        {w.type === 'agg' && (
          <>
            <Select chip value={w.agg} options={[...AGGS]} onChange={v => setW({ agg: v as WhenSpec extends { agg: infer A } ? A : never })} />
            <span>of</span>
            <Select chip value={w.signal} options={numSignalOpts} onChange={v => setW({ signal: v })} />
            <Select chip value={w.op} options={['>', '≥', '<', '≤']} onChange={v => setW({ op: v as UiOp })} />
            <NumberField value={w.value} step={10} onChange={v => setW({ value: v })} width={92} />
            <span>over the last</span>
            <NumberField value={w.window} step={5} suffix="minutes" onChange={v => setW({ window: Math.max(1, v) })} width={84} />
          </>
        )}
        {w.type === 'cond' && (
          <>
            <Select chip value={w.signal} options={numSignalOpts} onChange={v => setW({ signal: v })} />
            <Select chip value={w.op} options={[...UI_OPS]} onChange={v => setW({ op: v as UiOp })} />
            <NumberField value={w.value} step={1} onChange={v => setW({ value: v })} width={92} />
            <span className="text-zinc-500">{sigUnit(w.signal)}</span>
          </>
        )}
        {w.type === 'change' && (
          <>
            <Select chip value={w.signal} options={numSignalOpts} onChange={v => setW({ signal: v })} />
            <span>changes</span>
          </>
        )}
        {w.type === 'time' && (
          <>
            <span>between</span>
            <TimeField value={w.between[0]} onChange={v => setW({ between: [v, w.between[1]] })} />
            <span>and</span>
            <TimeField value={w.between[1]} onChange={v => setW({ between: [w.between[0], v] })} />
          </>
        )}
      </div>
    </Card>
  )
}

// ---------- IF ----------
function IfEditor({ rule, set }: { rule: BuilderRule, set: (r: BuilderRule) => void }) {
  const ifs = rule.ifs
  const setIfs = (arr: IfSpec[]) => set({ ...rule, ifs: arr })
  const add = (kind: 'time' | 'cond') => {
    if (kind === 'time') setIfs([...ifs, { type: 'time', between: ['23:00', '06:00'] }])
    else setIfs([...ifs, { type: 'cond', signal: '{side}.currentTemperature', op: '>', value: 75 }])
  }
  const upd = (i: number, patch: Partial<IfSpec>) => setIfs(ifs.map((c, k) => k === i ? { ...c, ...patch } as IfSpec : c))
  const del = (i: number) => setIfs(ifs.filter((_, k) => k !== i))

  return (
    <Card className="p-4">
      <SectionLabel kicker="If" color="#636366" icon="Shield" desc="Extra conditions, all must hold" right={<span className="text-[13px] text-zinc-500">Optional</span>} />
      {ifs.length === 0 && <div className="mb-3 text-[15px] text-zinc-500">No conditions. Fires whenever the trigger hits.</div>}
      <div className="mb-3 flex flex-col gap-2">
        {ifs.map((c, i) => (
          <div key={i} className="flex items-center gap-1 rounded-lg bg-zinc-800/50 py-1.5 pl-3 pr-0">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span className="mr-0.5 text-[13px] text-zinc-500">and</span>
              {c.type === 'time'
                ? (
                    <>
                      <span className="text-[15px] text-zinc-400">it&apos;s between</span>
                      <TimeField value={c.between[0]} onChange={v => upd(i, { between: [v, c.between[1]] })} />
                      <span className="text-[15px] text-zinc-400">and</span>
                      <TimeField value={c.between[1]} onChange={v => upd(i, { between: [c.between[0], v] })} />
                    </>
                  )
                : (
                    <>
                      <Select chip value={c.signal} options={numSignalOpts} onChange={v => upd(i, { signal: v })} />
                      <Select chip value={c.op} options={[...UI_OPS]} onChange={v => upd(i, { op: v as UiOp })} />
                      <NumberField value={c.value} step={1} onChange={v => upd(i, { value: v })} width={88} />
                    </>
                  )}
            </div>
            <button type="button" onClick={() => del(i)} aria-label="Remove condition" className="grid h-11 w-11 shrink-0 place-items-center text-zinc-500 active:text-red-400 hover:text-red-400"><Icon.X size={16} /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => add('time')}>
          <Icon.Clock size={15} />
          Time window
        </Button>
        <Button variant="outline" size="sm" onClick={() => add('cond')}>
          <Icon.Plus size={15} />
          Condition
        </Button>
      </div>
    </Card>
  )
}

// ---------- THEN ----------
function ThenEditor({ rule, set, liveAmbient }: { rule: BuilderRule, set: (r: BuilderRule) => void, liveAmbient: number | null }) {
  const a = rule.then[0]
  const setA = (patch: Partial<ThenSpec>) => set({ ...rule, then: [{ ...a, ...patch } as ThenSpec, ...rule.then.slice(1)] })
  const isTemp = a.action === 'setTemperature'
  const isExpr = isTemp && a.expr != null
  const clamp = isTemp ? a.clamp : DEFAULT_CLAMP

  const exprEval = useMemo(() => {
    if (!isTemp || a.expr == null || liveAmbient == null) return null
    const parsed = parseExpr(a.expr, rule.side)
    if (!parsed) return null
    // Only the ambient-relative form has a live readout in the editor.
    const m = /^\s*ambient\s*([+-])\s*(\d+(?:\.\d+)?)\s*$/i.exec(a.expr)
    const raw = m ? liveAmbient + (m[1] === '-' ? -1 : 1) * Number(m[2]) : (/^\s*ambient\s*$/i.test(a.expr) ? liveAmbient : null)
    if (raw == null) return null
    return Math.min(clamp[1], Math.max(clamp[0], raw))
  }, [isTemp, a, liveAmbient, rule.side, clamp])

  return (
    <Card className="p-4">
      <SectionLabel kicker="Then" color="#30D158" icon="Play" desc="What Autopilot does when it fires" />
      <div className="flex items-center gap-2 mb-3">
        <Select
          chip
          value={a.action}
          options={[{ value: 'setTemperature', label: 'Set temperature' }, { value: 'setPower', label: 'Set power' }, { value: 'notify', label: 'Notify' }]}
          onChange={(v) => {
            if (v === 'setTemperature') setA({ action: 'setTemperature', delta: -2, revert: undefined, expr: undefined, clamp: [...DEFAULT_CLAMP] } as ThenSpec)
            else if (v === 'setPower') setA({ action: 'setPower', on: false } as ThenSpec)
            else setA({ action: 'notify', message: '' } as ThenSpec)
          }}
        />
      </div>

      {isTemp && (
        <div className="flex flex-col gap-3">
          <Segmented full value={isExpr ? 'expr' : 'amount'} options={[{ value: 'amount', label: 'By amount' }, { value: 'expr', label: 'Expression' }]} onChange={v => v === 'expr' ? setA({ expr: 'ambient + 3', delta: undefined, revert: undefined }) : setA({ expr: undefined, delta: -2 })} />

          {!isExpr && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 text-[15px] text-zinc-400">
                <Select chip value={(a.delta ?? -2) < 0 ? 'lower' : 'raise'} options={['lower', 'raise']} onChange={v => setA({ delta: (v === 'lower' ? -1 : 1) * Math.abs(a.delta ?? 2) })} />
                <span>by</span>
                <NumberField value={Math.abs(a.delta ?? 2)} step={1} suffix="°F" onChange={v => setA({ delta: ((a.delta ?? -2) < 0 ? -1 : 1) * Math.max(0, v) })} width={84} />
              </div>
              <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-3">
                <span className="text-[17px] text-white">Revert after</span>
                <span className="flex items-center gap-3">
                  {a.revert ? <NumberField value={a.revert} step={5} suffix="min" onChange={v => setA({ revert: Math.max(1, v) })} width={64} /> : null}
                  <Toggle checked={!!a.revert} onChange={v => setA({ revert: v ? 20 : undefined })} aria-label="Revert after a delay" />
                </span>
              </div>
            </div>
          )}

          {isExpr && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input value={a.expr} onChange={e => setA({ expr: e.target.value })} spellCheck={false} aria-label="Expression" className="mono min-h-[44px] min-w-0 flex-1 rounded-lg bg-zinc-800 px-3 text-[16px] text-white focus:outline-none" />
                {exprEval != null && (
                  <span className="ios-numeric whitespace-nowrap text-[15px] text-zinc-500">
                    {'= '}
                    <span className="text-white">
                      {Math.round(exprEval)}
                      °F
                    </span>
                    {' '}
                    now
                  </span>
                )}
              </div>
              <div className="text-[13px] leading-[18px] text-zinc-500">
                Variables:
                {' '}
                <span className="mono text-zinc-300">ambient</span>
                ,
                {' '}
                <span className="mono text-zinc-300">target</span>
                ,
                {' '}
                <span className="mono text-zinc-300">current</span>
                . Evaluated every tick.
              </div>
            </div>
          )}

          <div className="border-t border-zinc-800 pt-3">
            <div className="mb-2 flex items-center gap-2">
              <Icon.Shield size={16} className="text-amber-400" />
              <span className="text-[17px] text-white">Safety clamp</span>
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-4">
              <div className="flex items-center justify-between gap-2 md:justify-start">
                <span className="text-[15px] text-zinc-400">Minimum</span>
                <NumberField value={clamp[0]} step={1} suffix="°F" onChange={v => setA({ clamp: [v, clamp[1]] })} width={64} />
              </div>
              <div className="flex items-center justify-between gap-2 md:justify-start">
                <span className="text-[15px] text-zinc-400">Maximum</span>
                <NumberField value={clamp[1]} step={1} suffix="°F" onChange={v => setA({ clamp: [clamp[0], v] })} width={64} />
              </div>
            </div>
            <p className="mt-2 text-[13px] leading-[18px] text-zinc-500">Autopilot never commands a temperature outside these bounds.</p>
          </div>
        </div>
      )}

      {a.action === 'notify' && (
        <input value={a.message} onChange={e => setA({ message: e.target.value })} placeholder="Notification message" aria-label="Notification message" className="min-h-[44px] w-full rounded-lg bg-zinc-800 px-3 text-[16px] text-white focus:outline-none" />
      )}
      {a.action === 'setPower' && (
        <Segmented full value={a.on ? 'on' : 'off'} options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]} onChange={v => setA({ on: v === 'on' })} />
      )}

      <div className="mt-3 flex min-h-[44px] flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-3">
        <span className="text-[17px] text-white">Cooldown</span>
        <NumberField value={rule.cooldown} step={5} suffix="min" onChange={v => set({ ...rule, cooldown: Math.max(0, v) })} width={64} />
      </div>
    </Card>
  )
}

// ---------- modal ----------
export function RuleEditor({ automation, onClose, onSave, saving }: { automation: BuilderRule, onClose: () => void, onSave: (r: BuilderRule) => void, saving?: boolean }) {
  const [rule, setRule] = useState<BuilderRule>(() => clone(automation))
  const backtestSide = rule.side === 'right' ? 'right' : 'left'

  // Debounce the rule before backtesting so we don't replay on every keystroke.
  const [debounced, setDebounced] = useState(rule)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(rule), 350)
    return () => clearTimeout(t)
  }, [rule])

  const nightsQ = trpc.automations.nights.useQuery({ side: backtestSide, limit: 5 })
  const nights = useMemo(() => nightsQ.data ?? [], [nightsQ.data])
  // The picked night, falling back to the most recent — derived, not an effect.
  const [picked, setPicked] = useState<number | null>(null)
  // Drop a picked id that isn't in the current side's nights, so switching
  // sides doesn't send a stale sleepRecordId until the user re-picks.
  const resolvedPicked = picked != null && nights.some(n => n.sleepRecordId === picked) ? picked : null
  const nightId = resolvedPicked ?? nights[0]?.sleepRecordId ?? null

  const ambientQ = trpc.environment.getLatestBedTemp.useQuery({ unit: 'F' })
  const liveAmbient = ambientQ.data?.ambientTemp ?? null

  // Show the live capacitive zone viz when the rule reads a pressure signal —
  // "zone" is meaningless as a bare number without it.
  const usesCapSignal = useMemo(() => {
    const sigs: string[] = []
    if ('signal' in rule.when && rule.when.signal) sigs.push(rule.when.signal)
    for (const c of rule.ifs) if (c.type === 'cond') sigs.push(c.signal)
    return sigs.some(s => s.startsWith('{side}.cap.'))
  }, [rule])

  const ast = useMemo(() => toAST(debounced), [debounced])
  const backtestQ = trpc.automations.backtest.useQuery(
    {
      side: backtestSide,
      sleepRecordId: nightId ?? undefined,
      rule: { side: ast.side, cooldownMin: ast.cooldownMin, trigger: ast.trigger, conditions: ast.conditions, actions: ast.actions },
    },
    { enabled: nights.length > 0, placeholderData: prev => prev },
  )

  return (
    <div className="ap-console fixed inset-0 z-[200] flex flex-col bg-black/60 md:bg-zinc-950/95 md:backdrop-blur-sm" style={{ animation: 'apFade .15s ease' }} role="dialog" aria-modal="true" aria-label={rule.name}>
      {/* phone: page sheet with an inline navigation bar */}
      <div className="h-[max(12px,env(safe-area-inset-top,0px))] shrink-0 md:hidden" />
      <div className="flex min-h-0 flex-1 flex-col rounded-t-[10px] bg-black md:rounded-none md:bg-transparent">
        <div className="md:hidden">
          <div className="mx-auto mt-1.5 h-[5px] w-9 rounded-full bg-zinc-700" />
          <div className="grid min-h-[44px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-4">
            <button type="button" onClick={onClose} className="justify-self-start text-[17px] text-sky-400 active:opacity-50">Cancel</button>
            <div className="max-w-[180px] truncate text-[17px] font-semibold text-white">{automation.id != null ? 'Edit automation' : 'New automation'}</div>
            <button type="button" onClick={() => onSave(rule)} disabled={saving} className="justify-self-end text-[17px] font-semibold text-sky-400 active:opacity-50 disabled:opacity-40">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* md+: toolbar */}
        <div className="hidden items-center gap-3 border-b border-zinc-800 px-5 py-3 md:flex">
          <input value={rule.name} onChange={e => setRule({ ...rule, name: e.target.value })} aria-label="Automation name" className="min-w-0 max-w-sm flex-1 bg-transparent text-[17px] font-semibold text-white focus:outline-none" />
          <div className="ml-auto flex items-center gap-3">
            <Segmented value={rule.side} options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }, { value: 'both', label: 'Both' }]} onChange={v => setRule({ ...rule, side: v })} />
            <Segmented value={rule.mode} options={[{ value: 'dryrun', label: 'Dry run' }, { value: 'active', label: 'Active' }]} onChange={v => setRule({ ...rule, mode: v, enabled: true })} />
            <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
            <Button variant="accent" size="md" onClick={() => onSave(rule)} disabled={saving}>
              <Icon.Check size={16} />
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain md:flex-row md:overflow-hidden">
          <div className="border-zinc-800 px-4 pb-2 pt-3 md:w-[44%] md:min-w-[420px] md:overflow-y-auto md:border-r md:p-5">
            <div className="mx-auto flex max-w-xl flex-col gap-4">
              {/* phone: name, side and mode as a grouped list */}
              <div className="overflow-hidden rounded-xl bg-zinc-900 md:hidden [&>*+*]:border-t [&>*+*]:border-zinc-800">
                <input value={rule.name} onChange={e => setRule({ ...rule, name: e.target.value })} aria-label="Automation name" placeholder="Name" className="min-h-[44px] w-full bg-transparent px-4 text-[17px] text-white focus:outline-none" />
                <div className="flex min-h-[44px] items-center justify-between gap-3 px-4 py-1.5">
                  <span className="text-[17px] text-white">Side</span>
                  <Segmented value={rule.side} options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }, { value: 'both', label: 'Both' }]} onChange={v => setRule({ ...rule, side: v })} />
                </div>
                <div className="flex min-h-[44px] items-center justify-between gap-3 px-4 py-1.5">
                  <span className="text-[17px] text-white">Mode</span>
                  <Segmented value={rule.mode} options={[{ value: 'dryrun', label: 'Dry run' }, { value: 'active', label: 'Active' }]} onChange={v => setRule({ ...rule, mode: v, enabled: true })} />
                </div>
              </div>
              <WhenEditor rule={rule} set={setRule} />
              <IfEditor rule={rule} set={setRule} />
              <ThenEditor rule={rule} set={setRule} liveAmbient={liveAmbient} />
            </div>
          </div>

          <div className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-4 md:flex-1 md:overflow-y-auto md:p-5">
            <div className="mx-auto flex max-w-2xl flex-col gap-4">
              {rule.mode === 'dryrun' && (
                <div className="flex items-start gap-3 rounded-xl bg-zinc-900 px-4 py-3 text-[15px] leading-5 text-zinc-400">
                  <Icon.Flask size={18} className="mt-px shrink-0 text-amber-400" />
                  Dry run: Autopilot logs what it would do but never touches hardware.
                </div>
              )}
              <SentencePreview rule={rule} />
              {usesCapSignal && <CapZoneViz side={rule.side} backtestSide={backtestSide} nightId={nightId} />}
              <Card className="p-4">
                <BacktestPanel
                  result={backtestQ.data?.ok ? (backtestQ.data.result as Parameters<typeof BacktestPanel>[0]['result']) : null}
                  loading={backtestQ.isLoading || backtestQ.isFetching}
                  message={nights.length === 0 ? (nightsQ.isLoading ? undefined : 'No recorded nights for this side yet — backtest needs sleep history.') : (backtestQ.data && !backtestQ.data.ok ? backtestQ.data.message : undefined)}
                  nights={nights}
                  nightId={nightId}
                  onNight={setPicked}
                />
              </Card>
              <p className="-mt-2 px-4 text-[13px] leading-[18px] text-zinc-500">
                Backtest replays recorded sensor history against your current settings. Nothing here changes your bed; it&apos;s a preview of how this rule would have behaved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
