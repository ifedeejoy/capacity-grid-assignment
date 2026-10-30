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
  const [onlyOver, setOnlyOver] = useState(false)

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

  const overByPerson = data.people.map((p) => p.allocated.some((a) => cellStatus(a, p.weeklyHours) === 'over'))
  const overCount = overByPerson.filter(Boolean).length
  // A row mid-save stays visible under the filter: its optimistic value may
  // have taken it out of "over", and the manager needs to see the outcome.
  const rows = onlyOver ? data.people.filter((p, i) => overByPerson[i] || saves[p.id] !== undefined) : data.people

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
        </span>
        <label className="toggle">
          <input type="checkbox" checked={onlyOver} onChange={(e) => setOnlyOver(e.target.checked)} />
          Only over-allocated
        </label>
        <Legend />
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
                  Nobody is over capacity in this range.
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

function Legend() {
  return (
    <ul className="legend" aria-label="Legend">
      <li>
        <span className="swatch swatch--over" /> over
      </li>
      <li>
        <span className="swatch swatch--full" /> at capacity
      </li>
      <li>
        <span className="swatch swatch--ok" /> within
      </li>
    </ul>
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
