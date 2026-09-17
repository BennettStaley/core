import type { SleepStage } from '@/src/lib/sleep-stages'

/**
 * Restrained blue/indigo ramp for sleep stages on the Sleep screen, lightest
 * (awake) to darkest (deep), using iOS dark-appearance system colours.
 */
export const STAGE_COLORS: Record<SleepStage, string> = {
  wake: '#AEAEB2', // systemGray2
  rem: '#64D2FF', // systemCyan
  light: '#0A84FF', // systemBlue
  deep: '#5E5CE6', // systemIndigo
}

export const STAGE_LABELS: Record<SleepStage, string> = {
  wake: 'Awake',
  rem: 'REM',
  light: 'Light',
  deep: 'Deep',
}

/** Legend / breakdown order, top of the hypnogram first. */
export const STAGE_ORDER: SleepStage[] = ['wake', 'rem', 'light', 'deep']
