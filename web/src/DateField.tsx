import { useEffect, useState, type KeyboardEvent } from 'react'

type Props = {
  label: string
  value: string
  onCommit: (iso: string) => void
}

/**
 * A date input that only ever commits a believable 'YYYY-MM-DD'.
 *
 * Browsers fire change on every keystroke while a year is being typed, so
 * "0002" and "0020" arrive as real dates in the distant past, and Chrome
 * happily produces five-digit years. Those never reach the caller: an
 * implausible value waits for more typing and is discarded on blur.
 * Picker selections are always plausible and apply immediately.
 */
export function DateField({ label, value, onCommit }: Props) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  function commit(v: string) {
    if (!isPlausibleDate(v)) {
      setDraft(value)
      return
    }
    if (v !== value) onCommit(v)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commit(draft)
  }

  return (
    <label>
      {label}
      <input
        type="date"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          if (isPlausibleDate(e.target.value)) commit(e.target.value)
        }}
        onBlur={() => commit(draft)}
        onKeyDown={onKeyDown}
      />
    </label>
  )
}

export function isPlausibleDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const year = Number(iso.slice(0, 4))
  return year >= 2000 && year <= 2099
}
