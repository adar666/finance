import type { RecurringFrequency } from '@/types/database'

/**
 * Advance a calendar date (YYYY-MM-DD) by one occurrence of the given frequency.
 * Uses the same semantics as the native Date setters (local TZ).
 */
export function advanceRecurringDate(dateStr: string, frequency: RecurringFrequency): string {
  const d = new Date(dateStr)
  switch (frequency) {
    case 'daily':
      d.setDate(d.getDate() + 1)
      break
    case 'weekly':
      d.setDate(d.getDate() + 7)
      break
    case 'monthly':
      d.setMonth(d.getMonth() + 1)
      break
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1)
      break
  }
  return d.toISOString().slice(0, 10)
}
