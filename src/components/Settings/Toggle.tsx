'use client'

import { SettingsSwitch } from './SettingsRows'

interface ToggleProps {
  enabled: boolean
  onToggle: () => void
  disabled?: boolean
  label?: string
}

/**
 * Legacy toggle API kept for compatibility; renders the iOS `Switch`.
 * Prefer `Switch` from `@/src/ui/ios` in new code.
 */
export function Toggle({ enabled, onToggle, disabled = false, label }: ToggleProps) {
  return <SettingsSwitch checked={enabled} onChange={() => onToggle()} disabled={disabled} ariaLabel={label} />
}
