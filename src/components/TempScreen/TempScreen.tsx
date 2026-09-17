'use client'

import { useCallback } from 'react'
import { trpc } from '@/src/utils/trpc'
import { useSide } from '@/src/providers/SideProvider'
import { useDeviceStatus } from '@/src/hooks/useDeviceStatus'
import { useOptimisticValue } from '@/src/hooks/useOptimisticValue'
import { SideSelector } from '@/src/components/SideSelector/SideSelector'
import { EnvironmentInfoPanel } from '@/src/components/EnvironmentInfo/EnvironmentInfoPanel'
import { TemperatureDial } from '@/src/components/TemperatureDial/TemperatureDial'
import { AlarmBanner } from '@/src/components/TempScreen/AlarmBanner'
import { PrimingIndicator } from '@/src/components/TempScreen/PrimingIndicator'
import { PrimeCompleteNotification } from '@/src/components/TempScreen/PrimeCompleteNotification'
import { PumpStallNotification } from '@/src/components/TempScreen/PumpStallNotification'
import { AmbientLightChip } from '@/src/components/TempScreen/AmbientLightChip'
import { displayToSetpointF, setpointFToDisplay, type TempUnit } from '@/src/lib/tempUtils'
import { TEMP } from '@/src/lib/tempColors'
import { Minus, Plus, Power } from 'lucide-react'
import clsx from 'clsx'
import { PageHeader } from '@/src/ui/ios'
import { StatusChips } from '@/src/components/StatusChips/StatusChips'

/**
 * Main temperature screen — mirrors iOS TempScreen.swift composition.
 *
 * Layout ("Tonight"):
 * 1. PageHeader with StatusChips (away / night)
 * 2. SideSelector (segmented Left/Right + link button)
 * 3. Notices: pump stall, priming, prime complete, alarm
 * 4. TemperatureDial (270° dial with draggable thumb)
 * 5. Temp controls (− / power / +)
 * 6. EnvironmentInfoPanel footnote (inside temp, ambient light)
 *
 * Device router wiring:
 * - device.getStatus (query, 7s poll) → current/target temp, power, alarm, priming, snooze
 * - device.setTemperature (mutation) → dial drag + ±1 buttons
 * - device.setPower (mutation) → power toggle
 * - device.clearAlarm (mutation) → alarm banner stop button
 * - device.snoozeAlarm (mutation) → alarm banner snooze button
 * - device.dismissPrimeNotification (mutation) → prime complete dismiss
 * - settings.getAll (query) → temperature unit preference
 * - environment.getLatestBedTemp (query) → EnvironmentInfoPanel
 * - environment.getLatestFreezerTemp (query) → EnvironmentInfoPanel
 * - environment.getLatestAmbientLight (query) → AmbientLightChip
 * - biometrics.getLatestSleep (query) → LatestSleepChip
 *
 * Polls device.getStatus every 7 seconds for real-time updates.
 * Uses optimistic local target temp during dial drag for smooth interaction.
 */
