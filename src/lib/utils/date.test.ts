import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  formatDate,
  getCurrentMonthRange,
  getPreviousMonths,
  isInDateRange,
  isDateStringWithinNextDays,
} from './date'

describe('formatDate', () => {
  it('formats ISO date string', () => {
    expect(formatDate('2024-03-15')).toMatch(/Mar/)
    expect(formatDate('2024-03-15')).toMatch(/15/)
    expect(formatDate('2024-03-15')).toMatch(/2024/)
  })
})

describe('getCurrentMonthRange', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns start and end of current month', () => {
    const { start, end } = getCurrentMonthRange()
    expect(start.getUTCMonth()).toBe(5) // June 0-indexed
    expect(start.getUTCDate()).toBe(1)
    expect(end.getUTCMonth()).toBe(5)
    expect(end.getUTCDate()).toBeGreaterThanOrEqual(28)
  })
})

describe('getPreviousMonths', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns count months oldest-first', () => {
    const months = getPreviousMonths(3)
    expect(months).toHaveLength(3)
    expect(months[0].getUTCMonth()).toBe(3) // Apr
    expect(months[1].getUTCMonth()).toBe(4) // May
    expect(months[2].getUTCMonth()).toBe(5) // Jun
  })
})

describe('isDateStringWithinNextDays', () => {
  const now = new Date('2024-06-10T12:00:00.000Z')

  it('includes today through end of now+days', () => {
    expect(isDateStringWithinNextDays('2024-06-10', 7, now)).toBe(true)
    expect(isDateStringWithinNextDays('2024-06-15', 7, now)).toBe(true)
    expect(isDateStringWithinNextDays('2024-06-17', 7, now)).toBe(true)
  })

  it('excludes past and after window', () => {
    expect(isDateStringWithinNextDays('2024-06-09', 7, now)).toBe(false)
    expect(isDateStringWithinNextDays('2024-06-18', 7, now)).toBe(false)
  })
})

describe('isInDateRange', () => {
  it('returns true when date is inside interval', () => {
    const start = new Date('2024-01-01')
    const end = new Date('2024-01-31')
    expect(isInDateRange('2024-01-15', start, end)).toBe(true)
  })

  it('returns false when outside', () => {
    const start = new Date('2024-01-01')
    const end = new Date('2024-01-31')
    expect(isInDateRange('2024-02-01', start, end)).toBe(false)
  })
})
