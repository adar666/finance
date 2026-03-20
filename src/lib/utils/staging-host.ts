/**
 * Hostnames where we show the non-production staging banner.
 * Production: https://finance.urieladar.com — no banner.
 */
const STAGING_FINANCE_HOST = 'staging.finance.urieladar.com'

export function isStagingFinanceHost(host: string): boolean {
  const h = host.split(':')[0]?.toLowerCase().trim() ?? ''
  return h === STAGING_FINANCE_HOST
}
