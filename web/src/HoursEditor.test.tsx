import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HoursEditor } from './HoursEditor'

const ana = { id: 1, name: 'Ana', weeklyHours: 40 }

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function edit(value: string) {
  fireEvent.click(screen.getByRole('button', { name: /weekly hours for ana/i }))
  const input = screen.getByRole('spinbutton', { name: /weekly hours for ana/i })
  fireEvent.change(input, { target: { value } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

describe('HoursEditor', () => {
  it('applies optimistically, then settles on what the server stored', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ...ana, weeklyHours: 32.5 }), { status: 200 })),
    )
    const onApply = vi.fn()
    render(<HoursEditor person={ana} onApply={onApply} />)

    edit('32')
    expect(onApply).toHaveBeenNthCalledWith(1, { ...ana, weeklyHours: 32 })
    await waitFor(() => expect(onApply).toHaveBeenNthCalledWith(2, { ...ana, weeklyHours: 32.5 }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('rolls back and offers a retry when the save fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'database is away' }), { status: 500 })),
    )
    const onApply = vi.fn()
    render(<HoursEditor person={ana} onApply={onApply} />)

    edit('32')
    await screen.findByRole('alert')
    expect(onApply).toHaveBeenLastCalledWith({ ...ana, weeklyHours: 40 })
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn.t save 32 h: database is away/i)

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ...ana, weeklyHours: 32 }), { status: 200 })))
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(onApply).toHaveBeenLastCalledWith({ ...ana, weeklyHours: 32 }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not call the server for an invalid or unchanged value', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const onApply = vi.fn()
    render(<HoursEditor person={ana} onApply={onApply} />)

    edit('200')
    expect(screen.getByRole('alert')).toHaveTextContent(/168/)
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Escape' })
    edit('40')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(onApply).not.toHaveBeenCalled()
  })
})
