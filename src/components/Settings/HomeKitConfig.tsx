'use client'

import { useState } from 'react'
import { trpc } from '@/src/utils/trpc'
import { ListRow, ListSection } from '@/src/ui/ios'
import { ActionRow, SwitchRow } from './SettingsRows'

/**
 * Settings → HomeKit panel.
 * Toggle bridge on/off, show pairing QR + 8-digit setup code,
 * show paired-controller count, expose reset action.
 */
export function HomeKitConfig() {
  const utils = trpc.useUtils()
  const [error, setError] = useState<string | null>(null)
  const { data, isLoading } = trpc.homekit.getStatus.useQuery({}, {
    refetchInterval: 5_000,
  })

  const setEnabled = trpc.homekit.setEnabled.useMutation({
    onSuccess: () => {
      setError(null)
      utils.homekit.getStatus.invalidate()
    },
    onError: e => setError(e.message),
  })
  const unpair = trpc.homekit.unpair.useMutation({
    onSuccess: () => {
      setError(null)
      utils.homekit.getStatus.invalidate()
    },
    onError: e => setError(e.message),
  })

  if (isLoading || !data) {
    return <div className="h-[44px] animate-pulse rounded-xl bg-zinc-900" />
  }

  const paired = data.pairedControllers.length

  return (
    <>
      <ListSection
        footer={error
          ? <span className="text-red-400">{error}</span>
          : 'Control the pod from Apple Home. Local only, no Apple servers.'}
      >
        <SwitchRow
          title="HomeKit bridge"
          checked={data.enabled}
          onChange={() => setEnabled.mutate({ enabled: !data.enabled })}
          disabled={setEnabled.isPending}
          ariaLabel="HomeKit bridge"
        />
      </ListSection>

      {data.enabled && data.running && (
        <>
          {(data.qrDataUrl || data.pincode) && (
            <ListSection header="Pairing" footer="In the Home app, add an accessory and scan this code.">
              {data.qrDataUrl && (
                <div className="flex justify-center p-4">
                  <div className="rounded-xl bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={data.qrDataUrl} alt="HomeKit pairing QR code" className="h-40 w-40" />
                  </div>
                </div>
              )}
              {data.pincode && (
                <ListRow
                  title="Setup code"
                  value={<span className="font-mono text-white">{data.pincode}</span>}
                />
              )}
            </ListSection>
          )}

          <ListSection
            footer={paired === 0 ? 'None yet. Open the Home app and add an accessory.' : undefined}
          >
            <ListRow title="Paired controllers" value={paired} />
          </ListSection>

          {paired > 0 && (
            <ListSection footer="Rotates the bridge identity (new setup code and QR). Remove the old bridge from the Home app, then pair again.">
              <ActionRow
                title={unpair.isPending ? 'Resetting…' : 'Reset HomeKit pairing'}
                destructive
                disabled={unpair.isPending}
                onClick={() => {
                  if (confirm('Reset HomeKit pairing? This rotates the bridge identity (new pincode + QR). You\'ll need to remove the old bridge from the Home app manually — those tiles stay "No Response" until you do — then pair again with the new code shown here.')) {
                    unpair.mutate({})
                  }
                }}
              />
            </ListSection>
          )}
        </>
      )}
    </>
  )
}
