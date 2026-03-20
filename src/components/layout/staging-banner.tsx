import { AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * Staging strip — use only when `isStagingFinanceHost(host)` is true (see root layout).
 * Fixed to the top of the viewport so it stays visible on full-screen routes (e.g. /login).
 */
export function StagingBannerBar() {
  const t = useTranslations('staging')

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 right-0 left-0 z-[200] flex w-full items-center justify-center gap-2 border-b border-amber-950/20 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950 shadow-sm dark:border-amber-400/30 dark:bg-amber-600 dark:text-amber-50"
    >
      <AlertTriangle className="size-4 shrink-0 opacity-90" aria-hidden />
      <span>
        <strong>{t('label')}</strong>
        {' — '}
        {t('message')}
      </span>
    </div>
  )
}
