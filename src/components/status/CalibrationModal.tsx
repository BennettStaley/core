'use client'

import { useState } from 'react'
import { trpc } from '@/src/utils/trpc'
import { useSide } from '@/src/hooks/useSide'
import { useSideNames } from '@/src/hooks/useSideNames'
import { Sheet } from '@/src/ui/ios'
import { RefreshCw, Bed, Thermometer, Fingerprint, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react'

type SensorType = 'piezo' | 'capacitance' | 'temperature'

interface CalibrationProfile {
  id: number
  side: string
  sensorType: string
  status: string
  qualityScore: number | null
  samplesUsed: number | null
  createdAt: Date
  expiresAt: Date | null
  errorMessage: string | null
}

const SENSOR_CONFIG: Record<SensorType, { label: string, icon: typeof Bed, tile: string }> = {
  piezo: { label: 'Piezo', icon: Bed, tile: 'bg-purple-500' },
  capacitance: { label: 'Capacitance', icon: Fingerprint, tile: 'bg-teal-500' },
  temperature: { label: 'Temperature', icon: Thermometer, tile: 'bg-orange-500' },
}

function statusIcon(status: string) {
  switch (status) {
    case 'completed': return <CheckCircle size={14} className="text-emerald-400" />
    case 'failed': return <XCircle size={14} className="text-red-400" />
    case 'running': return <Loader2 size={14} className="animate-spin text-amber-400" />
    case 'pending': return <Clock size={14} className="text-zinc-400" />
    default: return null
  }
}

function qualityColor(score: number | null): string {
  if (score === null) return 'text-zinc-500'
  if (score >= 0.8) return 'text-emerald-400'
  if (score >= 0.5) return 'text-amber-400'
  return 'text-red-400'
}

function qualityLabel(score: number | null): string {
  if (score === null) return '--'
  return `${(score * 100).toFixed(0)}%`
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return '--'
  const date = new Date(d)
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * Calibration modal. Opens from the HealthCircle or status page.
 * Contains: per-sensor calibration status, trigger buttons, and full calibration.
 */
export function CalibrationModal({ open, onClose }: { open: boolean, onClose: () => void }) {
  const { side } = useSide()
  const { sideName } = useSideNames()
  const utils = trpc.useUtils()
  const [triggeringType, setTriggeringType] = useState<SensorType | null>(null)

  const { data: status, isLoading: statusLoading } = trpc.calibration.getStatus.useQuery(
    { side },
    { refetchInterval: 5000, enabled: open },
  )

  const triggerSingle = trpc.calibration.triggerCalibration.useMutation({
    onSuccess: () => {
      utils.calibration.getStatus.invalidate({ side })
      setTriggeringType(null)
    },
    onError: () => setTriggeringType(null),
  })

  const triggerFull = trpc.calibration.triggerFullCalibration.useMutation({
    onSuccess: () => utils.calibration.getStatus.invalidate({ side }),
  })

  const handleTrigger = (type: SensorType) => {
    setTriggeringType(type)
    triggerSingle.mutate({ side, sensorType: type })
  }

  const isAnyActive = status && (
    status.piezo?.status === 'running' || status.piezo?.status === 'pending'
    || status.capacitance?.status === 'running' || status.capacitance?.status === 'pending'
    || status.temperature?.status === 'running' || status.temperature?.status === 'pending'
  )

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Calibration"
      leading={<span />}
      trailing={(
        <button type="button" onClick={onClose} className="text-[17px] font-semibold text-sky-400 active:opacity-50">
          Done
        </button>
      )}
    >
      <div className="space-y-6">
        {/* Status feedback */}
        {(triggerSingle.data || triggerFull.data) && (
          <p className="rounded-xl bg-zinc-900 px-4 py-3 text-[15px] text-emerald-400">
            {triggerSingle.data?.message || triggerFull.data?.message}
          </p>
        )}
        {(triggerSingle.error || triggerFull.error) && (
          <p className="rounded-xl bg-zinc-900 px-4 py-3 text-[15px] text-red-400">
            {triggerSingle.error?.message || triggerFull.error?.message}
          </p>
        )}

        {/* Sensor rows */}
        <section className="space-y-1.5">
          <h2 className="px-4 text-[13px] leading-[18px] text-zinc-500">{`Sensors · ${sideName(side)}`}</h2>
          {statusLoading
            ? (
                <div className="flex h-24 items-center justify-center rounded-xl bg-zinc-900">
                  <Loader2 size={20} className="animate-spin text-zinc-600" />
                </div>
              )
            : (
                <div className="overflow-hidden rounded-xl bg-zinc-900 [&>*+*]:border-t [&>*+*]:border-zinc-800">
                  {(['piezo', 'capacitance', 'temperature'] as const).map((type) => {
                    const config = SENSOR_CONFIG[type]
                    const Icon = config.icon
                    const profile = status?.[type] as CalibrationProfile | null | undefined
                    const isTriggering = triggeringType === type
                    const isActive = profile?.status === 'running' || profile?.status === 'pending'

                    return (
                      <div key={type} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
                        <span className={`grid h-[29px] w-[29px] shrink-0 place-items-center rounded-[7px] text-white ${config.tile}`}>
                          <Icon size={17} strokeWidth={2} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[17px] leading-[22px] text-white">{config.label}</span>
                            {profile && statusIcon(profile.status)}
                          </div>
                          {profile
                            ? (
                                <p className="ios-numeric truncate text-[13px] leading-[18px] text-zinc-500">
                                  <span className={`font-semibold ${qualityColor(profile.qualityScore)}`}>
                                    {qualityLabel(profile.qualityScore)}
                                  </span>
                                  {profile.samplesUsed !== null && ` · ${profile.samplesUsed} samples`}
                                  {` · ${formatDate(profile.createdAt)}`}
                                </p>
                              )
                            : (
                                <p className="text-[13px] leading-[18px] text-zinc-500">No calibration</p>
                              )}
                          {profile?.errorMessage && (
                            <p className="line-clamp-2 text-[13px] leading-[18px] text-red-400">{profile.errorMessage}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleTrigger(type)}
                          disabled={isTriggering || isActive}
                          className="min-h-[44px] shrink-0 pl-2 text-[17px] text-sky-400 active:opacity-50 disabled:text-zinc-600"
                        >
                          {isTriggering
                            ? (
                                <Loader2 size={18} className="animate-spin" />
                              )
                            : isActive
                              ? (
                                  profile?.status === 'running' ? 'Running…' : 'Pending'
                                )
                              : (
                                  'Calibrate'
                                )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
        </section>

        {/* Full calibration button */}
        <button
          type="button"
          onClick={() => triggerFull.mutate({})}
          disabled={triggerFull.isPending || !!isAnyActive}
          className="flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-sky-500 text-[17px] font-semibold text-white active:opacity-80 disabled:opacity-40"
        >
          {triggerFull.isPending
            ? <Loader2 size={18} className="animate-spin" />
            : <RefreshCw size={18} />}
          Calibrate all sensors
        </button>
      </div>
    </Sheet>
  )
}
