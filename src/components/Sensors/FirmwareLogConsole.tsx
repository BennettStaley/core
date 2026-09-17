'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useOnSensorFrame, type LogFrame, type GestureFrame, type SensorFrame } from '@/src/hooks/useSensorStream'
import { Trash2, Pause, Play } from 'lucide-react'
import { SegmentedControl } from '@/src/ui/ios'

const MAX_ENTRIES = 100

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: 'text-zinc-500',
  INFO: 'text-sky-400',
  WARN: 'text-amber-400',
  WARNING: 'text-amber-400',
  ERROR: 'text-red-400',
  CRITICAL: 'text-red-500',
}

const TYPE_COLORS: Record<string, string> = {
  'piezo-dual': 'text-purple-400',
  'capSense': 'text-green-400',
  'capSense2': 'text-green-400',
  'bedTemp': 'text-orange-400',
  'bedTemp2': 'text-orange-400',
  'frzTemp': 'text-blue-400',
  'frzHealth': 'text-blue-400',
  'frzTherm': 'text-blue-400',
  'deviceStatus': 'text-sky-400',
  'log': 'text-amber-400',
  'gesture': 'text-pink-400',
}

function getLevelColor(level: string): string {
  return LEVEL_COLORS[level.toUpperCase()] ?? 'text-zinc-400'
}

function getTypeColor(type: string): string {
  return TYPE_COLORS[type] ?? 'text-zinc-400'
}

