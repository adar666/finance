import { describe, it, expect } from 'vitest'
import { formatCompact, formatCurrency, formatPercent } from './currency'

describe('formatCompact', () => {
  it('returns whole number for small values', () => {
    expect(formatCompact(999)).toBe('999')
    expect(formatCompact(-500)).toBe('-500')
  })

  it('uses K suffix from 1000', () => {
    expect(formatCompact(1500)).toBe('1.5K')
    expect(formatCompact(1000)).toBe('1.0K')
  })

  it('uses M suffix from 1_000_000', () => {
    expect(formatCompact(2_500_000)).toBe('2.5M')
  })
})

describe('formatPercent', () => {
  it('adds plus for non-negative', () => {
    expect(formatPercent(5.2)).toBe('+5.2%')
    expect(formatPercent(0)).toBe('+0.0%')
  })

  it('keeps minus for negative', () => {
    expect(formatPercent(-3.1)).toBe('-3.1%')
  })

  it('respects decimals', () => {
    expect(formatPercent(1.234, 2)).toBe('+1.23%')
  })
})

describe('formatCurrency', () => {
  it('formats USD with en-US', () => {
    const s = formatCurrency(1234.5, 'USD', 'en-US')
    expect(s).toMatch(/1,234\.50/)
    expect(s).toContain('$')
  })

  it('formats ILS', () => {
    const s = formatCurrency(99, 'ILS', 'en-US')
    expect(s).toContain('99')
  })
})
