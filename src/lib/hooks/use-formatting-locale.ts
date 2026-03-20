'use client'

import { useLocale } from 'next-intl'

const INTL_LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  he: 'he-IL',
}

export function useFormattingLocale() {
  const locale = useLocale()
  return {
    locale,
    intlLocale: INTL_LOCALE_MAP[locale] ?? 'en-US',
  }
}