function formatTime(ts: number): string {
  const date = new Date(ts < 1e12 ? ts * 1000 : ts)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

type ViewMode = 'logs' | 'frames'

interface RawEntry {
  ts: number
  type: string
  json: string
}

/**
 * Unified diagnostic console — firmware logs (default) + raw frame inspector.
 * Terminal-style with auto-scroll, pause, type filtering, and expandable frames.
 */
export function FirmwareLogConsole() {
  const [mode, setMode] = useState<ViewMode>('logs')
  const [logs, setLogs] = useState<LogFrame[]>([])
  const [frames, setFrames] = useState<RawEntry[]>([])
  const [paused, setPaused] = useState(false)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)
  const framesRef = useRef<RawEntry[]>([])
  const typesSeenRef = useRef(new Set<string>())
  const [typesSeen, setTypesSeen] = useState<string[]>([])

  useOnSensorFrame(useCallback((frame: SensorFrame) => {
    if (frame.type === 'log') {
      if (!paused) {
        setLogs((prev) => {
          const next = [...prev, frame as LogFrame]
          return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next
        })
      }
    }

    // Surface gesture events as log entries
    if (frame.type === 'gesture') {
      if (!paused) {
        const gf = frame as GestureFrame
        const gestureLog: LogFrame = {
          type: 'log',
          ts: gf.ts,
          level: 'INFO',
          msg: `[TAP] ${gf.side} ${gf.tapType}`,
        }
        setLogs((prev) => {
          const next = [...prev, gestureLog]
          return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next
        })
      }
    }

    // Always buffer raw frames (even when viewing logs)
    const entry: RawEntry = {
      ts: Date.now(),
      type: frame.type,
      json: JSON.stringify(frame, null, 2),
    }
    framesRef.current = [entry, ...framesRef.current].slice(0, MAX_ENTRIES * 3)

    if (!typesSeenRef.current.has(frame.type)) {
      typesSeenRef.current.add(frame.type)
      setTypesSeen([...typesSeenRef.current])
    }

    if (mode === 'frames' && !paused) {
      setFrames([...framesRef.current])
    }
  }, [mode, paused]))

  // Auto-scroll
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs.length])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 20
  }, [])

  const handleClear = () => {
    if (mode === 'logs') setLogs([])
    else {
      framesRef.current = []
      setFrames([])
    }
  }

  const handleModeSwitch = (m: ViewMode) => {
    setMode(m)
    setExpandedIdx(null)
    if (m === 'frames') setFrames([...framesRef.current])
  }

  const filteredFrames = typeFilter
    ? frames.filter(f => f.type === typeFilter).slice(0, MAX_ENTRIES)
    : frames.slice(0, MAX_ENTRIES)

  const entryCount = mode === 'logs' ? logs.length : filteredFrames.length

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex min-h-[28px] items-center justify-between gap-2">
        <h3 className="text-[17px] font-semibold text-white">Console</h3>
        <div className="flex items-center">
          <span className="ios-numeric mr-1 text-[13px] text-zinc-500">
            {entryCount}
            {paused ? ' · Paused' : ''}
          </span>
          <button
            type="button"
            onClick={() => setPaused(p => !p)}
            className="grid h-11 w-11 place-items-center text-sky-400 active:opacity-50"
            aria-label={paused ? 'Resume' : 'Pause'}
            title={paused ? 'Resume' : 'Pause'}
          >
            {paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="-mr-3 grid h-11 w-11 place-items-center text-sky-400 active:opacity-50"
            aria-label="Clear"
            title="Clear"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <SegmentedControl
        aria-label="Console view"
        options={[{ value: 'logs', label: 'Logs' }, { value: 'frames', label: 'Frames' }]}
        value={mode}
        onChange={handleModeSwitch}
      />

      {/* Type filter (frames mode only) */}
      {mode === 'frames' && typesSeen.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <FilterPill label="All" active={typeFilter === null} onClick={() => setTypeFilter(null)} />
          {typesSeen.map(type => (
            <FilterPill key={type} label={type} active={typeFilter === type} onClick={() => setTypeFilter(type)} />
          ))}
        </div>
      )}

      {/* Console body */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-52 overflow-y-auto rounded-lg bg-black/60 p-2.5 font-mono text-[11px] leading-relaxed"
      >
        {mode === 'logs'
          ? (
              logs.length === 0
                ? (
                    <Empty text="Waiting for firmware logs" />
                  )
                : (
                    logs.map((log, i) => (
                      <div key={`${log.ts}-${i}`} className="flex gap-2">
                        <span className="shrink-0 text-zinc-600">{formatTime(log.ts)}</span>
                        <span className={`shrink-0 w-11 text-right font-semibold ${getLevelColor(log.level)}`}>
                          {log.level.toUpperCase().slice(0, 5)}
                        </span>
                        <span className="text-zinc-300 break-all">{log.msg}</span>
                      </div>
                    ))
                  )
            )
          : (
              filteredFrames.length === 0
                ? (
                    <Empty text="Waiting for frames" />
                  )
                : (
                    filteredFrames.map((entry, i) => {
                      const isExpanded = expandedIdx === i
                      // eslint-disable-next-line react-hooks/purity
                      const age = ((Date.now() - entry.ts) / 1000).toFixed(1)
                      return (
                        <div key={`${entry.ts}-${i}`}>
                          <button
                            onClick={() => {
                              setExpandedIdx(isExpanded ? null : i)
                              if (!paused) setPaused(true)
                            }}
                            className={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-left ${
                              isExpanded ? 'bg-sky-500/10' : 'hover:bg-zinc-900'
                            }`}
                          >
                            <span className="shrink-0 text-zinc-600">{formatTime(entry.ts)}</span>
                            <span className={`shrink-0 font-semibold ${getTypeColor(entry.type)}`}>{entry.type}</span>
                            <span className="flex-1" />
                            <span className="text-zinc-700">
                              {age}
                              s
                            </span>
                          </button>
                          {isExpanded && (
                            <pre className="ml-4 max-h-48 overflow-auto py-1 text-[11px] text-zinc-500">
                              {entry.json}
                            </pre>
                          )}
                        </div>
                      )
                    })
                  )
            )}
      </div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <span className="font-sans text-[13px] text-zinc-500">{text}</span>
    </div>
  )
}

function FilterPill({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`min-h-[28px] rounded-full px-3 text-[13px] transition-colors ${
        active ? 'bg-sky-500 text-white' : 'bg-zinc-800 text-zinc-300 active:bg-zinc-700'
      }`}
    >
      {label}
    </button>
  )
}
