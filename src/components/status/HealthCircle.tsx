'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { ChevronRight, Cpu, Droplet, GitBranch, Globe, Lock, Wifi } from 'lucide-react'
import { POD_CAPS } from '@/src/hardware/pods'
import type { PodVersion } from '@/src/hardware/types'

interface HealthCircleProps {
  healthy: number
  total: number
  podVersion?: string | null
  sensorLabel?: string | null
  branch?: string
  commitHash?: string
  internetBlocked?: boolean
  wifiSsid?: string
  wifiSignal?: number
  podIP?: string
  waterLevel?: string
  isPriming?: boolean
  onWaterClick?: () => void
}

function podModelName(version: string): string {
  const caps = POD_CAPS[version as PodVersion]
  return caps?.modelName ?? version
}

/** One hairline-separated row inside the summary card. */
function SummaryRow({
  icon,
  label,
  value,
  valueClassName,
  onClick,
  accessory,
}: {
  icon: React.ReactNode
  label: string
  value?: React.ReactNode
  valueClassName?: string
  onClick?: () => void
  accessory?: React.ReactNode
}) {
  const content = (
    <>
      <span className="shrink-0 text-zinc-500">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[15px] text-white">{label}</span>
      {value !== undefined && (
        <span className={clsx('ios-numeric min-w-0 truncate text-[15px]', valueClassName ?? 'text-zinc-500')}>{value}</span>
      )}
      {accessory}
    </>
  )
  const className = 'flex min-h-[44px] w-full items-center gap-3 px-4 text-left'
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={clsx(className, 'active:bg-zinc-800')}>
        {content}
      </button>
    )
  }
  return <div className={className}>{content}</div>
}

export function HealthCircle({
  healthy,
  total,
  podVersion,
  sensorLabel,
  branch,
  commitHash,
  internetBlocked,
  wifiSsid,
  wifiSignal,
  podIP,
  waterLevel,
  isPriming,
  onWaterClick,
}: HealthCircleProps) {
  const [showHardwareInfo, setShowHardwareInfo] = useState(false)
  const progress = total > 0 ? healthy / total : 0
  const allHealthy = healthy === total && total > 0
  const radius = 25
  const circumference = 2 * Math.PI * radius

  const waterValue = isPriming
    ? 'Priming…'
    : waterLevel
      ? (waterLevel === 'ok' ? 'OK' : 'Low')
      : 'Unknown'
  const waterColor = isPriming
    ? 'text-sky-400'
    : waterLevel === 'low'
      ? 'text-amber-400'
      : waterLevel === 'ok'
        ? 'text-emerald-400'
        : 'text-zinc-500'

  const wifiColor = wifiSignal === undefined
    ? 'text-zinc-500'
    : wifiSignal > 60 ? 'text-zinc-500' : wifiSignal > 30 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="overflow-hidden rounded-xl bg-zinc-900 [&>*+*]:border-t [&>*+*]:border-zinc-800">
      {/* Summary: ring + name + healthy count */}
      <div className="flex items-center gap-4 px-4 py-4">
        <div className="relative h-14 w-14 shrink-0">
          <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90">
            <circle cx="28" cy="28" r={radius} fill="none" stroke="#2C2C2E" strokeWidth="3" />
            <circle
              cx="28"
              cy="28"
              r={radius}
              fill="none"
              stroke={allHealthy ? 'var(--color-emerald-500, #30D158)' : 'var(--color-amber-500, #FF9F0A)'}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              className="transition-all duration-500"
            />
          </svg>
          <span className="ios-numeric absolute inset-0 flex items-center justify-center text-[17px] font-semibold text-white">
            {healthy}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[17px] font-semibold text-white">sleepypod</span>
            {podVersion && (
              <span className="truncate text-[15px] text-zinc-500">{podModelName(podVersion)}</span>
            )}
          </div>
          <p className="ios-numeric text-[15px] text-zinc-500">
            {allHealthy ? 'All ' : ''}
            {allHealthy ? `${total} services healthy` : `${healthy} of ${total} services healthy`}
          </p>
        </div>
      </div>

      {/* Connection */}
      {podIP && (
        <SummaryRow
          icon={<Globe size={18} />}
          label="Address"
          value={podIP}
        />
      )}
      {(wifiSignal !== undefined || internetBlocked !== undefined) && (
        <SummaryRow
          icon={<Wifi size={18} />}
          label={wifiSsid ?? 'Wi-Fi'}
          value={(
            <span className="flex items-center gap-2">
              {wifiSignal !== undefined && <span className={wifiColor}>{`${wifiSignal}%`}</span>}
              {internetBlocked !== undefined && (
                internetBlocked
                  ? (
                      <span className="flex items-center gap-1 text-zinc-500">
                        <Lock size={13} />
                        Local only
                      </span>
                    )
                  : (
                      <span className="text-amber-400">Internet</span>
                    )
              )}
            </span>
          )}
        />
      )}

      {/* Water — tappable, opens the water & priming sheet */}
      <SummaryRow
        icon={<Droplet size={18} />}
        label="Water"
        value={waterValue}
        valueClassName={waterColor}
        onClick={onWaterClick}
        accessory={<ChevronRight size={18} className="shrink-0 text-zinc-600" />}
      />

      {/* Build */}
      {branch && (
        <SummaryRow
          icon={<GitBranch size={18} />}
          label="Build"
          value={commitHash ? `${branch} · ${commitHash.slice(0, 7)}` : branch}
        />
      )}

      {/* Hardware info — hidden by default */}
      {podVersion && (
        <div>
          <SummaryRow
            icon={<Cpu size={18} />}
            label="Hardware info"
            onClick={() => setShowHardwareInfo(v => !v)}
            accessory={(
              <ChevronRight
                size={18}
                className={clsx('shrink-0 text-zinc-600 transition-transform duration-200', showHardwareInfo && 'rotate-90')}
              />
            )}
          />
          {showHardwareInfo && (
            <div className="space-y-1 px-4 pb-3 pl-[46px] text-[15px]">
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Pod version</span>
                <span className="font-mono text-zinc-300">{podVersion}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Model</span>
                <span className="text-zinc-300">{podModelName(podVersion)}</span>
              </div>
              {sensorLabel && (
                <div className="flex justify-between gap-3">
                  <span className="text-zinc-500">Serial</span>
                  <span className="truncate font-mono text-zinc-300">{sensorLabel}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