export const TempScreen = () => {
  const { primarySide, activeSides } = useSide()

  // Device status via WebSocket (2s push) with HTTP fallback
  const { status, isLoading: statusLoading, refetch } = useDeviceStatus()

  const { data: settings } = trpc.settings.getAll.useQuery({})
  const unit: TempUnit = (settings?.device?.temperatureUnit as TempUnit) ?? 'F'

  const setTempMutation = trpc.device.setTemperature.useMutation()
  const setPowerMutation = trpc.device.setPower.useMutation()

  // Get current side's status
  const currentSideStatus = primarySide === 'left' ? status?.leftSide : status?.rightSide
  const currentTemp = currentSideStatus?.currentTemperature ?? 80
  const serverTarget = currentSideStatus?.targetTemperature ?? 80
  const targetLevel = currentSideStatus?.targetLevel ?? 0

  // Optimistic overrides: the visible status is WS-preferred (~2s cadence),
  // so clearing local state in onSettled snapped the dial back to the stale
  // value, then forward when the next frame arrived. These hold the local
  // value until the server confirms it (or a timeout gives up).
  const targetOpt = useOptimisticValue(serverTarget)
  const powerOpt = useOptimisticValue(targetLevel !== 0)
  const targetTemp = targetOpt.value
  const isOn = powerOpt.value

  // Alarm & priming status from device
  const leftAlarmActive = status?.leftSide?.isAlarmVibrating ?? false
  const rightAlarmActive = status?.rightSide?.isAlarmVibrating ?? false
  const isPriming = status?.isPriming ?? false
  const hasPrimeNotification = status?.primeCompletedNotification != null
  const stallNotices = status?.pumpStallNotifications
  const snoozeStatus = status?.snooze

  /** Handle continuous drag updates — visual only, no hardware calls. */
  const handleDialChange = useCallback((tempF: number) => {
    targetOpt.preview(tempF)
  }, [targetOpt])

  /** Handle drag end — send final value to hardware, keep it visible until
   * an incoming status frame confirms it. */
  const handleDialCommit = useCallback((tempF: number) => {
    targetOpt.commit(tempF)
    for (const side of activeSides) {
      setTempMutation.mutate(
        { side, temperature: tempF },
        {
          onSettled: () => refetch(),
          onError: () => targetOpt.discard(),
        },
      )
    }
  }, [activeSides, setTempMutation, refetch, targetOpt])

  const handleTempAdjust = (delta: number) => {
    const displayValue = setpointFToDisplay(targetTemp, unit) ?? targetTemp
    const converted = displayToSetpointF(displayValue + delta, unit) ?? targetTemp
    const newTemp = Math.round(Math.max(TEMP.MIN_F, Math.min(TEMP.MAX_F, converted)))
    targetOpt.commit(newTemp)
    for (const side of activeSides) {
      setTempMutation.mutate(
        { side, temperature: newTemp },
        {
          onSettled: () => refetch(),
          onError: () => targetOpt.discard(),
        },
      )
    }
  }

  const handlePowerToggle = () => {
    const nextPowered = !isOn
    powerOpt.commit(nextPowered)
    for (const side of activeSides) {
      setPowerMutation.mutate(
        { side, powered: nextPowered },
        {
          onSettled: () => refetch(),
          onError: () => powerOpt.discard(),
        },
      )
    }
  }

  const header = <PageHeader title="Tonight" trailing={<StatusChips />} />

  if (statusLoading) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <div className="flex items-center justify-center py-20">
          <span className="text-[15px] text-zinc-500">Connecting…</span>
        </div>
      </div>
    )
  }

  const stepButtonClass = clsx(
    'flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800 text-white transition-opacity',
    'active:opacity-60 disabled:opacity-40',
  )

  return (
    <div className="flex flex-col gap-4 pb-4">
      {header}

      <SideSelector />

      {/* Pump stall — highest priority, dismissible per-side */}
      {stallNotices?.left && (
        <PumpStallNotification
          side="left"
          rpm={stallNotices.left.rpm}
          trippedAt={stallNotices.left.trippedAt}
          alertId={stallNotices.left.alertId}
          onAction={() => refetch()}
        />
      )}
      {stallNotices?.right && (
        <PumpStallNotification
          side="right"
          rpm={stallNotices.right.rpm}
          trippedAt={stallNotices.right.trippedAt}
          alertId={stallNotices.right.alertId}
          onAction={() => refetch()}
        />
      )}

      {/* Priming indicator — shown when pod water system is actively priming */}
      {isPriming && <PrimingIndicator />}

      {/* Prime completion notification — dismissible */}
      {hasPrimeNotification && !isPriming && (
        <PrimeCompleteNotification onDismiss={() => refetch()} />
      )}

      {/* Alarm banner — active vibration with snooze/stop, or snoozed countdown */}
      <AlarmBanner
        leftAlarmActive={leftAlarmActive}
        rightAlarmActive={rightAlarmActive}
        snooze={snoozeStatus}
        onActionComplete={refetch}
      />

      <div className="flex flex-col items-center pt-2">
        <TemperatureDial
          currentTempF={currentTemp}
          targetTempF={targetTemp}
          isOn={isOn}
          unit={unit}
          onTemperatureChange={handleDialChange}
          onTemperatureCommit={handleDialCommit}
        />

        {/* Temperature controls: − / power / + */}
        <div className="flex items-center justify-center gap-8">
          <button
            type="button"
            onClick={() => handleTempAdjust(-1)}
            disabled={!isOn || setTempMutation.isPending}
            aria-label="Decrease temperature"
            className={stepButtonClass}
          >
            <Minus size={24} strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={handlePowerToggle}
            disabled={setPowerMutation.isPending}
            aria-label={isOn ? 'Turn off' : 'Turn on'}
            aria-pressed={isOn}
            className={clsx(
              'flex h-16 w-16 items-center justify-center rounded-full transition-colors active:opacity-60',
              isOn ? 'bg-sky-500 text-white' : 'bg-zinc-800 text-zinc-400',
            )}
          >
            <Power size={26} strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={() => handleTempAdjust(1)}
            disabled={!isOn || setTempMutation.isPending}
            aria-label="Increase temperature"
            className={stepButtonClass}
          >
            <Plus size={24} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Environment footnote: inside temp + ambient light */}
      <EnvironmentInfoPanel unit={unit}>
        <AmbientLightChip />
      </EnvironmentInfoPanel>
    </div>
  )
}
