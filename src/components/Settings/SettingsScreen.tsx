'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronRight, Cog, HardDriveUpload, Hand, Home, Radio, Users, Vibrate } from 'lucide-react'
import { trpc } from '@/src/utils/trpc'
import { useSideNames } from '@/src/hooks/useSideNames'
import { ListRow, ListSection, PageHeader, SegmentedControl } from '@/src/ui/ios'
import { DeviceSettingsForm } from './DeviceSettingsForm'
import { SideSettingsForm } from './SideSettingsForm'
import { TapGestureConfig } from './TapGestureConfig'
import { HapticsTestCard } from './HapticsTestCard'
import { MqttSettingsForm } from './MqttSettingsForm'
import { HomeKitConfig } from './HomeKitConfig'
import { ArchivePushSettingsForm } from './ArchivePushSettingsForm'
import { ActionRow, SettingsDetail } from './SettingsRows'

const SECTION_IDS = ['device', 'sides', 'gestures', 'vibration', 'homekit', 'mqtt', 'backup'] as const
type SectionId = typeof SECTION_IDS[number]

const SECTION_TITLES: Record<SectionId, string> = {
  device: 'General',
  sides: 'Sides',
  gestures: 'Tap gestures',
  vibration: 'Vibration',
  homekit: 'HomeKit',
  mqtt: 'MQTT',
  backup: 'Backup',
}

function isSectionId(v: string | null): v is SectionId {
  return v !== null && (SECTION_IDS as readonly string[]).includes(v)
}

/**
 * Settings screen, structured like iOS Settings: a root grouped list whose
 * rows drill into a section. The open section is URL-synced (`?tab=mqtt`) so
 * existing deep links keep working; no `tab` shows the root list.
 */
