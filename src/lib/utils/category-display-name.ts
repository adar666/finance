import type { Category } from '@/types/database'

/** True when next-intl locale is Hebrew (covers `he`, future regional codes). */
export function isHebrewLocale(locale: string): boolean {
  const l = locale.toLowerCase()
  return l === 'he' || l.startsWith('he-') || l.startsWith('he_')
}

/** Category row label for the current UI locale. */
export function getCategoryDisplayName(
  category: Pick<Category, 'name' | 'name_he'>,
  locale: string
): string {
  if (isHebrewLocale(locale)) {
    const he = category.name_he?.trim()
    if (he) return he
  }
  return category.name
}
