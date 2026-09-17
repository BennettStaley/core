'use client'

import { Trans } from '@lingui/react/macro'
import { Activity, Gauge, Radio, Settings } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { trpc } from '@/src/utils/trpc'
import { ListRow, ListSection, PageHeader } from '@/src/ui/ios'

/**
 * "More" tab — grouped list for the tools that don't earn a tab-bar slot:
 * settings, system status, live sensors and diagnostics.
 */
export function MoreScreen() {
  const pathname = usePathname()
  const lang = pathname?.split('/')[1] || 'en'
  const version = trpc.system.getVersion.useQuery({}, { staleTime: 60_000 })

  return (
    <div className="space-y-6 pb-4">
      <PageHeader title={<Trans>More</Trans>} />

      <ListSection>
        <ListRow href={`/${lang}/settings`} icon={Settings} iconTile="bg-zinc-600" title={<Trans>Settings</Trans>} />
        <ListRow href={`/${lang}/status`} icon={Activity} iconTile="bg-emerald-500" title={<Trans>Status</Trans>} />
      </ListSection>

      <ListSection
        header={<Trans>Tools</Trans>}
        footer={<Trans>Live sensor readings and scheduler internals, for troubleshooting.</Trans>}
      >
        <ListRow href={`/${lang}/sensors`} icon={Radio} iconTile="bg-sky-500" title={<Trans>Sensors</Trans>} />
        <ListRow href={`/${lang}/debug`} icon={Gauge} iconTile="bg-indigo-500" title={<Trans>Diagnostics</Trans>} />
      </ListSection>

      {version.data && (
        <p className="ios-numeric text-center text-[13px] text-zinc-600">
          sleepypod
          {' '}
          {version.data.branch}
          {' '}
          {version.data.commitHash}
        </p>
      )}
    </div>
  )
}
