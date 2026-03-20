import { headers } from 'next/headers'
import { AlertTriangle } from 'lucide-react'
import { isStagingFinanceHost } from '@/lib/utils/staging-host'

/**
 * Fixed banner when the app is served on the staging hostname (not production).
 */
export async function StagingBanner() {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  if (!isStagingFinanceHost(host)) {
    return null
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[100] flex w-full items-center justify-center gap-2 border-b border-amber-950/20 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950 shadow-sm dark:border-amber-400/30 dark:bg-amber-600 dark:text-amber-50"
    >
      <AlertTriangle className="size-4 shrink-0 opacity-90" aria-hidden />
      <span>
        <strong>Staging</strong>
        {' — '}
        You are on a test environment. Data here is not production.
      </span>
    </div>
  )
}
