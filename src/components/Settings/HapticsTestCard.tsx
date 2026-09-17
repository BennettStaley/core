'use client'

import { useState } from 'react'
import { Play, Timer } from 'lucide-react'
import clsx from 'clsx'
import { trpc } from '@/src/utils/trpc'
import { useSide } from '@/src/hooks/useSide'
import { useSideNames } from '@/src/hooks/useSideNames'
import { ListRow, ListSection } from '@/src/ui/ios'
import { FIXED_INTENSITY, FIXED_PATTERN, VIBRATION_PRESETS } from '@/src/lib/vibrationPatterns'
import { ActionRow, SliderRow } from './SettingsRows'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HapticsTestCard({ filterSide }: { filterSide?: 'left' | 'right' } = {}) {
  const { side: contextSide } = useSide()
  const { sideName } = useSideNames()
  const side = filterSide ?? contextSide
  const [customDuration, setCustomDuration] = useState(10)
  const [activePattern, setActivePattern] = useState<string | null>(null)

  const setAlarm = trpc.device.setAlarm.useMutation({
    onSuccess: (_, variables) => {
      setActivePattern(variables.side)
    },
  })
  const clearAlarm = trpc.device.clearAlarm.useMutation({
    onSuccess: () => {
      setActivePattern(null)
    },
  })

  const isMutating = setAlarm.isPending || clearAlarm.isPending

  function handleTest(duration: number, label?: string) {
    setAlarm.mutate({
      side,
      vibrationIntensity: FIXED_INTENSITY,
      vibrationPattern: FIXED_PATTERN,
      duration,
    })
    setActivePattern(label ?? 'custom')
  }

  function handleStop() {
    clearAlarm.mutate({ side })
  }

  function handleQuickTest() {
    handleTest(10, 'quick')
  }

  const errorMessage = setAlarm.error?.message ?? clearAlarm.error?.message

  return (
    <>
      <ListSection
        footer={errorMessage
          ? <span className="text-red-400">{errorMessage}</span>
          : `Vibrates the ${sideName(side)} side of the cover for 10 seconds.`}
      >
        <ActionRow title="Quick test" onClick={handleQuickTest} disabled={isMutating} />
        {activePattern && (
          <ActionRow title="Stop vibration" destructive onClick={handleStop} disabled={clearAlarm.isPending} />
        )}
      </ListSection>

      <ListSection
        header="Patterns"
        footer="Intensity and pattern are firmware-clamped on Pod 5, so only duration affects the buzz."
      >
        {VIBRATION_PRESETS.map(p => (
          <ListRow
            key={p.name}
            title={p.name}
            subtitle={p.description}
            onClick={() => handleTest(p.duration, p.name)}
            disabled={isMutating}
            value={`${p.duration}s`}
            accessory={(
              <Play
                size={16}
                aria-hidden
                className={clsx('shrink-0 text-sky-400', activePattern === p.name && 'fill-sky-400')}
              />
            )}
          />
        ))}
      </ListSection>

      <ListSection header="Custom duration">
        <SliderRow
          ariaLabel="Custom vibration duration"
          min={1}
          max={60}
          value={customDuration}
          onChange={setCustomDuration}
          valueLabel={`${customDuration}s`}
          iconMin={Timer}
          iconMax={Timer}
        />
        <ActionRow
          title={isMutating ? 'Sending…' : `Test ${customDuration} seconds`}
          onClick={() => handleTest(customDuration)}
          disabled={isMutating}
        />
      </ListSection>
    </>
  )
}
