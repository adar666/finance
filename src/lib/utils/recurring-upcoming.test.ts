import { describe, expect, it } from 'vitest'
import { filterUpcomingRecurringRules } from './recurring-upcoming'

const now = new Date('2024-06-10T12:00:00.000Z')

describe('filterUpcomingRecurringRules', () => {
  it('keeps only active income/expense in window and sorts by date', () => {
    const rules = [
      {
        id: '1',
        is_active: true,
        type: 'expense',
        next_occurrence: '2024-06-12',
        description: 'B',
      },
      {
        id: '2',
        is_active: true,
        type: 'income',
        next_occurrence: '2024-06-11',
        description: 'A',
      },
      {
        id: '3',
        is_active: false,
        type: 'expense',
        next_occurrence: '2024-06-11',
      },
      {
        id: '4',
        is_active: true,
        type: 'transfer',
        next_occurrence: '2024-06-11',
      },
      {
        id: '5',
        is_active: true,
        type: 'expense',
        next_occurrence: '2024-06-20',
      },
    ]
    const out = filterUpcomingRecurringRules(rules, now, 7, 10)
    expect(out.map((r) => r.id)).toEqual(['2', '1'])
  })

  it('respects maxItems', () => {
    const rules = [
      { id: 'a', is_active: true, type: 'expense', next_occurrence: '2024-06-11' },
      { id: 'b', is_active: true, type: 'expense', next_occurrence: '2024-06-12' },
      { id: 'c', is_active: true, type: 'expense', next_occurrence: '2024-06-13' },
    ]
    expect(filterUpcomingRecurringRules(rules, now, 7, 2)).toHaveLength(2)
  })
})
