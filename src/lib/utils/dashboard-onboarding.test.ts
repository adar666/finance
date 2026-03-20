import { describe, expect, it } from 'vitest'
import { shouldShowFinanceWelcomeHero } from './dashboard-onboarding'

describe('shouldShowFinanceWelcomeHero', () => {
  it('false while accounts still loading', () => {
    expect(
      shouldShowFinanceWelcomeHero({
        accountsLoaded: false,
        accountCount: 0,
        transactionsProbeLoaded: true,
        anyTransactionExists: false,
      })
    ).toBe(false)
  })

  it('true when no accounts', () => {
    expect(
      shouldShowFinanceWelcomeHero({
        accountsLoaded: true,
        accountCount: 0,
        transactionsProbeLoaded: false,
        anyTransactionExists: false,
      })
    ).toBe(true)
  })

  it('false while transaction probe loading when accounts exist', () => {
    expect(
      shouldShowFinanceWelcomeHero({
        accountsLoaded: true,
        accountCount: 2,
        transactionsProbeLoaded: false,
        anyTransactionExists: false,
      })
    ).toBe(false)
  })

  it('true when accounts exist but no transactions yet', () => {
    expect(
      shouldShowFinanceWelcomeHero({
        accountsLoaded: true,
        accountCount: 1,
        transactionsProbeLoaded: true,
        anyTransactionExists: false,
      })
    ).toBe(true)
  })

  it('false when any transaction exists', () => {
    expect(
      shouldShowFinanceWelcomeHero({
        accountsLoaded: true,
        accountCount: 1,
        transactionsProbeLoaded: true,
        anyTransactionExists: true,
      })
    ).toBe(false)
  })
})
