import type { DayOfWeek } from '@/src/lib/scheduleTime'

const DAY_SHORT: Record<DayOfWeek, string> = {
  sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
}

const DAY_ORDER: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const WEEKDAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
const WEEKENDS: DayOfWeek[] = ['saturday', 'sunday']

/**
 * Human-readable summary of a set of days, the way Clock.app writes repeats:
 *   all 7 → "Every day", Mon–Fri → "Weekdays", Sat+Sun → "Weekends",
 *   3+ contiguous → "Mon–Thu", otherwise "Mon, Wed, Fri".
 */
export function formatDays(days: readonly DayOfWeek[]): string {
  const set = new Set(days)
  if (set.size === 0) return 'Never'
  if (set.size === 7) return 'Every day'
  if (set.size === 5 && WEEKDAYS.every(d => set.has(d))) return 'Weekdays'
  if (set.size === 2 && WEEKENDS.every(d => set.has(d))) return 'Weekends'

  const ordered = DAY_ORDER.filter(d => set.has(d))
  const indices = ordered.map(d => DAY_ORDER.indexOf(d))
  const isContiguous = indices.every((idx, i) => i === 0 || idx === indices[i - 1] + 1)
  if (isContiguous && ordered.length > 2) {
    return `${DAY_SHORT[ordered[0]]}–${DAY_SHORT[ordered[ordered.length - 1]]}`
  }
  return ordered.map(d => DAY_SHORT[d]).join(', ')
}

const COOL = [10, 132, 255] // systemBlue
const NEUTRAL = [174, 174, 178] // systemGray2
const WARM = [255, 159, 10] // systemOrange

function mix(a: number[], b: number[], t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

/**
 * Temperature tint on the design system's cool ↔ warm scale. 80°F (the Pod's
 * neutral) is grey; ±8°F or more saturates to systemBlue / systemOrange.
 */
export function tempTint(tempF: number): string {
  const offset = Math.max(-8, Math.min(8, tempF - 80))
  return offset < 0 ? mix(NEUTRAL, COOL, -offset / 8) : mix(NEUTRAL, WARM, offset / 8)
}

/** Split "7:00 AM" into ["7:00", "AM"] for Clock-style large digits. */
export function splitTime12h(formatted: string): [string, string] {
  const [digits, period = ''] = formatted.split(' ')
  return [digits, period]
}
