'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, CheckCircle2, ChevronRight, Loader2, Moon, Search } from 'lucide-react'
import { trpc } from '@/src/utils/trpc'
import { ListRow, ListSection, SegmentedControl, Sheet } from '@/src/ui/ios'
import { NumberRow, SliderRow, SwitchRow, TimeRow } from './SettingsRows'

interface DeviceSettings {
  timezone: string
  temperatureUnit: string
  rebootDaily: boolean
  rebootTime: string | null
  primePodDaily: boolean
  primePodTime: string | null
  ledNightModeEnabled: boolean
  ledDayBrightness: number
  ledNightBrightness: number
  ledNightStartTime: string | null
  ledNightEndTime: string | null
  globalMaxOnHours: number | null
  pumpStallProtectionEnabled: boolean
  pumpStallRpmThreshold: number
  pumpStallDwellSamples: number
  pumpStallAutoRecoveryEnabled: boolean
  pumpStallRecoveryRpm: number
  pumpStallRecoverySamples: number
}

const DEFAULT_MAX_ON_HOURS = 12

// Common US/international timezones
const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Phoenix',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Pacific/Auckland',
]

/**
 * Device-level settings form: timezone, temperature unit, reboot schedule, prime pod schedule.
 * Matches iOS DeviceSettingsCardView device section.
 */
