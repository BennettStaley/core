'use client'

import { useCallback, useState } from 'react'
import { usePathname } from 'next/navigation'
import { trpc } from '@/src/utils/trpc'
import { PullToRefresh } from '@/src/components/PullToRefresh/PullToRefresh'
import { HealthCircle } from './HealthCircle'
import { HealthStatusCard } from './HealthStatusCard'
import { SystemInfoCard } from './SystemInfoCard'
import { UpdateCard } from './UpdateCard'
import { WaterModal } from './WaterModal'
import { CalibrationModal } from './CalibrationModal'
import { InternetToggleCard } from './InternetToggleCard'
import { PumpAlertsCard } from './PumpAlertsCard'
import { SystemLogViewer } from './SystemLogViewer'
import { FirmwareLogConsole } from '@/src/components/Sensors/FirmwareLogConsole'
import {
  Server,
  Cpu,
  RefreshCw,
  Radio,
  Cog,
  Gauge,
  ChevronRight,
  SquareTerminal,
} from 'lucide-react'
import { ListRow, ListSection, PageHeader } from '@/src/ui/ios'

const POLL_INTERVAL = 10_000

function formatMs(ms: number): string {
  if (ms < 1) return '<1ms'
  return `${Math.round(ms)}ms`
}

function dacMonitorStatus(status?: string): 'ok' | 'degraded' | 'error' | 'unknown' {
  if (!status) return 'unknown'
  if (status === 'not_initialized') return 'degraded'
  if (status === 'polling' || status === 'connected' || status === 'running') return 'ok'
  if (status === 'error' || status === 'disconnected') return 'error'
  return 'ok'
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()

  if (diffMs < 0) return 'past'

  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return '<1m'
  if (diffMin < 60) return `${diffMin}m`

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ${diffMin % 60}m`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ${diffHours % 24}h`
}

