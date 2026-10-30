import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CapacityGrid } from './CapacityGrid'

const grid = {
  from: '2025-12-29',
  to: '2026-01-04',
  weeks: ['2025-12-29'],
  people: [
    { id: 1, name: 'Ana', weeklyHours: 40, allocated: [45] },
    { id: 2, name: 'Bo', weeklyHours: 40, allocated: [10] },
  ],
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('CapacityGrid', () => {
  it('keeps a row whose save failed visible under the over filter, rolled back, with the error', async () => {
    let rejectSave!: (e: Error) => void
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.startsWith('/api/capacity')
          ? Promise.resolve(new Response(JSON.stringify(grid), { status: 200 }))
          : new Promise<Response>((_, reject) => {
              rejectSave = reject
            }),
      ),
    )
    render(<CapacityGrid from="2025-12-29" to="2026-01-04" />)
    await screen.findByText('Ana')

    fireEvent.click(screen.getByRole('checkbox', { name: 'over' }))
    expect(screen.queryByText('Bo')).not.toBeInTheDocument()

    // Raising Ana to 48 h takes her out of "over" while the save is in flight.
    fireEvent.click(screen.getByRole('button', { name: /weekly hours for ana/i }))
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '48' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    const anaRow = screen.getByText('Ana').closest('tr')!
    expect(anaRow).toHaveTextContent('saving…')
    expect(within(anaRow).getByTitle(/45 of 48 h/)).toBeInTheDocument()

    rejectSave(new Error('database is away'))
    await waitFor(() => expect(anaRow).toHaveTextContent(/couldn.t save 48 h/i))
    expect(within(anaRow).getByTitle(/45 of 40 h, over capacity/)).toBeInTheDocument()
    expect(document.querySelector('.summary')).toHaveTextContent('1 of 2 people over capacity')
  })
})

describe('status filter', () => {
  it('shows people with a week in any ticked state, and everyone when nothing is ticked', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(grid), { status: 200 })))
    render(<CapacityGrid from="2025-12-29" to="2026-01-04" />)
    await screen.findByText('Ana')

    fireEvent.click(screen.getByRole('checkbox', { name: 'within' }))
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
    expect(screen.getByText('Bo')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'over' }))
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('Bo')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'within' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'over' }))
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('Bo')).toBeInTheDocument()
    expect(document.querySelector('.summary')).not.toHaveTextContent('showing')
  })
})
