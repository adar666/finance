import { describe, expect, it } from 'vitest'
import { advanceRecurringDate } from './recurring-dates'

describe('advanceRecurringDate', () => {
  it('adds one day for daily', () => {
    expect(advanceRecurringDate('2024-06-10', 'daily')).toBe('2024-06-11')
  })

  it('adds 7 days for weekly', () => {
    expect(advanceRecurringDate('2024-06-10', 'weekly')).toBe('2024-06-17')
  })

  it('adds one month for monthly', () => {
    expect(advanceRecurringDate('2024-01-15', 'monthly')).toBe('2024-02-15')
  })

  it('advances month without end-of-month overflow for day 30', () => {
    expect(advanceRecurringDate('2024-06-30', 'monthly')).toBe('2024-07-30')
  })

  it('adds one year for yearly', () => {
    expect(advanceRecurringDate('2024-03-01', 'yearly')).toBe('2025-03-01')
  })
})
