import { describe, expect, it } from 'vitest'
import {
  budgetHealthLevel,
  budgetHealthRatio,
  computeBudgetAlertRows,
} from './budget-health'

describe('budgetHealthLevel', () => {
  it('returns ok below 80%', () => {
    expect(budgetHealthLevel(70, 100)).toBe('ok')
    expect(budgetHealthLevel(0, 100)).toBe('ok')
  })

  it('returns warn between 80% and 100%', () => {
    expect(budgetHealthLevel(80, 100)).toBe('warn')
    expect(budgetHealthLevel(99, 100)).toBe('warn')
  })

  it('returns over at or above limit', () => {
    expect(budgetHealthLevel(100, 100)).toBe('over')
    expect(budgetHealthLevel(150, 100)).toBe('over')
  })

  it('handles zero limit', () => {
    expect(budgetHealthLevel(0, 0)).toBe('ok')
    expect(budgetHealthLevel(1, 0)).toBe('over')
  })
})

describe('budgetHealthRatio', () => {
  it('returns spent/limit', () => {
    expect(budgetHealthRatio(50, 100)).toBe(0.5)
  })
})

describe('computeBudgetAlertRows', () => {
  const monthStart = new Date('2024-06-01T12:00:00.000Z')

  it('returns warn and over rows only', () => {
    const budgets = [
      {
        id: 'b1',
        category_id: 'c1',
        start_date: '2024-01-01',
        period: 'monthly',
        amount: 100,
        category: { name: 'Food' },
      },
      {
        id: 'b2',
        category_id: 'c2',
        start_date: '2024-01-01',
        period: 'monthly',
        amount: 200,
        category: { name: 'Travel' },
      },
    ]
    const txs = [
      { type: 'expense', category_id: 'c1', amount: 85 },
      { type: 'expense', category_id: 'c2', amount: 250 },
    ]
    const rows = computeBudgetAlertRows(budgets, txs, monthStart)
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.id === 'b1')?.level).toBe('warn')
    expect(rows.find((r) => r.id === 'b2')?.level).toBe('over')
  })

  it('returns empty when all ok', () => {
    const budgets = [
      {
        id: 'b1',
        category_id: 'c1',
        start_date: '2024-01-01',
        period: 'monthly',
        amount: 100,
        category: { name: 'Food' },
      },
    ]
    const txs = [{ type: 'expense', category_id: 'c1', amount: 50 }]
    expect(computeBudgetAlertRows(budgets, txs, monthStart)).toEqual([])
  })

  it('uses Hebrew category label when locale is he', () => {
    const budgets = [
      {
        id: 'b1',
        category_id: 'c1',
        start_date: '2024-01-01',
        period: 'monthly',
        amount: 100,
        category: { name: 'Groceries', name_he: 'מצרכים' },
      },
    ]
    const txs = [{ type: 'expense', category_id: 'c1', amount: 85 }]
    const rows = computeBudgetAlertRows(budgets, txs, monthStart, 'he')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe('מצרכים')
  })
})