export function SettingsScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const active: SectionId | null = isSectionId(tabParam) ? tabParam : null
  // True when the current section was opened from the root list in this
  // session, so "back" can pop history instead of stacking a new entry.
  const pushedFromRoot = useRef(false)

  const { data, isLoading, error } = trpc.settings.getAll.useQuery({})

  const open = useCallback(
    (next: SectionId) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', next)
      pushedFromRoot.current = true
      router.push(`?${params.toString()}`, { scroll: false })
      window.scrollTo({ top: 0 })
    },
    [router, searchParams],
  )

  const back = useCallback(() => {
    if (pushedFromRoot.current) {
      pushedFromRoot.current = false
      router.back()
      return
    }
    const params = new URLSearchParams(searchParams.toString())
    params.delete('tab')
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : '?', { scroll: false })
  }, [router, searchParams])

  if (isLoading) {
    return (
      <div className="space-y-6 pb-4">
        <PageHeader title="Settings" />
        {[3, 2, 3].map((rows, i) => (
          <div key={i} className="animate-pulse rounded-xl bg-zinc-900" style={{ height: rows * 44 }} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6 pb-4">
        <PageHeader title="Settings" />
        <ListSection footer={error.message}>
          <ListRow title={<span className="text-red-400">Failed to load settings</span>} />
        </ListSection>
      </div>
    )
  }

  if (!data) return null

  if (active) {
    return (
      <SettingsDetail title={SECTION_TITLES[active]} onBack={back}>
        {active === 'device' && <DeviceSection device={data.device} />}
        {active === 'sides' && <SidesSection data={data} />}
        {active === 'gestures' && <TapGestureConfig />}
        {active === 'vibration' && <HapticsTestCard />}
        {active === 'homekit' && <HomeKitConfig />}
        {active === 'mqtt' && <MqttSettingsForm />}
        {active === 'backup' && <ArchivePushSettingsForm />}
      </SettingsDetail>
    )
  }

  return <SettingsRoot onOpen={open} unit={data.device.temperatureUnit} />
}

function onOff(value: boolean | undefined) {
  if (value === undefined) return undefined
  return value ? 'On' : 'Off'
}

function SettingsRoot({ onOpen, unit }: { onOpen: (id: SectionId) => void, unit: string }) {
  const { leftName, rightName } = useSideNames()
  const homekit = trpc.homekit.getStatus.useQuery({}, { staleTime: 30_000 })
  const mqtt = trpc.mqtt.getSettings.useQuery({}, { staleTime: 30_000 })
  const backup = trpc.archivePush.getConfig.useQuery({}, { staleTime: 30_000 })

  return (
    <div className="space-y-6 pb-4">
      <PageHeader title="Settings" />

      <ListSection>
        <ListRow
          onClick={() => onOpen('device')}
          icon={Cog}
          iconTile="bg-zinc-600"
          title="General"
          value={`°${unit}`}
          accessory={<Chevron />}
        />
        <ListRow
          onClick={() => onOpen('sides')}
          icon={Users}
          iconTile="bg-sky-500"
          title="Sides"
          value={<span className="block max-w-[140px] truncate">{`${leftName}, ${rightName}`}</span>}
          accessory={<Chevron />}
        />
      </ListSection>

      <ListSection header="Pod cover">
        <ListRow onClick={() => onOpen('gestures')} icon={Hand} iconTile="bg-orange-500" title="Tap gestures" accessory={<Chevron />} />
        <ListRow onClick={() => onOpen('vibration')} icon={Vibrate} iconTile="bg-indigo-500" title="Vibration" accessory={<Chevron />} />
      </ListSection>

      <ListSection header="Integrations">
        <ListRow
          onClick={() => onOpen('homekit')}
          icon={Home}
          iconTile="bg-emerald-500"
          title="HomeKit"
          value={onOff(homekit.data?.enabled)}
          accessory={<Chevron />}
        />
        <ListRow
          onClick={() => onOpen('mqtt')}
          icon={Radio}
          iconTile="bg-teal-500"
          title="MQTT and Home Assistant"
          value={onOff(mqtt.data?.enabled)}
          accessory={<Chevron />}
        />
        <ListRow
          onClick={() => onOpen('backup')}
          icon={HardDriveUpload}
          iconTile="bg-zinc-600"
          title="Backup"
          value={onOff(backup.data?.config.enabled)}
          accessory={<Chevron />}
        />
      </ListSection>
    </div>
  )
}

function Chevron() {
  return <ChevronRight size={18} className="shrink-0 text-zinc-600" />
}

interface DeviceSectionProps {
  device: Parameters<typeof DeviceSettingsForm>[0]['device']
}

function DeviceSection({ device }: DeviceSectionProps) {
  const rebootMutation = trpc.system.triggerUpdate.useMutation()
  return (
    <>
      <DeviceSettingsForm device={device} />

      <ListSection
        header="Service"
        footer={rebootMutation.isSuccess
          ? <span className="text-emerald-400">Service restarting, reconnecting…</span>
          : rebootMutation.error
            ? <span className="text-red-400">{rebootMutation.error.message}</span>
            : 'Restarting briefly makes the pod unavailable.'}
      >
        <ActionRow title="Reconnect" onClick={() => window.location.reload()} />
        <ActionRow
          title={rebootMutation.isPending ? 'Restarting…' : 'Restart service'}
          destructive
          disabled={rebootMutation.isPending}
          onClick={() => {
            if (confirm('Restart the sleepypod service? The pod will be briefly unavailable.')) {
              rebootMutation.mutate({})
            }
          }}
        />
      </ListSection>
    </>
  )
}

interface SettingsData {
  device: Parameters<typeof DeviceSettingsForm>[0]['device']
  sides: {
    left: Parameters<typeof SideSettingsForm>[0]['sideData']
    right: Parameters<typeof SideSettingsForm>[0]['sideData']
  }
}

function SidesSection({ data }: { data: SettingsData }) {
  const [selectedSide, setSelectedSide] = useState<'left' | 'right'>('left')
  const { leftName, rightName } = useSideNames()
  // Drives the auto-off toggle gate: the feature is only safe where presence
  // can be sensed. Polls so a side that comes online (calibration completes,
  // sensor stream resumes) re-enables the toggle without a manual refresh.
  const { data: occupancy } = trpc.biometrics.getOccupancy.useQuery(undefined, {
    refetchInterval: 10000,
    refetchOnWindowFocus: false,
  })
  const presenceAvailable = occupancy?.[selectedSide].available ?? null

  return (
    <>
      <SegmentedControl
        aria-label="Side"
        options={[
          { value: 'left', label: leftName },
          { value: 'right', label: rightName },
        ]}
        value={selectedSide}
        onChange={setSelectedSide}
      />

      <SideSettingsForm
        side={selectedSide}
        sideData={selectedSide === 'left' ? data.sides.left : data.sides.right}
        presenceAvailable={presenceAvailable}
      />
    </>
  )
}