export function StatusScreen() {
  const [waterModalOpen, setWaterModalOpen] = useState(false)
  const [calibrationModalOpen, setCalibrationModalOpen] = useState(false)
  const [consoleOpen, setConsoleOpen] = useState(false)

  // Language prefix for in-app links (e.g. /en/debug), mirroring BottomNav.
  const pathname = usePathname()
  const lang = pathname?.split('/')[1] ?? 'en'

  // Health endpoints — poll every 10s
  const system = trpc.health.system.useQuery({}, { refetchInterval: POLL_INTERVAL })
  const hardware = trpc.health.hardware.useQuery({}, { refetchInterval: POLL_INTERVAL })
  const scheduler = trpc.health.scheduler.useQuery({}, { refetchInterval: POLL_INTERVAL })
  const dacMonitor = trpc.health.dacMonitor.useQuery({}, { refetchInterval: POLL_INTERVAL })

  // System info — less frequent
  const version = trpc.system.getVersion.useQuery({}, { refetchInterval: 60_000 })
  const internet = trpc.system.internetStatus.useQuery({}, { refetchInterval: POLL_INTERVAL })
  const wifi = trpc.system.wifiStatus.useQuery({}, { refetchInterval: POLL_INTERVAL })
  const logSources = trpc.system.getLogSources.useQuery({}, { refetchInterval: 30_000 })
  const waterLatest = trpc.waterLevel.getLatest.useQuery({}, { refetchInterval: 30_000 })
  const deviceStatus = trpc.device.getStatus.useQuery({}, { refetchInterval: 10_000 })

  // Calibration status for the summary line
  const calibrationStatus = trpc.calibration.getStatus.useQuery(
    { side: 'left' },
    { refetchInterval: 10_000 },
  )

  const utils = trpc.useUtils()

  /** Pull-to-refresh: refetch all status queries. */
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      utils.health.system.invalidate(),
      utils.health.hardware.invalidate(),
      utils.health.scheduler.invalidate(),
      utils.health.dacMonitor.invalidate(),
      utils.system.getVersion.invalidate(),
      utils.system.internetStatus.invalidate(),
      utils.system.wifiStatus.invalidate(),
      utils.system.getLogSources.invalidate(),
      utils.waterLevel.getLatest.invalidate(),
      utils.waterLevel.getAlerts.invalidate(),
      utils.pumpAlerts.list.invalidate(),
    ])
  }, [utils])

  // ─── Build service lists ──────────────────────────────────────────

  const coreServices = [
    {
      name: 'Database',
      description: system.data?.database?.status === 'ok'
        ? `Latency: ${formatMs(system.data.database.latencyMs)}`
        : undefined,
      status: (system.data?.database?.status ?? 'unknown') as 'ok' | 'degraded' | 'unknown',
      detail: system.data?.database?.error,
    },
    {
      name: 'System',
      description: system.data?.status === 'ok' ? 'All checks passing' : 'Degraded',
      status: (system.data?.status ?? 'unknown') as 'ok' | 'degraded' | 'unknown',
    },
    {
      name: 'Scheduler',
      description: scheduler.data?.enabled
        ? `Enabled \u00b7 ${scheduler.data?.jobCounts?.total ?? 0} jobs`
        : 'Disabled',
      status: (scheduler.data?.healthy ? 'ok' : scheduler.data?.enabled ? 'degraded' : 'ok') as 'ok' | 'degraded',
    },
  ]

  const hardwareServices = [
    {
      name: 'DAC Socket',
      description: hardware.data?.status === 'ok'
        ? `Connected \u00b7 ${formatMs(hardware.data.latencyMs)}`
        : hardware.data?.error ?? 'Checking\u2026',
      status: (hardware.data?.status ?? 'unknown') as 'ok' | 'degraded' | 'unknown',
      detail: hardware.data?.socketPath,
    },
    {
      name: 'DAC Monitor',
      description: dacMonitor.data?.status === 'not_initialized'
        ? 'Not initialized'
        : dacMonitor.data?.status ?? 'Checking\u2026',
      status: dacMonitorStatus(dacMonitor.data?.status),
      detail: dacMonitor.data?.podVersion
        ? `Pod version: ${dacMonitor.data.podVersion}`
        : undefined,
    },
  ]

  // Calibration summary for the card
  const calStatus = calibrationStatus.data
  const calSensors = ['piezo', 'capacitance', 'temperature'] as const
  const calCompleted = calSensors.filter(s => calStatus?.[s]?.status === 'completed').length
  const calRunning = calSensors.some(s => calStatus?.[s]?.status === 'running' || calStatus?.[s]?.status === 'pending')

  const calibrationServices = calSensors.map(type => ({
    name: type.charAt(0).toUpperCase() + type.slice(1),
    description: calStatus?.[type]
      ? calStatus[type].status === 'completed'
        ? `Quality: ${calStatus[type].qualityScore != null ? `${Math.round((calStatus[type].qualityScore as number) * 100)}%` : '--'}`
        : calStatus[type].status
      : 'No data',
    status: (calStatus?.[type]?.status === 'completed'
      ? 'ok'
      : calStatus?.[type]?.status === 'running' || calStatus?.[type]?.status === 'pending'
        ? 'degraded'
        : 'unknown') as 'ok' | 'degraded' | 'unknown',
  }))

  // Network — WiFi + Internet only
  const networkServices = [
    {
      name: 'Wi-Fi',
      description: wifi.data?.connected
        ? `${wifi.data.ssid ?? 'Connected'} \u00b7 ${wifi.data.signal ?? 0}%`
        : 'Not connected',
      status: (wifi.data?.connected ? 'ok' : 'degraded') as 'ok' | 'degraded',
    },
    {
      name: 'Internet',
      description: internet.data?.blocked ? 'Blocked (local only)' : 'Available',
      status: 'ok' as const,
    },
  ]

  // Systemd service units (separate card matching iOS)
  const systemdServices = (logSources.data?.sources ?? []).map(source => ({
    name: source.name,
    description: source.unit,
    status: (source.active ? 'ok' : 'degraded') as 'ok' | 'degraded',
  }))

  // Scheduler expanded content
  const jobCounts = scheduler.data?.jobCounts
  const drift = system.data?.scheduler?.drift
  const upcomingJobs = scheduler.data?.upcomingJobs as Array<{
    id: string
    type: string
    side?: string
    nextRun: string | null
  }> | undefined

  const jobBreakdown = jobCounts
    ? ([
        ['Temperature', jobCounts.temperature],
        ['Power on', jobCounts.powerOn],
        ['Power off', jobCounts.powerOff],
        ['Alarm', jobCounts.alarm],
        ['Prime', jobCounts.prime],
        ['Reboot', jobCounts.reboot],
      ] as const).filter(([, count]) => count > 0)
    : []

  const schedulerExpandedContent = (
    <div className="space-y-3 text-[13px] leading-[18px]">
      {jobBreakdown.length > 0 && (
        <div className="space-y-1">
          <p className="text-zinc-500">Job breakdown</p>
          <div className="ios-numeric grid grid-cols-2 gap-x-3 gap-y-0.5">
            {jobBreakdown.map(([label, count]) => (
              <span key={label} className="flex justify-between gap-2 text-zinc-300">
                <span>{label}</span>
                <span className="text-zinc-500">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {drift && (
        <p className={drift.drifted ? 'text-amber-400' : 'text-zinc-500'}>
          {drift.drifted
            ? `Drifted: ${drift.dbScheduleCount} in database vs ${drift.schedulerJobCount} active`
            : `In sync \u00b7 ${drift.dbScheduleCount} schedules`}
        </p>
      )}
      {upcomingJobs && upcomingJobs.length > 0 && (
        <div className="space-y-1">
          <p className="text-zinc-500">Upcoming jobs</p>
          {upcomingJobs.slice(0, 5).map(job => (
            <div key={job.id} className="flex items-center justify-between gap-3">
              <span className="text-zinc-300">
                {job.type}
                {job.side && <span className="ml-1 text-zinc-500">{`(${job.side})`}</span>}
              </span>
              <span className="ios-numeric text-zinc-500">
                {job.nextRun ? formatRelativeTime(job.nextRun) : '\u2014'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ─── Aggregate totals ─────────────────────────────────────────────

  const allServices = [...coreServices, ...hardwareServices, ...calibrationServices, ...networkServices, ...systemdServices]
  const totalHealthy = allServices.filter(s => s.status === 'ok').length
  const totalServices = allServices.length

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-6 pb-4">
        <PageHeader title="Status" />

        <HealthCircle
          healthy={totalHealthy}
          total={totalServices}
          podVersion={dacMonitor.data?.podVersion}
          sensorLabel={deviceStatus.data?.sensorLabel ?? undefined}
          branch={version.data?.branch}
          commitHash={version.data?.commitHash}
          internetBlocked={internet.data?.blocked}
          wifiSsid={wifi.data?.ssid ?? undefined}
          wifiSignal={wifi.data?.signal ?? undefined}
          podIP={typeof window !== 'undefined' ? window.location.hostname : undefined}
          waterLevel={waterLatest.data?.level ?? undefined}
          isPriming={deviceStatus.data?.isPriming ?? false}
          onWaterClick={() => setWaterModalOpen(true)}
        />

        {/* Pump alert history — renders only while active alerts exist */}
        <PumpAlertsCard />

        {/* Service health groups */}
        <ListSection header="Health" className="[&>div>div]:rounded-none">
          <HealthStatusCard
            title="Core"
            description="Server, database, and scheduler"
            icon={Server}
            iconColor="text-sky-400"
            iconBg="bg-sky-400/20"
            services={coreServices}
            isLoading={system.isLoading}
            expandedContent={schedulerExpandedContent}
          />
          <HealthStatusCard
            title="Hardware"
            description="DAC socket and monitoring"
            icon={Cpu}
            iconColor="text-purple-400"
            iconBg="bg-purple-400/20"
            services={hardwareServices}
            isLoading={hardware.isLoading || dacMonitor.isLoading}
          />
          <HealthStatusCard
            title="Calibration"
            description={calRunning ? 'Running…' : `${calCompleted} of 3 sensors calibrated`}
            icon={RefreshCw}
            iconColor="text-orange-400"
            iconBg="bg-orange-400/20"
            services={calibrationServices}
            isLoading={calibrationStatus.isLoading}
            onHeaderClick={() => setCalibrationModalOpen(true)}
          />
          <HealthStatusCard
            title="Network"
            description="Wi-Fi and internet connectivity"
            icon={Radio}
            iconColor="text-teal-400"
            iconBg="bg-teal-400/20"
            services={networkServices}
            isLoading={wifi.isLoading}
          />
          <HealthStatusCard
            title="Services"
            description="Systemd service units"
            icon={Cog}
            iconColor="text-cyan-400"
            iconBg="bg-cyan-400/20"
            services={systemdServices}
            isLoading={logSources.isLoading}
          />
        </ListSection>

        {/* Internet access toggle */}
        <InternetToggleCard />

        {/* Software update */}
        <UpdateCard />

        {/* System info — branch/commit/build date + full disk usage */}
        <SystemInfoCard />

        {/* Tools: diagnostics console, journal logs, firmware console */}
        <ListSection
          header="Troubleshooting"
          footer={system.dataUpdatedAt
            ? `Last updated ${new Date(system.dataUpdatedAt).toLocaleTimeString()}`
            : undefined}
        >
          <ListRow
            title="Diagnostics"
            subtitle="Thermal delivery, scheduler, health, sensors, and logs"
            icon={Gauge}
            iconTile="bg-orange-500"
            href={`/${lang}/debug`}
          />
          <SystemLogViewer />
          <div>
            <ListRow
              title="Firmware console"
              icon={SquareTerminal}
              iconTile="bg-zinc-600"
              onClick={() => setConsoleOpen(v => !v)}
              accessory={(
                <ChevronRight
                  size={18}
                  className={`shrink-0 text-zinc-600 transition-transform duration-200 ${consoleOpen ? 'rotate-90' : ''}`}
                />
              )}
            />
            {consoleOpen && (
              <div className="border-t border-zinc-800 p-4">
                <FirmwareLogConsole />
              </div>
            )}
          </div>
        </ListSection>
      </div>

      {/* Water + Priming sheet */}
      <WaterModal open={waterModalOpen} onClose={() => setWaterModalOpen(false)} />

      {/* Calibration sheet */}
      <CalibrationModal open={calibrationModalOpen} onClose={() => setCalibrationModalOpen(false)} />

    </PullToRefresh>
  )
}
