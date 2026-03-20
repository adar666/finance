import { isBefore, parseISO, startOfMonth } from 'date-fns'

export type BudgetHealthLevel = 'ok' | 'warn' | 'over'

const WARN_RATIO = 0.8

/**
 * Compare spent vs budget limit for the active period.
 * - ok: under 80% of limit
 * - warn: 80–100%
 * - over: at or above limit (or limit is 0 with any spend)
 */
export function budgetHealthLevel(spent: number, limit: number): BudgetHealthLevel {
  if (limit <= 0) {
    return spent > 0 ? 'over' : 'ok'
  }
  const ratio = spent / limit
  if (ratio >= 1) return 'over'
  if (ratio >= WARN_RATIO) return 'warn'
  return 'ok'
}

export function budgetHealthRatio(spent: number, limit: number): number {
  if (limit <= 0) return spent > 0 ? Infinity : 0
  return spent / limit
}

/** Same logic as budgets page: expense totals per category id. */
export function sumSpentByCategory(
  transactions: { type: string; category_id: string | null; amount: number }[]
): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of transactions) {
    if (t.type !== 'expense' || t.category_id == null) continue
    map.set(t.category_id, (map.get(t.category_id) ?? 0) + t.amount)
  }
  return map
}

export function effectiveMonthlyBudgetAmount(budget: { period: string; amount: number }): number {
  return budget.period === 'monthly' ? budget.amount : budget.amount / 12
}

export function isBudgetActiveInSelectedMonth(
  budget: { start_date: string },
  monthStart: Date
): boolean {
  const budgetStart = startOfMonth(parseISO(budget.start_date))
  return !isBefore(monthStart, budgetStart)
}

export type BudgetAlertRow = {
  id: string
  name: string
  level: BudgetHealthLevel
  spent: number
  cap: number
}

export type BudgetForAlerts = {
  id: string
  category_id: string
  start_date: string
  period: string
  amount: number
  category?: { name?: string | null } | null
}

/** Dashboard / nudges: budgets in `monthStart` that are warn or over (not ok). */
export function computeBudgetAlertRows(
  budgets: BudgetForAlerts[],
  expenseTransactions: { type: string; category_id: string | null; amount: number }[],
  monthStart: Date
): BudgetAlertRow[] {
  const spentMap = sumSpentByCategory(expenseTransactions)
  const rows: BudgetAlertRow[] = []
  for (const b of budgets) {
    if (!isBudgetActiveInSelectedMonth(b, monthStart)) continue
    const cap = effectiveMonthlyBudgetAmount(b)
    const spent = spentMap.get(b.category_id) ?? 0
    const level = budgetHealthLevel(spent, cap)
    if (level === 'ok') continue
    rows.push({
      id: b.id,
      name: b.category?.name ?? 'Budget',
      level,
      spent,
      cap,
    })
  }
  return rows
}
