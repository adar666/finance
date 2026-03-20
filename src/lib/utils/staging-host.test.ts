import { describe, expect, it } from 'vitest'
import { isStagingFinanceHost } from './staging-host'

describe('isStagingFinanceHost', () => {
  it('is true only for staging finance host', () => {
    expect(isStagingFinanceHost('staging.finance.urieladar.com')).toBe(true)
    expect(isStagingFinanceHost('STAGING.FINANCE.URIELADAR.COM')).toBe(true)
    expect(isStagingFinanceHost('staging.finance.urieladar.com:443')).toBe(true)
  })

  it('is false for production and other hosts', () => {
    expect(isStagingFinanceHost('finance.urieladar.com')).toBe(false)
    expect(isStagingFinanceHost('www.finance.urieladar.com')).toBe(false)
    expect(isStagingFinanceHost('localhost')).toBe(false)
    expect(isStagingFinanceHost('')).toBe(false)
  })
})