export function DeviceSettingsForm({ device }: { device: DeviceSettings }) {
  const utils = trpc.useUtils()

  const [timezone, setTimezone] = useState(device.timezone)
  const [tempUnit, setTempUnit] = useState(device.temperatureUnit)
  const [rebootDaily, setRebootDaily] = useState(device.rebootDaily)
  const [rebootTime, setRebootTime] = useState(device.rebootTime ?? '03:00')
  const [primePodDaily, setPrimePodDaily] = useState(device.primePodDaily)
  const [primePodTime, setPrimePodTime] = useState(device.primePodTime ?? '14:00')
  const [maxOnEnabled, setMaxOnEnabled] = useState(device.globalMaxOnHours != null)
  const [maxOnHours, setMaxOnHours] = useState(device.globalMaxOnHours ?? DEFAULT_MAX_ON_HOURS)
  const [ledDayBrightness, setLedDayBrightness] = useState(device.ledDayBrightness)
  const [ledNightEnabled, setLedNightEnabled] = useState(device.ledNightModeEnabled)
  const [ledNightBrightness, setLedNightBrightness] = useState(device.ledNightBrightness)
  const [ledNightStart, setLedNightStart] = useState(device.ledNightStartTime ?? '22:00')
  const [ledNightEnd, setLedNightEnd] = useState(device.ledNightEndTime ?? '07:00')
  const [pumpStallEnabled, setPumpStallEnabled] = useState(device.pumpStallProtectionEnabled)
  const [pumpStallThreshold, setPumpStallThreshold] = useState(device.pumpStallRpmThreshold)
  const [pumpStallDwell, setPumpStallDwell] = useState(device.pumpStallDwellSamples)
  const [pumpAutoRecover, setPumpAutoRecover] = useState(device.pumpStallAutoRecoveryEnabled)
  const [pumpRecoveryRpm, setPumpRecoveryRpm] = useState(device.pumpStallRecoveryRpm)
  const [pumpRecoverySamples, setPumpRecoverySamples] = useState(device.pumpStallRecoverySamples)

  // Sync from server data when it changes. Gated on a value fingerprint:
  // `device` gets a new object identity on every refetch (poll, focus,
  // mutation invalidate), and resetting on identity alone stomped fields the
  // user was actively editing.
  const lastSyncedDevice = useRef(JSON.stringify(device))
  useEffect(() => {
    const fingerprint = JSON.stringify(device)
    if (fingerprint === lastSyncedDevice.current) return
    lastSyncedDevice.current = fingerprint
    setTimezone(device.timezone)
    setTempUnit(device.temperatureUnit)
    setRebootDaily(device.rebootDaily)
    setRebootTime(device.rebootTime ?? '03:00')
    setPrimePodDaily(device.primePodDaily)
    setPrimePodTime(device.primePodTime ?? '14:00')
    setMaxOnEnabled(device.globalMaxOnHours != null)
    setMaxOnHours(device.globalMaxOnHours ?? DEFAULT_MAX_ON_HOURS)
    setLedDayBrightness(device.ledDayBrightness)
    setLedNightEnabled(device.ledNightModeEnabled)
    setLedNightBrightness(device.ledNightBrightness)
    setLedNightStart(device.ledNightStartTime ?? '22:00')
    setLedNightEnd(device.ledNightEndTime ?? '07:00')
    setPumpStallEnabled(device.pumpStallProtectionEnabled)
    setPumpStallThreshold(device.pumpStallRpmThreshold)
    setPumpStallDwell(device.pumpStallDwellSamples)
    setPumpAutoRecover(device.pumpStallAutoRecoveryEnabled)
    setPumpRecoveryRpm(device.pumpStallRecoveryRpm)
    setPumpRecoverySamples(device.pumpStallRecoverySamples)
  }, [device])

  const [savedFlash, setSavedFlash] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mutation = trpc.settings.updateDevice.useMutation({
    onSuccess: () => {
      utils.settings.getAll.invalidate()
      setSavedFlash(true)
      if (savedTimer.current) clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSavedFlash(false), 1500)
    },
  })
  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current)
  }, [])

  const isPending = mutation.isPending

  function save(updates: Partial<{
    timezone: string
    temperatureUnit: 'F' | 'C'
    rebootDaily: boolean
    rebootTime: string
    primePodDaily: boolean
    primePodTime: string
    globalMaxOnHours: number | null
    ledNightModeEnabled: boolean
    ledDayBrightness: number
    ledNightBrightness: number
    ledNightStartTime: string
    ledNightEndTime: string
    pumpStallProtectionEnabled: boolean
    pumpStallRpmThreshold: number
    pumpStallDwellSamples: number
    pumpStallAutoRecoveryEnabled: boolean
    pumpStallRecoveryRpm: number
    pumpStallRecoverySamples: number
  }>) {
    mutation.mutate(updates)
  }

  function handleTimezoneChange(tz: string) {
    setTimezone(tz)
    save({ timezone: tz })
  }

  function handleTempUnitChange(unit: 'F' | 'C') {
    setTempUnit(unit)
    save({ temperatureUnit: unit })
  }

  function handleRebootToggle() {
    const newVal = !rebootDaily
    setRebootDaily(newVal)
    if (newVal) {
      save({ rebootDaily: true, rebootTime })
    }
    else {
      save({ rebootDaily: false })
    }
  }

  function handleRebootTimeChange(time: string) {
    setRebootTime(time)
    save({ rebootTime: time })
  }

  function handlePrimeToggle() {
    const newVal = !primePodDaily
    setPrimePodDaily(newVal)
    if (newVal) {
      save({ primePodDaily: true, primePodTime })
    }
    else {
      save({ primePodDaily: false })
    }
  }

  function handlePrimeTimeChange(time: string) {
    setPrimePodTime(time)
    save({ primePodTime: time })
  }

  function handleMaxOnToggle() {
    const newVal = !maxOnEnabled
    setMaxOnEnabled(newVal)
    save({ globalMaxOnHours: newVal ? maxOnHours : null })
  }

  function handleMaxOnHoursChange(hours: number) {
    // Clamp to the router's 1–48 range before emitting.
    const clamped = Math.max(1, Math.min(48, Math.round(hours)))
    setMaxOnHours(clamped)
    if (maxOnEnabled) save({ globalMaxOnHours: clamped })
  }

  // LED brightness handlers — sliders update local state continuously, but the
  // mutation only fires on pointer/touch release so dragging doesn't flood the
  // hardware with SET_SETTINGS commands.
  function handleLedDayChange(brightness: number) {
    setLedDayBrightness(brightness)
  }

  function commitLedDay() {
    if (ledDayBrightness !== device.ledDayBrightness) {
      save({ ledDayBrightness })
    }
  }

  function handleLedNightToggle() {
    const newVal = !ledNightEnabled
    setLedNightEnabled(newVal)
    if (newVal) {
      save({
        ledNightModeEnabled: true,
        ledNightStartTime: ledNightStart,
        ledNightEndTime: ledNightEnd,
      })
    }
    else {
      save({ ledNightModeEnabled: false })
    }
  }

  function handleLedNightBrightnessChange(brightness: number) {
    setLedNightBrightness(brightness)
  }

  function commitLedNightBrightness() {
    if (ledNightBrightness !== device.ledNightBrightness) {
      save({ ledNightBrightness })
    }
  }

  function handleLedNightStartChange(time: string) {
    setLedNightStart(time)
    save({ ledNightStartTime: time })
  }

  function handleLedNightEndChange(time: string) {
    setLedNightEnd(time)
    save({ ledNightEndTime: time })
  }

  function handlePumpStallToggle() {
    const next = !pumpStallEnabled
    setPumpStallEnabled(next)
    save({ pumpStallProtectionEnabled: next })
  }

  // Pump-safety number inputs: update state on every keystroke but only clamp
  // + save on blur so partial values like "5" → "500" aren't clamped to the
  // min mid-type and don't fire a mutation per character.
  function handlePumpStallThreshold(rpm: number) {
    setPumpStallThreshold(rpm)
  }

  function commitPumpStallThreshold() {
    const clamped = Math.max(100, Math.min(1500, Math.round(pumpStallThreshold)))
    setPumpStallThreshold(clamped)
    if (clamped !== device.pumpStallRpmThreshold) save({ pumpStallRpmThreshold: clamped })
  }

  function handlePumpStallDwell(samples: number) {
    setPumpStallDwell(samples)
  }

  function commitPumpStallDwell() {
    const clamped = Math.max(1, Math.min(10, Math.round(pumpStallDwell)))
    setPumpStallDwell(clamped)
    if (clamped !== device.pumpStallDwellSamples) save({ pumpStallDwellSamples: clamped })
  }

  function handlePumpAutoRecoverToggle() {
    const next = !pumpAutoRecover
    setPumpAutoRecover(next)
    save({ pumpStallAutoRecoveryEnabled: next })
  }

  function handlePumpRecoveryRpm(rpm: number) {
    setPumpRecoveryRpm(rpm)
  }

  function commitPumpRecoveryRpm() {
    const clamped = Math.max(500, Math.min(3000, Math.round(pumpRecoveryRpm)))
    setPumpRecoveryRpm(clamped)
    if (clamped !== device.pumpStallRecoveryRpm) save({ pumpStallRecoveryRpm: clamped })
  }

  function handlePumpRecoverySamples(samples: number) {
    setPumpRecoverySamples(samples)
  }

  function commitPumpRecoverySamples() {
    const clamped = Math.max(1, Math.min(10, Math.round(pumpRecoverySamples)))
    setPumpRecoverySamples(clamped)
    if (clamped !== device.pumpStallRecoverySamples) save({ pumpStallRecoverySamples: clamped })
  }

  const showToast = isPending || savedFlash
  const [tzSheetOpen, setTzSheetOpen] = useState(false)

  return (
    <>
      <div
        aria-live="polite"
        className={`pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 transition-opacity duration-200 sm:bottom-28 ${
          showToast ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center gap-2 rounded-full bg-zinc-800/95 px-3.5 py-2 text-[13px] font-medium text-zinc-200 backdrop-blur">
          {isPending
            ? (
                <>
                  <Loader2 size={14} className="animate-spin text-sky-400" />
                  Saving…
                </>
              )
            : savedFlash
              ? (
                  <>
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    Saved
                  </>
                )
              : null}
        </div>
      </div>

      <ListSection>
        <ListRow
          title="Time zone"
          onClick={() => setTzSheetOpen(true)}
          disabled={isPending}
          value={<span className="block max-w-[170px] truncate">{formatZone(timezone)}</span>}
          accessory={<ChevronRight size={18} className="shrink-0 text-zinc-600" />}
        />
        <ListRow
          title="Temperature"
          accessory={(
            <SegmentedControl
              aria-label="Temperature unit"
              className="w-[112px] shrink-0"
              options={[{ value: 'F', label: '°F' }, { value: 'C', label: '°C' }]}
              value={tempUnit === 'C' ? 'C' : 'F'}
              onChange={(unit) => {
                if (!isPending && unit !== tempUnit) handleTempUnitChange(unit)
              }}
            />
          )}
        />
      </ListSection>

      <TimezoneSheet
        open={tzSheetOpen}
        value={timezone}
        onClose={() => setTzSheetOpen(false)}
        onSelect={(tz) => {
          setTzSheetOpen(false)
          if (tz !== timezone) handleTimezoneChange(tz)
        }}
      />

      <ListSection header="Maintenance">
        <SwitchRow
          title="Daily reboot"
          checked={rebootDaily}
          onChange={handleRebootToggle}
          disabled={isPending}
          ariaLabel="Toggle daily reboot"
        />
        {rebootDaily && (
          <TimeRow id="rebootTime" title="Reboot at" value={rebootTime} onChange={handleRebootTimeChange} disabled={isPending} />
        )}
        <SwitchRow
          title="Daily prime"
          checked={primePodDaily}
          onChange={handlePrimeToggle}
          disabled={isPending}
          ariaLabel="Toggle daily prime pod"
        />
        {primePodDaily && (
          <TimeRow id="primeTime" title="Prime at" value={primePodTime} onChange={handlePrimeTimeChange} disabled={isPending} />
        )}
      </ListSection>

      <ListSection footer="Forces any side that has been on longer than this to power off. Runs on top of the per-side auto-off. Always-on sides and active run-once sessions are exempt.">
        <SwitchRow
          title="Auto power-off cap"
          checked={maxOnEnabled}
          onChange={handleMaxOnToggle}
          disabled={isPending}
          ariaLabel="Toggle global auto power-off cap"
        />
        {maxOnEnabled && (
          <NumberRow
            id="maxOnHours"
            title="Turn off after"
            unit="h"
            min={1}
            max={48}
            step={1}
            value={maxOnHours}
            onChange={handleMaxOnHoursChange}
            disabled={isPending}
          />
        )}
      </ListSection>

      <ListSection header="Pod light">
        <SliderRow
          ariaLabel="LED brightness"
          value={ledDayBrightness}
          onChange={handleLedDayChange}
          onCommit={commitLedDay}
          disabled={isPending}
          valueLabel={`${ledDayBrightness}%`}
        />
        <SwitchRow
          title="Night mode"
          checked={ledNightEnabled}
          onChange={handleLedNightToggle}
          disabled={isPending}
          ariaLabel="Toggle LED night mode"
        />
        {ledNightEnabled && (
          <>
            <TimeRow id="ledNightStart" title="From" value={ledNightStart} onChange={handleLedNightStartChange} disabled={isPending} />
            <TimeRow id="ledNightEnd" title="To" value={ledNightEnd} onChange={handleLedNightEndChange} disabled={isPending} />
          </>
        )}
      </ListSection>

      {ledNightEnabled && (
        <ListSection header="Night brightness" footer="The light dims to this level between the times above.">
          <SliderRow
            ariaLabel="LED night brightness"
            value={ledNightBrightness}
            onChange={handleLedNightBrightnessChange}
            onCommit={commitLedNightBrightness}
            disabled={isPending}
            valueLabel={`${ledNightBrightness}%`}
            iconMax={Moon}
          />
        </ListSection>
      )}

      <ListSection
        header="Pump safety"
        footer={pumpStallEnabled
          ? 'When pump RPM stays under the threshold for the dwell window, the side powers off until you re-enable it. Frames arrive about every 60 seconds.'
          : 'When pump RPM stays under the threshold for the dwell window, the side powers off until you re-enable it.'}
      >
        <SwitchRow
          title="Stall protection"
          checked={pumpStallEnabled}
          onChange={handlePumpStallToggle}
          disabled={isPending}
          ariaLabel="Toggle pump stall protection"
        />
        {pumpStallEnabled && (
          <>
            <NumberRow
              id="pumpThresholdRpm"
              title="Trip threshold"
              unit="RPM"
              min={100}
              max={1500}
              step={50}
              value={pumpStallThreshold}
              onChange={handlePumpStallThreshold}
              onBlur={commitPumpStallThreshold}
              disabled={isPending}
            />
            <NumberRow
              id="pumpStallDwell"
              title="Dwell samples"
              min={1}
              max={10}
              step={1}
              value={pumpStallDwell}
              onChange={handlePumpStallDwell}
              onBlur={commitPumpStallDwell}
              disabled={isPending}
            />
          </>
        )}
      </ListSection>

      {pumpStallEnabled && (
        <ListSection footer="Clears the trip once the pump holds the recovery speed for this many consecutive samples.">
          <SwitchRow
            title="Auto-recover"
            checked={pumpAutoRecover}
            onChange={handlePumpAutoRecoverToggle}
            disabled={isPending}
            ariaLabel="Toggle pump auto-recovery"
          />
          {pumpAutoRecover && (
            <>
              <NumberRow
                id="pumpRecoveryRpm"
                title="Recovery speed"
                unit="RPM"
                min={500}
                max={3000}
                step={50}
                value={pumpRecoveryRpm}
                onChange={handlePumpRecoveryRpm}
                onBlur={commitPumpRecoveryRpm}
                disabled={isPending}
              />
              <NumberRow
                id="pumpRecoverySamples"
                title="Recovery samples"
                min={1}
                max={10}
                step={1}
                value={pumpRecoverySamples}
                onChange={handlePumpRecoverySamples}
                onBlur={commitPumpRecoverySamples}
                disabled={isPending}
              />
            </>
          )}
        </ListSection>
      )}

      {mutation.error && (
        <p className="px-4 text-[13px] text-red-400">{mutation.error.message}</p>
      )}
    </>
  )
}

function formatZone(tz: string) {
  return tz.replace(/_/g, ' ')
}

/** Every IANA zone the runtime knows, falling back to the common list. */
function allTimezones(): string[] {
  try {
    const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
    const zones = intl.supportedValuesOf?.('timeZone')
    if (zones && zones.length > 0) return zones
  }
  catch {
    /* older runtime */
  }
  return TIMEZONES
}

/** Searchable time-zone picker, like Settings > General > Date & Time. */
function TimezoneSheet({ open, value, onClose, onSelect }: {
  open: boolean
  value: string
  onClose: () => void
  onSelect: (tz: string) => void
}) {
  const [query, setQuery] = useState('')
  const zones = useMemo(() => allTimezones(), [])

  const q = query.trim().toLowerCase().replace(/\s+/g, '_')
  const results = q
    ? zones.filter(z => z.toLowerCase().includes(q))
    : [value, ...TIMEZONES.filter(z => z !== value)]

  function close() {
    setQuery('')
    onClose()
  }

  return (
    <Sheet open={open} onClose={close} title="Time zone">
      <div className="space-y-4">
        <label className="flex h-9 items-center gap-1.5 rounded-[10px] bg-zinc-800 px-2 text-zinc-500">
          <Search size={17} className="shrink-0" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search time zones"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-[17px] text-white outline-none placeholder:text-zinc-500"
          />
        </label>

        <ListSection header={q ? undefined : 'Common'}>
          {results.length === 0
            ? <ListRow title={<span className="text-zinc-500">No results</span>} />
            : results.slice(0, 200).map(tz => (
                <ListRow
                  key={tz}
                  title={formatZone(tz)}
                  onClick={() => {
                    setQuery('')
                    onSelect(tz)
                  }}
                  accessory={tz === value ? <Check size={20} className="shrink-0 text-sky-400" /> : undefined}
                />
              ))}
        </ListSection>
      </div>
    </Sheet>
  )
}
