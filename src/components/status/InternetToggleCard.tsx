'use client'

import { useState } from 'react'
import { trpc } from '@/src/utils/trpc'
import { Globe, Lock, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { Switch } from '@/src/ui/ios'

/**
 * InternetToggleCard — toggle WAN internet access on/off.
 * Shows current status and allows toggling between local-only and internet modes.
 *
 * Wires into:
 * - system.internetStatus → current blocked/allowed state
 * - system.setInternetAccess → toggle WAN access via iptables
 */
export function InternetToggleCard() {
  const utils = trpc.useUtils()

  const { data: internet, isLoading } = trpc.system.internetStatus.useQuery(
    {},
    { refetchInterval: 10_000 },
  )

  const toggleMutation = trpc.system.setInternetAccess.useMutation({
    onSuccess: () => {
      utils.system.internetStatus.invalidate()
    },
  })

  const blocked = internet?.blocked ?? true
  const isPending = toggleMutation.isPending
  const [confirming, setConfirming] = useState(false)

  const handleToggle = () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setConfirming(false)
    toggleMutation.mutate({ blocked: !blocked })
  }

  const handleCancel = () => setConfirming(false)

  return (
    <div className="overflow-hidden rounded-xl bg-zinc-900">
      <div className="flex min-h-[60px] items-center gap-3 px-4">
        <span
          className={clsx(
            'grid h-[29px] w-[29px] shrink-0 place-items-center rounded-[7px] text-white',
            blocked ? 'bg-zinc-600' : 'bg-sky-500',
          )}
        >
          {blocked ? <Lock size={17} strokeWidth={2} /> : <Globe size={17} strokeWidth={2} />}
        </span>
        <div className="min-w-0 flex-1 py-2.5">
          <p className="text-[17px] leading-[22px] text-white">Internet access</p>
          <p className="text-[13px] leading-[18px] text-zinc-500">
            {blocked
              ? 'Local only. The pod cannot reach external servers.'
              : 'The pod has WAN internet access.'}
          </p>
        </div>

        {isPending
          ? <Loader2 size={20} className="shrink-0 animate-spin text-zinc-500" />
          : (
              // text-left keeps the Switch thumb anchored: its absolutely
              // positioned knob otherwise takes the button's centred static position.
              <span className="flex shrink-0 [&_[role=switch]]:text-left">
                <Switch
                  checked={!blocked}
                  onChange={handleToggle}
                  disabled={isLoading}
                  aria-label={blocked ? 'Enable internet access' : 'Disable internet access'}
                />
              </span>
            )}
      </div>

      {confirming && (
        <div className="flex min-h-[44px] items-center gap-4 border-t border-zinc-800 px-4">
          <p className="min-w-0 flex-1 text-[15px] text-amber-400">
            {blocked ? 'Allow internet access?' : 'Block internet access?'}
          </p>
          <button
            type="button"
            onClick={handleCancel}
            className="min-h-[44px] text-[17px] text-sky-400 active:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleToggle}
            className="min-h-[44px] text-[17px] font-semibold text-sky-400 active:opacity-50"
          >
            Confirm
          </button>
        </div>
      )}

      {toggleMutation.isError && (
        <p className="border-t border-zinc-800 px-4 py-3 text-[13px] text-red-400">
          {toggleMutation.error?.message ?? 'Failed to toggle internet access'}
        </p>
      )}
    </div>
  )
}
