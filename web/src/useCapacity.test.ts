import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CapacityResponse } from './api'
import { useCapacity } from './useCapacity'

function response(from: string, to: string, weeklyHours = 40): CapacityResponse {
  return { from, to, weeks: [from], people: [{ id: 1, name: 'Ana', weeklyHours, allocated: [30] }] }
}

/** A fetch that resolves when told to, and rejects with AbortError if its signal fires first. */
function controllableFetch() {
  const pending: Array<{ url: string; resolve: (body: unknown) => void }> = []
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    return new Promise<Response>((resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      pending.push({ url, resolve: (body) => resolve(new Response(JSON.stringify(body), { status: 200 })) })
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return pending
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useCapacity', () => {
  it('ignores a late response for a range the user has already left', async () => {
    const pending = controllableFetch()
    const { result, rerender } = renderHook(({ from, to }) => useCapacity(from, to), {
      initialProps: { from: '2025-12-29', to: '2026-01-04' },
    })
    expect(result.current.loading).toBe(true)

    rerender({ from: '2026-01-05', to: '2026-01-11' })
    expect(pending).toHaveLength(2)

    // The newer range answers first; then the old one tries to.
    await act(async () => pending[1].resolve(response('2026-01-05', '2026-01-11')))
    await act(async () => pending[0].resolve(response('2025-12-29', '2026-01-04')))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data?.from).toBe('2026-01-05')
    expect(result.current.stale).toBe(false)
  })

  it('keeps the last good grid, marked stale, when the next range fails', async () => {
    const pending = controllableFetch()
    const { result, rerender } = renderHook(({ from, to }) => useCapacity(from, to), {
      initialProps: { from: '2025-12-29', to: '2026-01-04' },
    })
    await act(async () => pending[0].resolve(response('2025-12-29', '2026-01-04')))

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'boom' }), { status: 500 })),
    )
    rerender({ from: '2026-01-05', to: '2026-01-11' })

    await waitFor(() => expect(result.current.error).toBe('boom'))
    expect(result.current.data?.from).toBe('2025-12-29')
    expect(result.current.stale).toBe(true)
  })

  it('a failed save rolls the row back and records the failure, with no row component involved', async () => {
    const pending = controllableFetch()
    const { result } = renderHook(() => useCapacity('2025-12-29', '2026-01-04'))
    await act(async () => pending[0].resolve(response('2025-12-29', '2026-01-04')))

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'boom' }), { status: 500 })))
    let save!: Promise<void>
    act(() => {
      save = result.current.saveWeeklyHours({ id: 1, name: 'Ana', weeklyHours: 40 }, 48)
    })
    expect(result.current.data?.people[0].weeklyHours).toBe(48) // optimistic
    expect(result.current.saves[1]).toEqual({ status: 'saving' })

    await act(() => save)
    expect(result.current.data?.people[0]).toMatchObject({ weeklyHours: 40, allocated: [30] })
    expect(result.current.saves[1]).toEqual({ status: 'failed', attempted: 48, message: 'boom' })

    act(() => result.current.dismissSave(1))
    expect(result.current.saves[1]).toBeUndefined()
  })

  it('a successful save settles on the stored value and clears the save state', async () => {
    const pending = controllableFetch()
    const { result } = renderHook(() => useCapacity('2025-12-29', '2026-01-04'))
    await act(async () => pending[0].resolve(response('2025-12-29', '2026-01-04')))

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ id: 1, name: 'Ana', weeklyHours: 32.5 }), { status: 200 })),
    )
    await act(() => result.current.saveWeeklyHours({ id: 1, name: 'Ana', weeklyHours: 40 }, 32))
    expect(result.current.data?.people[0].weeklyHours).toBe(32.5)
    expect(result.current.saves[1]).toBeUndefined()
  })
})
