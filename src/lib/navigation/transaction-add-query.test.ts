import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  consumeAddTransactionQueryParam,
  shouldOpenAddTransactionFromSearch,
} from './transaction-add-query'

describe('shouldOpenAddTransactionFromSearch', () => {
  it('detects add=1 with or without leading ?', () => {
    expect(shouldOpenAddTransactionFromSearch('?add=1')).toBe(true)
    expect(shouldOpenAddTransactionFromSearch('add=1')).toBe(true)
    expect(shouldOpenAddTransactionFromSearch('?add=0')).toBe(false)
    expect(shouldOpenAddTransactionFromSearch('')).toBe(false)
  })
})

describe('consumeAddTransactionQueryParam', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns false on server / no window', () => {
    vi.stubGlobal('window', undefined)
    expect(consumeAddTransactionQueryParam()).toBe(false)
  })

  it('returns false when add is not 1', () => {
    const replaceState = vi.fn()
    vi.stubGlobal('window', {
      location: { search: '?foo=1' },
      history: { replaceState },
    })
    expect(consumeAddTransactionQueryParam('/transactions')).toBe(false)
    expect(replaceState).not.toHaveBeenCalled()
  })

  it('returns true, strips add=1, and replaceState clears query', () => {
    const replaceState = vi.fn()
    vi.stubGlobal('window', {
      location: { search: '?add=1' },
      history: { replaceState },
    })
    expect(consumeAddTransactionQueryParam('/transactions')).toBe(true)
    expect(replaceState).toHaveBeenCalledWith({}, '', '/transactions')
  })
})
