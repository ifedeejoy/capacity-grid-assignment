import { describe, expect, it } from 'vitest'
import { clampRange, isoWeek, MAX_WEEKS, mondayOf, shiftRange, sundayOf, weekCount } from './weeks'

describe('mondayOf / sundayOf', () => {
  it('snaps a mid-week date back across a year boundary', () => {
    expect(mondayOf('2026-01-01')).toBe('2025-12-29')
    expect(sundayOf('2026-01-01')).toBe('2026-01-04')
  })

  it('leaves a Monday alone and snaps a Sunday back six days', () => {
    expect(mondayOf('2025-12-29')).toBe('2025-12-29')
    expect(mondayOf('2026-01-04')).toBe('2025-12-29')
  })
})

describe('isoWeek', () => {
  it('matches ISO-8601 week numbering around the new year', () => {
    expect(isoWeek('2025-12-29')).toBe(1) // ISO week 1 of 2026 starts in 2025
    expect(isoWeek('2026-01-05')).toBe(2)
    expect(isoWeek('2026-10-26')).toBe(44)
  })
})

describe('clampRange', () => {
  it('snaps both ends to Monday..Sunday', () => {
    expect(clampRange('2026-01-01', '2026-01-14', 'from')).toEqual({ from: '2025-12-29', to: '2026-01-18' })
  })

  it('moves the other end when the range is inverted', () => {
    expect(clampRange('2026-02-02', '2026-01-18', 'from')).toEqual({ from: '2026-02-02', to: '2026-02-08' })
    expect(clampRange('2026-02-02', '2026-01-18', 'to')).toEqual({ from: '2026-01-12', to: '2026-01-18' })
  })

  it('caps the width at MAX_WEEKS, giving way on the unanchored end', () => {
    const r = clampRange('2020-01-06', '2026-01-18', 'to')
    expect(r.to).toBe('2026-01-18')
    expect(weekCount(r.from, r.to)).toBe(MAX_WEEKS)
  })
})

describe('shiftRange / weekCount', () => {
  it('shifts by whole weeks and preserves width', () => {
    const r = shiftRange({ from: '2025-12-29', to: '2026-01-18' }, 1)
    expect(r).toEqual({ from: '2026-01-05', to: '2026-01-25' })
    expect(weekCount(r.from, r.to)).toBe(3)
  })
})
