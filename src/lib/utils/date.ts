import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  addDays,
  startOfDay,
  endOfDay,
  isWithinInterval,
  parseISO,
  differenceInMonths,
  differenceInDays,
} from 'date-fns'
import { he } from 'date-fns/locale/he'
import type { Locale as DateFnsLocale } from 'date-fns'

const DATE_LOCALE_MAP: Record<string, DateFnsLocale> = { he }

function resolveDateLocale(locale?: string): DateFnsLocale | undefined {
  if (!locale) return undefined
  return DATE_LOCALE_MAP[locale]
}

export function formatDate(date: string | Date, fmt: string = 'MMM d, yyyy', locale?: string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  const opts = resolveDateLocale(locale)
  return format(d, fmt, opts ? { locale: opts } : undefined)
}

export function formatShortDate(date: string | Date, locale?: string): string {
  return formatDate(date, 'MMM d', locale)
}

export function formatMonthYear(date: string | Date, locale?: string): string {
  return formatDate(date, 'MMMM yyyy', locale)
}

export function getCurrentMonthRange() {
  const now = new Date()
  return { start: startOfMonth(now), end: endOfMonth(now) }
}

export function getMonthRange(date: Date) {
  return { start: startOfMonth(date), end: endOfMonth(date) }
}

export function getPreviousMonths(count: number): Date[] {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => subMonths(now, i)).reverse()
}

export function isInDateRange(date: string, start: Date, end: Date): boolean {
  return isWithinInterval(parseISO(date), { start, end })
}

/** Inclusive: from start of `now` through end of `now + days` (calendar days). */
export function isDateStringWithinNextDays(dateStr: string, days: number, now: Date = new Date()): boolean {
  const d = parseISO(dateStr)
  const start = startOfDay(now)
  const end = endOfDay(addDays(start, days))
  return isWithinInterval(d, { start, end })
}

export {
  addMonths,
  addDays,
  subMonths,
  differenceInMonths,
  differenceInDays,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
}
