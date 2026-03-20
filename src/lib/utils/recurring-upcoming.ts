import { isDateStringWithinNextDays } from '@/lib/utils/date'

export type RecurringUpcomingLike = {
  id: string
  is_active: boolean
  type: string
  next_occurrence: string
  description?: string
  amount?: number
}

/** Active income/expense rules with next_occurrence within the next `windowDays` days, sorted by date. */
export function filterUpcomingRecurringRules<T extends RecurringUpcomingLike>(
  rules: T[],
  now: Date,
  windowDays: number,
  maxItems: number = 8
): T[] {
  return rules
    .filter(
      (r) =>
        r.is_active &&
        (r.type === 'income' || r.type === 'expense') &&
        isDateStringWithinNextDays(r.next_occurrence, windowDays, now)
    )
    .sort((a, b) => a.next_occurrence.localeCompare(b.next_occurrence))
    .slice(0, maxItems)
}
