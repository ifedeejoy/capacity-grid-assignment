import { useCallback, useEffect, useState } from 'react'
import { fetchCapacity, updateWeeklyHours, type CapacityResponse, type Person } from './api'

export type SaveState = { status: 'saving' } | { status: 'failed'; attempted: number; message: string }

export type CapacityState = {
  /** Last successfully loaded grid. Kept on screen while a new range loads or fails. */
  data: CapacityResponse | null
  /** A request for the current range is in flight. */
  loading: boolean
  /** The current range failed to load. `data`, if any, is from an earlier range. */
  error: string | null
  /** `data` was loaded for a different range than the one requested. */
  stale: boolean
  retry: () => void
  /** In-flight or failed saves, keyed by person id. Absent means idle. */
  saves: Record<number, SaveState>
  /** Save a person's weekly hours: optimistic, then settled on the server's answer. */
  saveWeeklyHours: (person: Person, weeklyHours: number) => Promise<void>
  dismissSave: (id: number) => void
}

type Loaded = { key: string; data: CapacityResponse }

const rangeKey = (from: string, to: string) => `${from}..${to}`

/**
 * Loads capacity for a range and keeps the last good result visible.
 *
 * Range changes abort the in-flight request, so a slow response for a range
 * the manager has already navigated away from can never overwrite a newer
 * one. Failures keep the previous grid on screen alongside the error.
 *
 * Saves live here rather than in the row that started them: a row can be
 * filtered out of view while its save is still in flight, and the rollback
 * on failure must happen regardless.
 */
export function useCapacity(from: string, to: string): CapacityState {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [saves, setSaves] = useState<Record<number, SaveState>>({})

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetchCapacity(from, to, controller.signal)
      .then((res) => {
        setLoaded({ key: rangeKey(from, to), data: res })
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Could not load capacity')
        setLoading(false)
      })

    return () => controller.abort()
  }, [from, to, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  const applyPerson = useCallback((person: Person) => {
    setLoaded((current) => {
      if (!current) return current
      return {
        ...current,
        data: {
          ...current.data,
          people: current.data.people.map((row) =>
            row.id === person.id ? { ...row, name: person.name, weeklyHours: person.weeklyHours } : row,
          ),
        },
      }
    })
  }, [])

  const dismissSave = useCallback((id: number) => {
    setSaves((current) => {
      const { [id]: _dropped, ...rest } = current
      return rest
    })
  }, [])

  const saveWeeklyHours = useCallback(
    async (person: Person, weeklyHours: number) => {
      const previous = person.weeklyHours
      setSaves((current) => ({ ...current, [person.id]: { status: 'saving' } }))
      applyPerson({ ...person, weeklyHours })
      try {
        const stored = await updateWeeklyHours(person.id, weeklyHours)
        applyPerson(stored)
        dismissSave(person.id)
      } catch (err) {
        applyPerson({ ...person, weeklyHours: previous })
        setSaves((current) => ({
          ...current,
          [person.id]: {
            status: 'failed',
            attempted: weeklyHours,
            message: err instanceof Error ? err.message : 'Could not save',
          },
        }))
      }
    },
    [applyPerson, dismissSave],
  )

  const data = loaded?.data ?? null
  const stale = loaded !== null && loaded.key !== rangeKey(from, to)

  return { data, loading, error, stale, retry, saves, saveWeeklyHours, dismissSave }
}
