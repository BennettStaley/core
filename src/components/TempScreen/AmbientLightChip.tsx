'use client'

import { trpc } from '@/src/utils/trpc'

/**
 * Compact ambient light reading (lux) for the Tonight footnote line.
 *
 * Wires into:
 * - environment.getLatestAmbientLight → current lux reading
 */
export function AmbientLightChip() {
  const { data, isLoading } = trpc.environment.getLatestAmbientLight.useQuery(
    {},
    { refetchInterval: 30_000 },
  )

  if (isLoading || !data) return null

  const lux = data.lux
  if (lux == null) return null

  return (
    <span className="ios-numeric">
      {Math.round(lux)}
      {' '}
      lux
    </span>
  )
}
