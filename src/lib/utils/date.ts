import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  isWithinInterval,
  parseISO,
  differenceInMonths,
  differenceInDays,
} from 'date-fns'

export function formatDate(date: string | Date, fmt: string = 'MMM d, yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, fmt)
}

export function formatShortDate(date: string | Date): string {
  return formatDate(date, 'MMM d')
}

export function formatMonthYear(date: string | Date): string {
  return formatDate(date, 'MMMM yyyy')
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

export { addMonths, subMonths, differenceInMonths, differenceInDays, parseISO, startOfMonth, endOfMonth }
