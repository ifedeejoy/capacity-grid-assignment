import { useState } from 'react'
import type { CapacityRow } from './api'
import { HoursEditor } from './HoursEditor'
import { cellStatus, formatHours, utilisation, type CellStatus } from './model'
import { useCapacity, type SaveState } from './useCapacity'
import { isoWeek, rangeLabel, shortDate } from './weeks'

type Props = {
  from: string
  to: string
}

// CapacityGrid renders one row per person and one column per week, showing
// how allocated each person is and making over-allocation obvious.
//
// Reads GET /api/capacity. Weekly hours are editable inline; a save updates
// the row from the server's answer, never from a refetch of the whole range.
export function CapacityGrid({ from, to }: Props) {
  const { data, loading, error, stale, retry, saves, saveWeeklyHours, dismissSave } = useCapacity(from, to)
  const [filter, setFilter] = useState<Set<FilterStatus>>(() => new Set())

  function toggleFilter(status: FilterStatus) {
    setFilter((current) => {
      const next = new Set(current)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  if (!data) {
    if (error) {
      return (
        <div className="notice notice--error" role="alert">
          <strong>Couldn’t load capacity.</strong> {error}{' '}
          <button type="button" onClick={retry}>
            Retry
          </button>
        </div>
      )
    }
    return <SkeletonGrid />
  }

  const statusesByPerson = data.people.map((p) => new Set(p.allocated.map((a) => cellStatus(a, p.weeklyHours))))
  const overCount = statusesByPerson.filter((s) => s.has('over')).length
  // A row mid-save stays visible under the filter: its optimistic value may
  // have changed its status, and the manager needs to see the outcome.
  const rows =
    filter.size === 0
      ? data.people
      : data.people.filter(
          (p, i) => saves[p.id] !== undefined || [...filter].some((status) => statusesByPerson[i].has(status)),
        )

  return (
    <section className="capacity" aria-busy={loading}>
      {loading && (
        <div className="notice notice--loading" role="status">
          Loading {rangeLabel(from, to)}…
        </div>
      )}
      {error && (
        <div className="notice notice--error" role="alert">
          <strong>Couldn’t load {rangeLabel(from, to)}.</strong> {error}{' '}
          <button type="button" onClick={retry}>
            Retry
          </button>
          {stale && <span className="notice-detail"> Showing {rangeLabel(data.from, data.to)} instead.</span>}
        </div>
      )}

      <div className="summary">
        <span>
          <strong>{overCount}</strong> of {data.people.length} people over capacity in at least one week
          {filter.size > 0 && <span className="summary-shown"> · showing {rows.length}</span>}
        </span>
        <StatusFilter filter={filter} onToggle={toggleFilter} />
      </div>

      <div className={`grid-wrap${stale || loading ? ' grid-wrap--stale' : ''}`}>
        <table className="grid">
          <thead>
            <tr>
              <th scope="col" className="person-col">
                Person
              </th>
              {data.weeks.map((w) => (
                <th scope="col" key={w} className="week-col">
                  <span className="week-date">{shortDate(w)}</span>
                  <span className="week-num">W{isoWeek(w)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <PersonRow
                key={p.id}
                person={p}
                weeks={data.weeks}
                save={saves[p.id]}
                onSave={(hours) => void saveWeeklyHours(p, hours)}
                onDismiss={() => dismissSave(p.id)}
              />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={data.weeks.length + 1} className="empty">
                  Nobody matches that filter in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

type RowProps = {
  person: CapacityRow
  weeks: string[]
  save?: SaveState
  onSave: (weeklyHours: number) => void
  onDismiss: () => void
}

function PersonRow({ person, weeks, save, onSave, onDismiss }: RowProps) {
  return (
    <tr>
      <th scope="row" className="person-col">
        <span className="person-name">{person.name}</span>
        <HoursEditor person={person} save={save} onSave={onSave} onDismiss={onDismiss} />
      </th>
      {person.allocated.map((allocated, i) => (
        <Cell key={weeks[i]} allocated={allocated} capacity={person.weeklyHours} />
      ))}
    </tr>
  )
}

const STATUS_TEXT: Record<CellStatus, string> = {
  idle: 'nothing allocated',
  ok: 'within capacity',
  full: 'at capacity',
  over: 'over capacity',
}

function Cell({ allocated, capacity }: { allocated: number; capacity: number }) {
  const status = cellStatus(allocated, capacity)
  const pct = utilisation(allocated, capacity)
  const title = `${formatHours(allocated)} of ${formatHours(capacity)} h, ${STATUS_TEXT[status]}`
  return (
    <td className={`cell cell--${status}`} title={title}>
      {status === 'idle' ? (
        <span className="cell-hours cell-hours--idle">–</span>
      ) : (
        <>
          <span className="cell-hours">
            {status === 'over' && (
              <span className="cell-flag" aria-hidden="true">
                ▲
              </span>
            )}
            {formatHours(allocated)}
          </span>
          <span className="cell-pct">{pct === null ? 'no capacity' : `${pct}%`}</span>
          <span className="sr-only">{STATUS_TEXT[status]}</span>
        </>
      )}
    </td>
  )
}

type FilterStatus = Exclude<CellStatus, 'idle'>

const FILTERS: Array<{ status: FilterStatus; label: string }> = [
  { status: 'over', label: 'over' },
  { status: 'full', label: 'at capacity' },
  { status: 'ok', label: 'within' },
]

// Legend and filter in one: each swatch is a checkbox. Ticking any subset
// shows people with at least one week in those states; none ticked shows all.
function StatusFilter({ filter, onToggle }: { filter: Set<FilterStatus>; onToggle: (s: FilterStatus) => void }) {
  return (
    <fieldset className="legend">
      <legend className="sr-only">Show only people with a week that is</legend>
      {FILTERS.map(({ status, label }) => (
        <label key={status} className="legend-item">
          <input type="checkbox" checked={filter.has(status)} onChange={() => onToggle(status)} />
          <span className={`swatch swatch--${status}`} aria-hidden="true" />
          {label}
        </label>
      ))}
    </fieldset>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid-wrap" role="status" aria-label="Loading capacity">
      <table className="grid grid--skeleton">
        <tbody>
          {Array.from({ length: 8 }, (_, i) => (
            <tr key={i}>
              <th scope="row" className="person-col">
                <span className="bone bone--name" />
              </th>
              {Array.from({ length: 3 }, (_, j) => (
                <td key={j} className="cell">
                  <span className="bone bone--cell" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
