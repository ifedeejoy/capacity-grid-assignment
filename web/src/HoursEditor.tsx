import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { Person } from './api'
import { formatHours, parseWeeklyHours } from './model'
import type { SaveState } from './useCapacity'

type Props = {
  person: Person
  /** Progress of this person's save, owned by the grid so it outlives the row. */
  save?: SaveState
  onSave: (weeklyHours: number) => void
  onDismiss: () => void
}

type Editing = { draft: string; problem: string | null }

/**
 * Click-to-edit weekly hours for one row. Owns only the draft; saving,
 * failure and rollback are the grid's business.
 */
export function HoursEditor({ person, save, onSave, onDismiss }: Props) {
  const [editing, setEditing] = useState<Editing | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing !== null]) // eslint-disable-line react-hooks/exhaustive-deps -- select once per edit session

  function beginEdit() {
    if (save?.status === 'failed') onDismiss()
    setEditing({ draft: formatHours(person.weeklyHours), problem: null })
  }

  function commitDraft(draft: string) {
    const parsed = parseWeeklyHours(draft)
    if ('error' in parsed) {
      setEditing({ draft, problem: parsed.error })
      return
    }
    setEditing(null)
    if (parsed.value !== person.weeklyHours) onSave(parsed.value)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!editing) return
    if (e.key === 'Enter') {
      e.preventDefault()
      commitDraft(editing.draft)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditing(null)
    }
  }

  const label = `Weekly hours for ${person.name}`

  if (save?.status === 'saving') {
    return (
      <span className="hours hours--saving" aria-live="polite">
        {formatHours(person.weeklyHours)} h <span className="hours-note">saving…</span>
      </span>
    )
  }

  if (editing) {
    return (
      <span className="hours hours--editing">
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          min={0}
          max={168}
          step="any"
          value={editing.draft}
          aria-label={label}
          aria-invalid={editing.problem !== null}
          onChange={(e) => setEditing({ draft: e.target.value, problem: null })}
          onKeyDown={onKeyDown}
          onBlur={() => commitDraft(editing.draft)}
        />
        <span className="hours-unit">h</span>
        {editing.problem && (
          <span className="hours-problem" role="alert">
            {editing.problem}
          </span>
        )}
      </span>
    )
  }

  return (
    <span className={`hours${save?.status === 'failed' ? ' hours--failed' : ''}`}>
      <button type="button" className="hours-value" onClick={beginEdit} aria-label={`${label}, edit`}>
        {formatHours(person.weeklyHours)} h
      </button>
      {save?.status === 'failed' && (
        <span className="hours-error" role="alert">
          Couldn’t save {formatHours(save.attempted)} h: {save.message}{' '}
          <button type="button" onClick={() => onSave(save.attempted)}>
            Retry
          </button>{' '}
          <button type="button" onClick={onDismiss}>
            Dismiss
          </button>
        </span>
      )}
    </span>
  )
}
