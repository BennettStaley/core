'use client'

import clsx from 'clsx'
import { Link2, Link2Off } from 'lucide-react'
import { useSide } from '@/src/providers/SideProvider'
import { useDeviceStatus } from '@/src/hooks/useDeviceStatus'
import { useSideNames } from '@/src/hooks/useSideNames'

/**
 * Side switcher wired to SideContext and live device status.
 *
 * iOS segmented-control look: a grey track with the selected side raised.
 * When sides are linked both segments are raised together, and the round
 * link button to the right turns systemBlue. A small green dot marks a side
 * that is powered on.
 */
export const SideSelector = () => {
  const { selectedSide, isLinked, selectSide, toggleLink } = useSide()
  const { leftName, rightName } = useSideNames()
  const { status } = useDeviceStatus()

  const sides = [
    { side: 'left' as const, label: leftName, isOn: (status?.leftSide?.targetLevel ?? 0) !== 0 },
    { side: 'right' as const, label: rightName, isOn: (status?.rightSide?.targetLevel ?? 0) !== 0 },
  ]

  return (
    <div className="flex items-center gap-2">
      <div
        role="radiogroup"
        aria-label="Side"
        className="flex min-w-0 flex-1 gap-0.5 rounded-[9px] bg-zinc-800/80 p-0.5"
      >
        {sides.map(({ side, label, isOn }) => {
          const selected = selectedSide === side || selectedSide === 'both'
          return (
            <button
              key={side}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => selectSide(side)}
              className={clsx(
                'flex min-h-[36px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[7px] px-3 text-[13px] transition-colors',
                selected
                  ? 'bg-zinc-600 font-semibold text-white shadow-[0_3px_8px_rgba(0,0,0,0.12)]'
                  : 'font-medium text-zinc-300',
              )}
            >
              <span className="truncate">{label}</span>
              {isOn && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-label="On" />
              )}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={toggleLink}
        aria-label={isLinked ? 'Unlink sides' : 'Link sides'}
        aria-pressed={isLinked}
        className={clsx(
          'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors after:absolute after:-inset-1 active:opacity-60',
          isLinked ? 'bg-sky-500 text-white' : 'bg-zinc-800 text-zinc-400',
        )}
      >
        {isLinked
          ? <Link2 size={18} strokeWidth={2} />
          : <Link2Off size={18} strokeWidth={2} />}
      </button>
    </div>
  )
}
