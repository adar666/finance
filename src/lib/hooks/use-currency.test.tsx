import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCurrency } from './use-currency'
import { useProfile } from './use-profile'

vi.mock('./use-profile', () => ({
  useProfile: vi.fn(),
}))

function CurrencyLabel() {
  const code = useCurrency()
  return <span data-testid="currency">{code}</span>
}

describe('useCurrency', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.mocked(useProfile).mockReset()
  })

  it('defaults to ILS when profile is missing', () => {
    vi.mocked(useProfile).mockReturnValue({ data: undefined } as ReturnType<typeof useProfile>)
    render(<CurrencyLabel />)
    expect(screen.getByTestId('currency')).toHaveTextContent('ILS')
  })

  it('uses profile currency when present', () => {
    vi.mocked(useProfile).mockReturnValue({
      data: { currency: 'USD' },
    } as ReturnType<typeof useProfile>)
    render(<CurrencyLabel />)
    expect(screen.getByTestId('currency')).toHaveTextContent('USD')
  })
})
