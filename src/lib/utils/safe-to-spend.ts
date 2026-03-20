import type { Transaction, RecurringRule, SavingsGoal } from '@/types/database'

export type SpendLevel = 'green' | 'yellow' | 'red'

export interface SafeToSpendResult {
  monthlyIncome: number
  recurringExpenses: number
  savingsContributions: number
  spentSoFar: number
  total: number
  remaining: number
  percentage: number
  level: SpendLevel
}

export function calculateSafeToSpend(
  transactions: Transaction[],
  recurringRules: RecurringRule[],
  savingsGoals: SavingsGoal[]
): SafeToSpendResult {
  const monthlyIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const recurringExpenses = recurringRules
    .filter((r) => r.is_active && r.type === 'expense')
    .reduce((sum, r) => {
      switch (r.frequency) {
        case 'daily':
          return sum + r.amount * 30
        case 'weekly':
          return sum + r.amount * 4.33
        case 'monthly':
          return sum + r.amount
        case 'yearly':
          return sum + r.amount / 12
        default:
          return sum + r.amount
      }
    }, 0)

  const savingsContributions = savingsGoals
    .filter((g) => {
      if (!g.target_date) return true
      return new Date(g.target_date) > new Date()
    })
    .reduce((sum, g) => {
      if (!g.target_date) return sum
      const now = new Date()
      const target = new Date(g.target_date)
      const monthsLeft = Math.max(
        1,
        (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth())
      )
      const remaining = Math.max(0, g.target_amount - g.current_amount)
      return sum + remaining / monthsLeft
    }, 0)

  const spentSoFar = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  const total = monthlyIncome - recurringExpenses - savingsContributions
  const remaining = Math.max(0, total - spentSoFar)
  const percentage = total > 0 ? Math.min(100, (spentSoFar / total) * 100) : 100

  let level: SpendLevel = 'green'
  if (percentage >= 85) level = 'red'
  else if (percentage >= 60) level = 'yellow'

  return {
    monthlyIncome,
    recurringExpenses: Math.round(recurringExpenses * 100) / 100,
    savingsContributions: Math.round(savingsContributions * 100) / 100,
    spentSoFar,
    total: Math.round(total * 100) / 100,
    remaining: Math.round(remaining * 100) / 100,
    percentage: Math.round(percentage * 10) / 10,
    level,
  }
}
