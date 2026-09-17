/**
 * Automations list. On phones it is an inset grouped list (Settings-style):
 * name, status and side, the rule as a plain-English sentence with the dynamic
 * parts in the accent colour, and a trailing switch. From md up the same rows
 * gain last-fired / fires-today columns under a toolbar header.
 */
'use client'

import { Icon } from './icons'
import { Button, SideBadge, StatusBadge, Toggle } from './primitives'
import { type BuilderRule, buildSentence } from './builderModel'

export interface ListItem {
  id: number
  name: string
  enabled: boolean
  mode: 'active' | 'dryrun'
  side: 'left' | 'right' | 'both'
  builder: BuilderRule
  lastFired: string
  firesToday: number
}

function RuleSentence({ b }: { b: BuilderRule }) {
  const chunks = buildSentence(b)
  return (
    <span className="block text-[15px] leading-5 text-zinc-500" style={{ textWrap: 'pretty' }}>
      {chunks.map((c, i) => (
        <span key={i} className={c.hot ? 'text-sky-400' : ''}>{c.text}</span>
      ))}
    </span>
  )
}

function Row({ a, onToggle, onOpen }: { a: ListItem, onToggle: (id: number, enabled: boolean) => void, onOpen: (a: ListItem) => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(a)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(a)
        }
      }}
      className="group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors active:bg-zinc-800 focus:outline-none focus-visible:bg-zinc-800 md:gap-5 md:px-5 md:py-4 md:hover:bg-zinc-800/40"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[17px] leading-[22px] text-white">{a.name}</div>
        <div className="mb-1 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <StatusBadge mode={a.enabled ? a.mode : 'paused'} />
          <SideBadge side={a.side} />
          <span className="text-[13px] text-zinc-500 md:hidden">{`Last fired ${a.lastFired}`}</span>
        </div>
        <RuleSentence b={a.builder} />
      </div>
      <div className="hidden shrink-0 text-right md:block">
        <div className="text-[13px] text-zinc-500">Last fired</div>
        <div className="ios-numeric text-[15px] text-zinc-300">{a.lastFired}</div>
      </div>
      <div className="hidden w-20 shrink-0 text-right md:block">
        <div className="text-[13px] text-zinc-500">Today</div>
        <div className="ios-numeric text-[15px] text-zinc-300">
          {a.firesToday}
          {' '}
          fire
          {a.firesToday === 1 ? '' : 's'}
        </div>
      </div>
      <div onClick={e => e.stopPropagation()} className="shrink-0">
        <Toggle checked={a.enabled} onChange={() => onToggle(a.id, !a.enabled)} aria-label={`${a.name} enabled`} />
      </div>
      <Icon.ChevRight size={16} className="hidden shrink-0 text-zinc-600 md:block" />
    </div>
  )
}

const EXAMPLES = [
  { t: 'Hold ambient + 3°F overnight', s: 'Continuous policy' },
  { t: 'Cool down when restless', s: 'Edge-triggered rule' },
]

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="space-y-6 pt-6 md:grid md:place-items-center md:px-6 md:py-20">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-zinc-900 text-sky-400">
          <Icon.Sliders size={30} />
        </div>
        <h2 className="text-[22px] font-bold leading-7 text-white">No automations yet</h2>
        <p className="mx-auto mt-2 max-w-[340px] text-[15px] leading-5 text-zinc-500">
          Autopilot reacts to live signals like movement, heart rate and room temperature instead of just the clock. Build a rule, then backtest it against past nights before it touches your bed.
        </p>
        <div className="mt-6">
          <Button variant="accent" size="lg" onClick={onNew} className="w-full md:w-auto">
            <Icon.Plus size={18} />
            New automation
          </Button>
        </div>
      </div>
      <section className="mx-auto w-full max-w-md space-y-1.5 text-left">
        <h3 className="px-4 text-[13px] leading-[18px] text-zinc-500">Ideas</h3>
        <div className="overflow-hidden rounded-xl bg-zinc-900 [&>*+*]:border-t [&>*+*]:border-zinc-800">
          {EXAMPLES.map(x => (
            <button key={x.t} type="button" onClick={onNew} className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-zinc-800">
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] leading-[22px] text-white">{x.t}</span>
                <span className="block text-[13px] leading-[18px] text-zinc-500">{x.s}</span>
              </span>
              <Icon.ChevRight size={16} className="shrink-0 text-zinc-600" />
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

export function AutomationsList({ items, loading, onToggle, onOpen, onNew }: {
  items: ListItem[]
  loading: boolean
  onToggle: (id: number, enabled: boolean) => void
  onOpen: (a: ListItem) => void
  onNew: () => void
}) {
  const activeCount = items.filter(a => a.enabled && a.mode === 'active').length
  const dryCount = items.filter(a => a.enabled && a.mode === 'dryrun').length
  const empty = !loading && items.length === 0
  const summary = `${activeCount} active · ${dryCount} in dry run · ${items.length} total`
  return (
    <div className="flex h-full flex-col">
      {/* desktop toolbar */}
      <div className="hidden items-center justify-between gap-4 border-b border-zinc-800 px-5 py-4 md:flex">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-7 text-white">Automations</h1>
          <p className="text-[13px] text-zinc-500">{empty ? 'Reactive rules that respond to live signals' : summary}</p>
        </div>
        {!empty && (
          <Button variant="accent" size="md" onClick={onNew}>
            <Icon.Plus size={16} />
            New automation
          </Button>
        )}
      </div>

      {loading
        ? <div className="py-16 text-center text-[15px] text-zinc-500">Loading automations…</div>
        : empty
          ? <EmptyState onNew={onNew} />
          : (
              <section className="space-y-1.5 md:space-y-0">
                <div className="overflow-y-auto rounded-xl bg-zinc-900 md:rounded-none md:bg-transparent [&>*+*]:border-t [&>*+*]:border-zinc-800">
                  {items.map(a => <Row key={a.id} a={a} onToggle={onToggle} onOpen={onOpen} />)}
                </div>
                <p className="px-4 text-[13px] leading-[18px] text-zinc-500 md:hidden">{summary}</p>
              </section>
            )}
    </div>
  )
}
