import { useState } from 'react'
import { CapacityGrid } from './CapacityGrid'
import { DateField } from './DateField'
import { ThemeToggle } from './ThemeToggle'
import { addDays, clampRange, mondayOf, rangeLabel, shiftRange, sundayOf, todayISO, weekCount, type Range } from './weeks'

// Three weeks around the turn of the year: the seed's hand-written scenario
// (people 1–5) lives here, so it is the most useful place to land.
const DEFAULT_RANGE: Range = { from: '2025-12-29', to: sundayOf('2026-01-16') }

export function App() {
  const [range, setRange] = useState<Range>(DEFAULT_RANGE)
  const weeks = weekCount(range.from, range.to)

  function goToThisWeek() {
    const from = mondayOf(todayISO())
    setRange({ from, to: addDays(from, weeks * 7 - 1) })
  }

  return (
    <main>
      <header className="toolbar">
        <div>
          <h1>Team capacity</h1>
          <p className="range">
            {rangeLabel(range.from, range.to)} · {weeks} {weeks === 1 ? 'week' : 'weeks'}
          </p>
        </div>
        <div className="controls">
          <div className="nav" role="group" aria-label="Navigate weeks">
            <button type="button" onClick={() => setRange((r) => shiftRange(r, -1))} aria-label="Previous week">
              ‹
            </button>
            <button type="button" onClick={() => setRange((r) => shiftRange(r, 1))} aria-label="Next week">
              ›
            </button>
            <button type="button" onClick={goToThisWeek}>
              This week
            </button>
          </div>
          <DateField
            label="From"
            value={range.from}
            onCommit={(v) => setRange((r) => clampRange(v, r.to, 'from'))}
          />
          <DateField label="To" value={range.to} onCommit={(v) => setRange((r) => clampRange(r.from, v, 'to'))} />
          <ThemeToggle />
        </div>
      </header>
      <CapacityGrid from={range.from} to={range.to} />
    </main>
  )
}

