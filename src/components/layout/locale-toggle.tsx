'use client'

import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { cn } from '@/lib/utils'
import type { Locale } from '@/i18n/config'

const LABELS: Record<Locale, string> = {
  en: 'EN',
  he: 'עב',
}

function setLocaleCookie(locale: Locale) {
  document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`
}

export function LocaleToggle({ className }: { className?: string }) {
  const current = useLocale() as Locale
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const next: Locale = current === 'en' ? 'he' : 'en'

  function toggle() {
    setLocaleCookie(next)
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      className={cn(
        'inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-semibold tabular-nums transition-colors',
        'border border-border bg-muted/50 hover:bg-accent text-foreground',
        isPending && 'opacity-50',
        className
      )}
      aria-label={`Switch to ${next === 'he' ? 'Hebrew' : 'English'}`}
    >
      {LABELS[next]}
    </button>
  )
}
