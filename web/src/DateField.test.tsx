import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DateField, isPlausibleDate } from './DateField'

afterEach(cleanup)

describe('isPlausibleDate', () => {
  it('rejects the half-typed and over-long years browsers emit', () => {
    expect(isPlausibleDate('2026-02-15')).toBe(true)
    expect(isPlausibleDate('0002-02-15')).toBe(false)
    expect(isPlausibleDate('72026-12-29')).toBe(false)
    expect(isPlausibleDate('')).toBe(false)
  })
})

describe('DateField', () => {
  it('commits plausible dates on change and never commits implausible ones, even on blur', () => {
    const onCommit = vi.fn()
    render(<DateField label="To" value="2026-01-18" onCommit={onCommit} />)
    const input = screen.getByLabelText('To')

    fireEvent.change(input, { target: { value: '0002-02-15' } })
    fireEvent.change(input, { target: { value: '72026-12-29' } })
    fireEvent.blur(input)
    expect(onCommit).not.toHaveBeenCalled()
    expect(input).toHaveValue('2026-01-18')

    fireEvent.change(input, { target: { value: '2026-02-15' } })
    expect(onCommit).toHaveBeenCalledWith('2026-02-15')
  })
})
