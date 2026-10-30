// Pure capacity arithmetic. Keep this free of React so the rules the grid
// colours by can be tested without rendering anything.

export type CellStatus = 'idle' | 'ok' | 'full' | 'over'

const EPSILON = 0.005 // hours are served rounded to 2 dp

/**
 * How a cell should read.
 *  - idle: nothing allocated
 *  - over: more allocated than capacity, including any allocation against zero capacity
 *  - full: allocated equals capacity
 *  - ok:   some headroom left
 */
export function cellStatus(allocated: number, capacity: number): CellStatus {
  if (allocated <= EPSILON) return 'idle'
  if (capacity <= EPSILON) return 'over'
  if (allocated > capacity + EPSILON) return 'over'
  if (Math.abs(allocated - capacity) <= EPSILON) return 'full'
  return 'ok'
}

/** Allocation as a percentage of capacity, or null when capacity is zero. */
export function utilisation(allocated: number, capacity: number): number | null {
  if (capacity <= EPSILON) return null
  return Math.round((allocated / capacity) * 100)
}

/** Compact hours: 40 → "40", 37.5 → "37.5", 39.375 → "39.38". */
export function formatHours(h: number): string {
  return Number.isInteger(h) ? String(h) : String(Math.round(h * 100) / 100)
}

/** Validates an edited weekly-hours string. Returns the number or an error message. */
export function parseWeeklyHours(raw: string): { value: number } | { error: string } {
  const trimmed = raw.trim()
  if (trimmed === '') return { error: 'Enter a number of hours' }
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return { error: 'Hours must be a number' }
  if (n < 0) return { error: 'Hours cannot be negative' }
  if (n > 168) return { error: 'There are only 168 hours in a week' }
  return { value: Math.round(n * 100) / 100 }
}
