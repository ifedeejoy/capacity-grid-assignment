// Calendar helpers. Dates are civil 'YYYY-MM-DD' strings with no timezone;
// everything is computed in UTC so a manager in UTC-8 does not see a grid
// that starts on a Sunday.

const DAY_MS = 86_400_000

export function parseDate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) throw new Error(`not a YYYY-MM-DD date: ${iso}`)
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  return formatDate(new Date(parseDate(iso).getTime() + days * DAY_MS))
}

/** Monday on or before the given date. */
export function mondayOf(iso: string): string {
  const d = parseDate(iso)
  const offset = (d.getUTCDay() + 6) % 7 // Mon=0 … Sun=6
  return addDays(iso, -offset)
}

/** Sunday on or after the given date. */
export function sundayOf(iso: string): string {
  return addDays(mondayOf(iso), 6)
}

export function todayISO(now: Date = new Date()): string {
  return formatDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))
}

/** ISO-8601 week number (weeks start Monday; week 1 contains the first Thursday). */
export function isoWeek(iso: string): number {
  const d = parseDate(iso)
  const thursday = new Date(d.getTime() + (3 - ((d.getUTCDay() + 6) % 7)) * DAY_MS)
  const jan1 = Date.UTC(thursday.getUTCFullYear(), 0, 1)
  return Math.round((thursday.getTime() - jan1) / DAY_MS / 7) + 1
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "29 Dec" — short, for column headers. */
export function shortDate(iso: string): string {
  const d = parseDate(iso)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

/** "29 Dec 2025 – 18 Jan 2026" */
export function rangeLabel(from: string, to: string): string {
  const f = parseDate(from)
  const t = parseDate(to)
  const fy = f.getUTCFullYear()
  const ty = t.getUTCFullYear()
  const left = fy === ty ? shortDate(from) : `${shortDate(from)} ${fy}`
  return `${left} – ${shortDate(to)} ${ty}`
}

/** Number of Monday-aligned weeks between a Monday and a Sunday, inclusive. */
export function weekCount(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime() + DAY_MS) / (7 * DAY_MS))
}

/** Mirrors maxWeeks in api/capacity.go. */
export const MAX_WEEKS = 110

export type Range = { from: string; to: string }

/**
 * Snaps a range to Monday..Sunday, keeps `to` after `from`, and caps the width.
 * `anchor` says which end the user just moved, so the other end gives way.
 */
export function clampRange(from: string, to: string, anchor: 'from' | 'to'): Range {
  let f = mondayOf(from)
  let t = sundayOf(to)
  if (t < f) {
    if (anchor === 'from') t = sundayOf(f)
    else f = mondayOf(t)
  }
  if (weekCount(f, t) > MAX_WEEKS) {
    if (anchor === 'from') t = addDays(f, MAX_WEEKS * 7 - 1)
    else f = addDays(t, -(MAX_WEEKS * 7 - 1))
  }
  return { from: f, to: t }
}

export function shiftRange(range: Range, weeks: number): Range {
  return { from: addDays(range.from, weeks * 7), to: addDays(range.to, weeks * 7) }
}
