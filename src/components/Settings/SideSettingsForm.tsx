'use client'

import { useState } from 'react'
import { ListSection } from '@/src/ui/ios'
import { trpc } from '@/src/utils/trpc'
import { SelectRow, SwitchRow, TextRow } from './SettingsRows'

interface SideData {
  side: 'left' | 'right'
  name: string
  awayMode: boolean
  alwaysOn: boolean
  autoOffEnabled: boolean
  autoOffMinutes: number
}

interface SideSettingsFormProps {
  side: 'left' | 'right'
  sideData: SideData
  /**
   * Whether presence can be sensed for this side (calibrated capSense2 + fresh
   * frame). `null` while the occupancy query is loading. When `false`, auto-off
   * can't reliably tell the bed is empty, so the toggle is gated off — enabling
   * it would do nothing (the watcher stands down on unsensable presence).
   */
  presenceAvailable: boolean | null
}

const AUTO_OFF_DURATION_OPTIONS = [5, 10, 15, 30, 45, 60, 90, 120] as const

function formatMinutes(mins: number) {
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/**
 * Per-side settings: name, away mode, always on, and auto-off for a single side.
 */
export function SideSettingsForm({ side, sideData, presenceAvailable }: SideSettingsFormProps) {
  const d = sideData ?? {
    side,
    name: side === 'left' ? 'Left' : 'Right',
    awayMode: false,
    alwaysOn: false,
    autoOffEnabled: false,
    autoOffMinutes: 30,
  }

  // key forces remount when server data changes, replacing the useEffect sync pattern
  return (
    <SideCard
      key={`${d.name}-${d.awayMode}-${d.alwaysOn}-${d.autoOffEnabled}-${d.autoOffMinutes}`}
      data={d}
      presenceAvailable={presenceAvailable}
    />
  )
}

function SideCard({ data, presenceAvailable }: { data: SideData, presenceAvailable: boolean | null }) {
  const utils = trpc.useUtils()
  const [name, setName] = useState(data.name)
  const [awayMode, setAwayMode] = useState(data.awayMode)
  const [alwaysOn, setAlwaysOn] = useState(data.alwaysOn)
  const [autoOffEnabled, setAutoOffEnabled] = useState(data.autoOffEnabled)
  const [autoOffMinutes, setAutoOffMinutes] = useState(data.autoOffMinutes)

  const mutation = trpc.settings.updateSide.useMutation({
    onSuccess: () => utils.settings.getAll.invalidate(),
  })

  const isPending = mutation.isPending
  const sideLabel = data.side === 'left' ? 'Left' : 'Right'
  // Block enabling auto-off when presence can't be sensed; always allow turning
  // it off. `null` (loading) is treated as available to avoid a flicker that
  // would block the toggle before the occupancy query resolves.
  const presenceUnavailable = presenceAvailable === false
  const autoOffToggleDisabled = isPending || (presenceUnavailable && !autoOffEnabled)

  function handleNameBlur() {
    const trimmed = name.trim()
    if (trimmed && trimmed !== data.name) {
      mutation.mutate({ side: data.side, name: trimmed })
    }
    else {
      setName(data.name) // revert
    }
  }

  function handleNameKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      ;(e.target as HTMLInputElement).blur()
    }
  }

  function handleAwayToggle() {
    const newVal = !awayMode
    setAwayMode(newVal)
    mutation.mutate({ side: data.side, awayMode: newVal })
  }

  function handleAlwaysOnToggle() {
    const newVal = !alwaysOn
    setAlwaysOn(newVal)
    // Always On and Auto-off are mutually exclusive — turning on Always On
    // disables Auto-off so the firmware never powers down mid-session.
    if (newVal && autoOffEnabled) {
      setAutoOffEnabled(false)
      mutation.mutate({ side: data.side, alwaysOn: true, autoOffEnabled: false })
    }
    else {
      mutation.mutate({ side: data.side, alwaysOn: newVal })
    }
  }

  function handleAutoOffToggle() {
    const newVal = !autoOffEnabled
    setAutoOffEnabled(newVal)
    // Mirror image of the Always On rule above.
    if (newVal && alwaysOn) {
      setAlwaysOn(false)
      mutation.mutate({ side: data.side, autoOffEnabled: true, alwaysOn: false })
    }
    else {
      mutation.mutate({ side: data.side, autoOffEnabled: newVal })
    }
  }

  function handleAutoOffMinutesChange(minutes: number) {
    setAutoOffMinutes(minutes)
    mutation.mutate({ side: data.side, autoOffMinutes: minutes })
  }

  const autoOffOptions = (AUTO_OFF_DURATION_OPTIONS as readonly number[]).includes(autoOffMinutes)
    ? AUTO_OFF_DURATION_OPTIONS
    : [...AUTO_OFF_DURATION_OPTIONS, autoOffMinutes].sort((a, b) => a - b)

  const autoOffFooter = presenceUnavailable
    ? (
        <span className="text-amber-400">
          {autoOffEnabled
            ? 'Presence sensing is unavailable, so auto-off is currently inactive. Calibrate the capacitance sensor for this side to restore it.'
            : 'Requires presence sensing. Calibrate the capacitance sensor for this side to enable auto-off.'}
        </span>
      )
    : 'Turns this side off after the bed has been empty for the chosen time.'

  return (
    <>
      <ListSection header={`${sideLabel} side`}>
        <TextRow
          id={`side-name-${data.side}`}
          title="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={handleNameKeyDown}
          maxLength={20}
          disabled={isPending}
          placeholder={sideLabel}
          enterKeyHint="done"
        />
      </ListSection>

      <ListSection>
        <SwitchRow
          title="Away mode"
          checked={awayMode}
          onChange={handleAwayToggle}
          disabled={isPending}
          ariaLabel={`Toggle away mode for ${sideLabel} side`}
        />
      </ListSection>

      <ListSection footer="Prevents the firmware's 8-hour auto-off. Turning this on disables auto-off when empty.">
        <SwitchRow
          title="Always on"
          checked={alwaysOn}
          onChange={handleAlwaysOnToggle}
          disabled={isPending}
          ariaLabel={`Toggle always on for ${sideLabel} side`}
        />
      </ListSection>

      <ListSection footer={autoOffFooter}>
        <SwitchRow
          title="Auto-off when empty"
          checked={autoOffEnabled}
          onChange={handleAutoOffToggle}
          disabled={autoOffToggleDisabled}
          ariaLabel={`Toggle auto-off for ${sideLabel} side`}
        />
        {autoOffEnabled && (
          <SelectRow
            title="Turn off after"
            ariaLabel="Auto-off after"
            value={autoOffMinutes}
            options={autoOffOptions.map(m => ({ value: m, label: formatMinutes(m) }))}
            onChange={handleAutoOffMinutesChange}
            disabled={isPending}
          />
        )}
      </ListSection>

      {mutation.error && (
        <p className="px-4 text-[13px] text-red-400">{mutation.error.message}</p>
      )}
    </>
  )
}
