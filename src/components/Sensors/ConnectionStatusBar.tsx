'use client'

import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { type ConnectionStatus } from '@/src/hooks/useSensorStream'
import { Loader2 } from 'lucide-react'

interface ConnectionStatusBarProps {
  status: ConnectionStatus
  fps: number
  lastError: string | null
  subscribedSensors: string[] | null
  lastFrameTime: number | null
  /**
   * `bar` renders a grouped row (desktop console); `inline` renders a quiet
   * caption line suitable for sitting under a large title.
   */
  variant?: 'bar' | 'inline'
}

const STATUS_CONFIG: Record<ConnectionStatus, { label: string, color: string, dotColor: string }> = {
  connected: { label: 'Live', color: 'text-emerald-400', dotColor: 'bg-emerald-400' },
  connecting: { label: 'Connecting', color: 'text-amber-400', dotColor: 'bg-amber-400' },
  reconnecting: { label: 'Reconnecting', color: 'text-amber-400', dotColor: 'bg-amber-400' },
  disconnected: { label: 'Offline', color: 'text-zinc-400', dotColor: 'bg-zinc-500' },
}

/** Format relative time ago string. */
function useRelativeTime(timestamp: number | null): string {
  const [text, setText] = useState('')

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!timestamp) {
      setText('')
      return
    }

    function update() {
      const diff = Math.floor((Date.now() - (timestamp ?? 0)) / 1000)
      if (diff < 2) setText('just now')
      else if (diff < 60) setText(`${diff}s ago`)
      else setText(`${Math.floor(diff / 60)}m ago`)
    }

    update()
    /* eslint-enable react-hooks/set-state-in-effect */
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [timestamp])

  return text
}

/**
 * Stream connection indicator: status dot + label, followed by quiet meta
 * (subscribed sensor count, fps, time since last frame).
 */
export function ConnectionStatusBar({
  status,
  fps,
  lastError,
  subscribedSensors,
  lastFrameTime,
  variant = 'bar',
}: ConnectionStatusBarProps) {
  const config = STATUS_CONFIG[status]
  const isConnected = status === 'connected'
  const isLoading = status === 'connecting' || status === 'reconnecting'
  const relativeTime = useRelativeTime(lastFrameTime)

  const meta = [
    subscribedSensors ? `${subscribedSensors.length} sensors` : null,
    isConnected && fps > 0 ? `${fps} fps` : null,
    relativeTime || null,
  ].filter(Boolean)

  return (
    <div
      className={clsx(
        'flex min-w-0 items-center gap-2',
        variant === 'bar' && 'min-h-[44px] rounded-xl bg-zinc-900 px-4',
      )}
    >
      {isLoading
        ? <Loader2 size={12} className={`shrink-0 animate-spin ${config.color}`} />
        : <span className={`h-2 w-2 shrink-0 rounded-full ${config.dotColor}`} />}
      <span className="ios-numeric min-w-0 truncate text-[15px] text-zinc-500">
        <span className={clsx('font-medium', isConnected ? 'text-emerald-400' : 'text-zinc-300')}>
          {lastError && !isConnected ? lastError : config.label}
        </span>
        {meta.map(m => (
          <span key={m}>
            {' · '}
            {m}
          </span>
        ))}
      </span>
    </div>
  )
}
