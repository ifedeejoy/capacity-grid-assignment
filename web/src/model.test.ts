import { describe, expect, it } from 'vitest'
import { cellStatus, formatHours, parseWeeklyHours, utilisation } from './model'

describe('cellStatus', () => {
  it('reads nothing allocated as idle, even with zero capacity', () => {
    expect(cellStatus(0, 40)).toBe('idle')
    expect(cellStatus(0, 0)).toBe('idle')
  })

  it('treats any allocation against zero capacity as over', () => {
    expect(cellStatus(20, 0)).toBe('over')
    expect(utilisation(20, 0)).toBeNull()
  })

  it('distinguishes over, full and ok at the boundary', () => {
    expect(cellStatus(45, 40)).toBe('over')
    expect(cellStatus(40, 40)).toBe('full')
    expect(cellStatus(40.004, 40)).toBe('full') // within the 2-dp rounding the API applies
    expect(cellStatus(39.99, 40)).toBe('ok')
  })
})

describe('utilisation / formatHours', () => {
  it('rounds to whole percent and trims trailing zeros', () => {
    expect(utilisation(45, 40)).toBe(113)
    expect(formatHours(40)).toBe('40')
    expect(formatHours(37.5)).toBe('37.5')
    expect(formatHours(39.375)).toBe('39.38')
  })
})

describe('parseWeeklyHours', () => {
  it('accepts 0..168 and rejects the rest with a message', () => {
    expect(parseWeeklyHours('32')).toEqual({ value: 32 })
    expect(parseWeeklyHours(' 37.5 ')).toEqual({ value: 37.5 })
    expect(parseWeeklyHours('0')).toEqual({ value: 0 })
    expect(parseWeeklyHours('')).toHaveProperty('error')
    expect(parseWeeklyHours('-1')).toHaveProperty('error')
    expect(parseWeeklyHours('169')).toHaveProperty('error')
    expect(parseWeeklyHours('abc')).toHaveProperty('error')
  })
})
