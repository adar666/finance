/** When to show the dashboard welcome / onboarding hero. */
export function shouldShowFinanceWelcomeHero(args: {
  accountsLoaded: boolean
  accountCount: number
  transactionsProbeLoaded: boolean
  anyTransactionExists: boolean
}): boolean {
  if (!args.accountsLoaded) return false
  if (args.accountCount === 0) return true
  if (!args.transactionsProbeLoaded) return false
  return !args.anyTransactionExists
}
