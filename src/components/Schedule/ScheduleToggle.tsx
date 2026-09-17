'use client'

import { ListRow, ListSection, Switch } from '@/src/ui/ios'

interface ScheduleToggleProps {
  /** Whether the schedule is currently enabled */
  enabled: boolean
  /** Called when user toggles the switch */
  onToggle: () => void
  /** Whether a mutation is in-flight */
  isLoading?: boolean
}

/** Master schedule switch as an inset grouped row with an explanatory footer. */
export function ScheduleToggle({
  enabled,
  onToggle,
  isLoading = false,
}: ScheduleToggleProps) {
  return (
    <ListSection footer="When on, the Pod powers on, follows your curves and turns off automatically.">
      <ListRow
        title="Schedule"
        accessory={(
          <Switch
            checked={enabled}
            onChange={() => onToggle()}
            disabled={isLoading}
            aria-label="Toggle schedule"
          />
        )}
      />
    </ListSection>
  )
}
