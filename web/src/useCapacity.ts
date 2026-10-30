import { useCallback, useEffect, useState } from 'react'
import { fetchCapacity, type CapacityResponse, type Person } from './api'

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
  /** Apply a person's new stored values to the loaded grid in place. */
  applyPerson: (person: Person) => void
}

/**
 * Loads capacity for a range and keeps the last good result visible.
 *
 * Range changes abort the in-flight request, so a slow response for a range
 * the manager has already navigated away from can never overwrite a newer
 * one. Failures keep the previous grid on screen alongside the error.
 */
export function useCapacity(from: string, to: string): CapacityState {
  const [data, setData] = useState<CapacityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetchCapacity(from, to, controller.signal)
      .then((res) => {
        setData(res)
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
    setData((current) => {
      if (!current) return current
      return {
        ...current,
        people: current.people.map((row) =>
          row.id === person.id ? { ...row, name: person.name, weeklyHours: person.weeklyHours } : row,
        ),
      }
    })
  }, [])

  const stale = data !== null && (data.from !== from || data.to !== to)

  return { data, loading, error, stale, retry, applyPerson }
}
