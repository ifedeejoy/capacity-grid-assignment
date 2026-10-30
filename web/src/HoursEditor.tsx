import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { updateWeeklyHours, type Person } from './api'
import { formatHours, parseWeeklyHours } from './model'

type Props = {
  person: Person
  /** Pushes a person's values into the grid. Called optimistically, then with the server's answer. */
  onApply: (person: Person) => void
}

type Mode =
  | { kind: 'view' }
  | { kind: 'edit'; draft: string; problem: string | null }
  | { kind: 'saving' }
  | { kind: 'failed'; attempted: number; message: string }

/**
 * Click-to-edit weekly hours for one row.
 *
 * Saves optimistically: the grid recolours the moment the manager commits a
 * value, then settles on whatever the server actually stored. A failed save
 * rolls the row back and keeps the attempted value one click away.
 */
export function HoursEditor({ person, onApply }: Props) {
  const [mode, setMode] = useState<Mode>({ kind: 'view' })
  const inputRef = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (mode.kind === 'edit') inputRef.current?.select()
  }, [mode.kind])

  function beginEdit() {
    setMode({ kind: 'edit', draft: formatHours(person.weeklyHours), problem: null })
  }

  async function save(value: number) {
    if (value === person.weeklyHours) {
      setMode({ kind: 'view' })
      return
    }
    const previous = person.weeklyHours
    setMode({ kind: 'saving' })
    onApply({ ...person, weeklyHours: value })
    try {
      const stored = await updateWeeklyHours(person.id, value)
      if (!mounted.current) return
      onApply(stored)
      setMode({ kind: 'view' })
    } catch (err) {
      if (!mounted.current) return
      onApply({ ...person, weeklyHours: previous })
      setMode({
        kind: 'failed',
        attempted: value,
        message: err instanceof Error ? err.message : 'Could not save',
      })
    }
  }

  function commitDraft(draft: string) {
    const parsed = parseWeeklyHours(draft)
    if ('error' in parsed) {
      setMode({ kind: 'edit', draft, problem: parsed.error })
      return
    }
    void save(parsed.value)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (mode.kind !== 'edit') return
    if (e.key === 'Enter') {
      e.preventDefault()
      commitDraft(mode.draft)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setMode({ kind: 'view' })
    }
  }

  const label = `Weekly hours for ${person.name}`

  switch (mode.kind) {
    case 'edit':
      return (
        <span className="hours hours--editing">
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            min={0}
            max={168}
            step={0.5}
            value={mode.draft}
            aria-label={label}
            aria-invalid={mode.problem !== null}
            onChange={(e) => setMode({ kind: 'edit', draft: e.target.value, problem: null })}
            onKeyDown={onKeyDown}
            onBlur={() => commitDraft(mode.draft)}
          />
          <span className="hours-unit">h</span>
          {mode.problem && (
            <span className="hours-problem" role="alert">
              {mode.problem}
            </span>
          )}
        </span>
      )
    case 'saving':
      return (
        <span className="hours hours--saving" aria-live="polite">
          {formatHours(person.weeklyHours)} h <span className="hours-note">saving…</span>
        </span>
      )
    case 'failed':
      return (
        <span className="hours hours--failed">
          <button type="button" className="hours-value" onClick={beginEdit} aria-label={`${label}, edit`}>
            {formatHours(person.weeklyHours)} h
          </button>
          <span className="hours-error" role="alert">
            Couldn’t save {formatHours(mode.attempted)} h: {mode.message}{' '}
            <button type="button" onClick={() => void save(mode.attempted)}>
              Retry
            </button>{' '}
            <button type="button" onClick={() => setMode({ kind: 'view' })}>
              Dismiss
            </button>
          </span>
        </span>
      )
    default:
      return (
        <span className="hours">
          <button type="button" className="hours-value" onClick={beginEdit} aria-label={`${label}, edit`}>
            {formatHours(person.weeklyHours)} h
          </button>
        </span>
      )
  }
}
