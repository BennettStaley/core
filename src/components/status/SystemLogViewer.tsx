'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { trpc } from '@/src/utils/trpc'
import { ChevronRight, Loader2, RefreshCw, Terminal } from 'lucide-react'
import clsx from 'clsx'
import { SegmentedControl } from '@/src/ui/ios'

const PRIORITIES = [
  { label: 'All', value: undefined },
  { label: 'Errors', value: 'err' },
  { label: 'Warn', value: 'warning' },
  { label: 'Debug', value: 'debug' },
] as const

const LEVEL_COLORS: Record<string, string> = {
  emerg: 'text-red-500',
  alert: 'text-red-500',
  crit: 'text-red-500',
  err: 'text-red-400',
  warning: 'text-amber-400',
  notice: 'text-sky-400',
  info: 'text-zinc-300',
  debug: 'text-zinc-500',
}

/**
 * SystemLogViewer — browse journalctl logs from systemd services.
 * Matches iOS LogsView with service selection and priority filtering.
 *
 * Wires into:
 * - system.getLogSources → list available systemd services
 * - system.getLogs → read log lines with filters
 */
export function SystemLogViewer() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null)
  const [priority, setPriority] = useState<'alert' | 'warning' | 'emerg' | 'crit' | 'err' | 'notice' | 'info' | 'debug' | undefined>(undefined)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: sources } = trpc.system.getLogSources.useQuery(
    {},
    { refetchInterval: 30_000 },
  )

  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = trpc.system.getLogs.useQuery(
    {
      unit: selectedUnit ?? (sources?.sources?.[0]?.unit ?? ''),
      lines: 100,
      priority,
    },
    {
      enabled: isExpanded && (selectedUnit !== null || (sources?.sources?.length ?? 0) > 0),
    },
  )

  // Auto-select first source when data loads
  useEffect(() => {
    if (!selectedUnit && sources?.sources?.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedUnit(sources.sources[0].unit)
    }
  }, [sources, selectedUnit])

  // Auto-scroll to bottom of logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  const handleRefresh = useCallback(() => {
    refetchLogs()
  }, [refetchLogs])

  // getLogs returns plain strings from journalctl output
  const logLines = logs?.lines ?? []

  return (
    <div className="overflow-hidden rounded-xl bg-zinc-900">
      {/* Disclosure row */}
      <button
        type="button"
        onClick={() => setIsExpanded(v => !v)}
        aria-expanded={isExpanded}
        className="flex min-h-[44px] w-full items-center gap-3 px-4 text-left active:bg-zinc-800"
      >
        <span className="grid h-[29px] w-[29px] shrink-0 place-items-center rounded-[7px] bg-zinc-600 text-white">
          <Terminal size={17} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1 py-2.5 text-[17px] leading-[22px] text-white">System logs</span>
        <ChevronRight
          size={18}
          className={clsx('shrink-0 text-zinc-600 transition-transform duration-200', isExpanded && 'rotate-90')}
        />
      </button>

      {isExpanded && (
        <div className="space-y-3 border-t border-zinc-800 p-4">
          {/* Service selector */}
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {(sources?.sources ?? []).map((src: { name: string, unit: string, active: boolean }) => (
              <button
                key={src.unit}
                type="button"
                onClick={() => setSelectedUnit(src.unit)}
                className={clsx(
                  'min-h-[32px] whitespace-nowrap rounded-full px-3 text-[13px] font-medium transition-colors',
                  selectedUnit === src.unit
                    ? 'bg-sky-500 text-white'
                    : 'bg-zinc-800 text-zinc-300 active:bg-zinc-700',
                  !src.active && 'opacity-50',
                )}
              >
                {src.name}
              </button>
            ))}
          </div>

          {/* Priority filter */}
          <div className="flex items-center gap-2">
            <SegmentedControl
              aria-label="Log priority"
              className="flex-1"
              options={PRIORITIES.map(p => ({ value: p.value ?? 'all', label: p.label }))}
              value={priority ?? 'all'}
              onChange={v => setPriority(v === 'all' ? undefined : v as typeof priority)}
            />
            <button
              type="button"
              onClick={handleRefresh}
              disabled={logsLoading}
              aria-label="Refresh logs"
              className="grid h-11 w-11 shrink-0 place-items-center text-sky-400 active:opacity-50 disabled:text-zinc-600"
            >
              {logsLoading
                ? <Loader2 size={18} className="animate-spin" />
                : <RefreshCw size={18} />}
            </button>
          </div>

          {/* Log output */}
          <div
            ref={scrollRef}
            className="h-60 overflow-y-auto rounded-lg bg-black p-2.5 font-mono text-[12px] leading-relaxed"
          >
            {logsLoading && logLines.length === 0
              ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 size={18} className="animate-spin text-zinc-600" />
                  </div>
                )
              : logLines.length === 0
                ? (
                    <div className="flex h-full items-center justify-center font-sans text-[15px] text-zinc-500">
                      No logs found
                    </div>
                  )
                : (
                    logLines.map((line, i) => {
                      // Detect priority level from journalctl output for color-coding
                      const levelMatch = line.match(/\b(emerg|alert|crit|err|warning|notice|info|debug)\b/i)
                      const level = levelMatch?.[1]?.toLowerCase() ?? ''
                      const color = LEVEL_COLORS[level] ?? 'text-zinc-400'

                      return (
                        <div key={i} className="py-0.5">
                          <span className={clsx('break-all', color)}>{line}</span>
                        </div>
                      )
                    })
                  )}
          </div>
        </div>
      )}
    </div>
  )
}
