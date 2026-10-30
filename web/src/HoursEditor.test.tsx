import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HoursEditor } from './HoursEditor'

const ana = { id: 1, name: 'Ana', weeklyHours: 40 }

afterEach(cleanup)

function edit(value: string) {
  fireEvent.click(screen.getByRole('button', { name: /weekly hours for ana/i }))
  const input = screen.getByRole('spinbutton', { name: /weekly hours for ana/i })
  fireEvent.change(input, { target: { value } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

describe('HoursEditor', () => {
  it('hands a parsed, changed value to onSave and leaves edit mode', () => {
    const onSave = vi.fn()
    render(<HoursEditor person={ana} onSave={onSave} onDismiss={() => {}} />)
    edit('32.5')
    expect(onSave).toHaveBeenCalledWith(32.5)
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it('does not call onSave for an invalid or unchanged value', () => {
    const onSave = vi.fn()
    render(<HoursEditor person={ana} onSave={onSave} onDismiss={() => {}} />)

    edit('200')
    expect(screen.getByRole('alert')).toHaveTextContent(/168/)
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Escape' })

    edit('40')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows the failed save and retries with the attempted value', () => {
    const onSave = vi.fn()
    const onDismiss = vi.fn()
    render(
      <HoursEditor
        person={ana}
        save={{ status: 'failed', attempted: 48, message: 'database is away' }}
        onSave={onSave}
        onDismiss={onDismiss}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn.t save 48 h: database is away/i)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onSave).toHaveBeenCalledWith(48)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalled()
  })
})
