import { describe, it, expect } from 'vitest'
import { calculateSafeToSpend } from './safe-to-spend'
import type { Transaction, RecurringRule, SavingsGoal } from '@/types/database'

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    user_id: 'u1',
    account_id: 'a1',
    category_id: null,
    amount: 0,
    type: 'expense',
    description: 'test',
    date: '2025-03-15',
    notes: null,
    transfer_to_account_id: null,
    recurring_rule_id: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function makeRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: 'r-1',
    user_id: 'u1',
    account_id: 'a1',
    category_id: null,
    amount: 100,
    type: 'expense',
    description: 'Rent',
    frequency: 'monthly',
    day_of_month: 1,
    start_date: '2025-01-01',
    end_date: null,
    next_occurrence: '2025-04-01',
    is_active: true,
    created_at: '',
    ...overrides,
  }
}

function makeGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: 'sg-1',
    user_id: 'u1',
    name: 'Emergency Fund',
    target_amount: 12000,
    current_amount: 0,
    target_date: '2026-03-01',
    icon: 'piggy-bank',
    color: '#10b981',
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('calculateSafeToSpend', () => {
  it('returns green when spending is under 60%', () => {
    const txs = [
      makeTx({ type: 'income', amount: 10000 }),
      makeTx({ type: 'expense', amount: 2000 }),
    ]
    const result = calculateSafeToSpend(txs, [], [])
    expect(result.monthlyIncome).toBe(10000)
    expect(result.spentSoFar).toBe(2000)
    expect(result.total).toBe(10000)
    expect(result.remaining).toBe(8000)
    expect(result.level).toBe('green')
    expect(result.percentage).toBe(20)
  })

  it('returns yellow when spending is 60-85%', () => {
    const txs = [
      makeTx({ type: 'income', amount: 10000 }),
      makeTx({ type: 'expense', amount: 7000 }),
    ]
    const result = calculateSafeToSpend(txs, [], [])
    expect(result.level).toBe('yellow')
    expect(result.percentage).toBe(70)
  })

  it('returns red when spending is over 85%', () => {
    const txs = [
      makeTx({ type: 'income', amount: 10000 }),
      makeTx({ type: 'expense', amount: 9500 }),
    ]
    const result = calculateSafeToSpend(txs, [], [])
    expect(result.level).toBe('red')
    expect(result.percentage).toBe(95)
  })

  it('subtracts monthly recurring expenses', () => {
    const txs = [makeTx({ type: 'income', amount: 10000 })]
    const rules = [makeRule({ amount: 2000, frequency: 'monthly' })]
    const result = calculateSafeToSpend(txs, rules, [])
    expect(result.recurringExpenses).toBe(2000)
    expect(result.total).toBe(8000)
    expect(result.remaining).toBe(8000)
  })

  it('handles weekly recurring by multiplying by 4.33', () => {
    const txs = [makeTx({ type: 'income', amount: 10000 })]
    const rules = [makeRule({ amount: 100, frequency: 'weekly' })]
    const result = calculateSafeToSpend(txs, rules, [])
    expect(result.recurringExpenses).toBe(433)
  })

  it('handles yearly recurring by dividing by 12', () => {
    const txs = [makeTx({ type: 'income', amount: 10000 })]
    const rules = [makeRule({ amount: 1200, frequency: 'yearly' })]
    const result = calculateSafeToSpend(txs, rules, [])
    expect(result.recurringExpenses).toBe(100)
  })

  it('ignores inactive recurring rules', () => {
    const txs = [makeTx({ type: 'income', amount: 10000 })]
    const rules = [makeRule({ amount: 5000, is_active: false })]
    const result = calculateSafeToSpend(txs, rules, [])
    expect(result.recurringExpenses).toBe(0)
    expect(result.total).toBe(10000)
  })

  it('ignores income recurring rules', () => {
    const txs = [makeTx({ type: 'income', amount: 10000 })]
    const rules = [makeRule({ amount: 5000, type: 'income' })]
    const result = calculateSafeToSpend(txs, rules, [])
    expect(result.recurringExpenses).toBe(0)
  })

  it('calculates savings goal contributions', () => {
    const txs = [makeTx({ type: 'income', amount: 10000 })]
    const goals = [
      makeGoal({
        target_amount: 12000,
        current_amount: 0,
        target_date: '2028-03-01',
      }),
    ]
    const result = calculateSafeToSpend(txs, [], goals)
    expect(result.savingsContributions).toBeGreaterThan(0)
    expect(result.total).toBeLessThan(10000)
  })

  it('ignores savings goals with past target dates', () => {
    const txs = [makeTx({ type: 'income', amount: 10000 })]
    const goals = [
      makeGoal({
        target_amount: 12000,
        current_amount: 0,
        target_date: '2020-01-01',
      }),
    ]
    const result = calculateSafeToSpend(txs, [], goals)
    expect(result.savingsContributions).toBe(0)
    expect(result.total).toBe(10000)
  })

  it('handles zero income gracefully', () => {
    const txs = [makeTx({ type: 'expense', amount: 500 })]
    const result = calculateSafeToSpend(txs, [], [])
    expect(result.monthlyIncome).toBe(0)
    expect(result.total).toBe(0)
    expect(result.remaining).toBe(0)
    expect(result.percentage).toBe(100)
    expect(result.level).toBe('red')
  })

  it('clamps remaining at zero when overspent', () => {
    const txs = [
      makeTx({ type: 'income', amount: 5000 }),
      makeTx({ type: 'expense', amount: 8000 }),
    ]
    const result = calculateSafeToSpend(txs, [], [])
    expect(result.remaining).toBe(0)
    expect(result.level).toBe('red')
  })

  it('handles multiple transactions', () => {
    const txs = [
      makeTx({ id: 't1', type: 'income', amount: 3000 }),
      makeTx({ id: 't2', type: 'income', amount: 2000 }),
      makeTx({ id: 't3', type: 'expense', amount: 500 }),
      makeTx({ id: 't4', type: 'expense', amount: 300 }),
    ]
    const result = calculateSafeToSpend(txs, [], [])
    expect(result.monthlyIncome).toBe(5000)
    expect(result.spentSoFar).toBe(800)
    expect(result.remaining).toBe(4200)
    expect(result.level).toBe('green')
  })

  it('excludes recurring-generated expenses from spentSoFar', () => {
    const txs = [
      makeTx({ id: 't1', type: 'income', amount: 10000 }),
      makeTx({ id: 't2', type: 'expense', amount: 2000, recurring_rule_id: 'rule-1' }),
      makeTx({ id: 't3', type: 'expense', amount: 500 }),
    ]
    const result = calculateSafeToSpend(txs, [], [])
    expect(result.spentSoFar).toBe(500)
    expect(result.monthlyIncome).toBe(10000)
  })

  it('combines recurring, savings, and spending correctly', () => {
    const txs = [
      makeTx({ type: 'income', amount: 10000 }),
      makeTx({ type: 'expense', amount: 3000 }),
    ]
    const rules = [makeRule({ amount: 2000, frequency: 'monthly' })]
    const goals = [
      makeGoal({
        target_amount: 6000,
        current_amount: 0,
        target_date: '2028-09-01',
      }),
    ]
    const result = calculateSafeToSpend(txs, rules, goals)
    expect(result.monthlyIncome).toBe(10000)
    expect(result.recurringExpenses).toBe(2000)
    expect(result.savingsContributions).toBeGreaterThan(0)
    expect(result.spentSoFar).toBe(3000)
    expect(result.total).toBeLessThan(8000)
  })
})
