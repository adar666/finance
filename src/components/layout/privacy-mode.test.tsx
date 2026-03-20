import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PrivacyModeProvider, PrivateMoney, usePrivacyMode } from './privacy-mode'

function Harness() {
  const { enabled, toggle } = usePrivacyMode()
  return (
    <div>
      <button type="button" aria-label="Toggle privacy" onClick={toggle}>
        privacy:{String(enabled)}
      </button>
      <PrivateMoney>
        <span data-testid="amount">₪1,234.56</span>
      </PrivateMoney>
    </div>
  )
}

describe('PrivacyModeProvider / PrivateMoney', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    localStorage.removeItem('finance-privacy-mode')
  })

  it('shows raw amount when privacy is off', async () => {
    render(
      <PrivacyModeProvider>
        <Harness />
      </PrivacyModeProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/privacy:false/)).toBeInTheDocument()
    })
    expect(screen.getByTestId('amount')).toHaveTextContent('₪1,234.56')
    expect(screen.queryByTitle('Amount hidden')).not.toBeInTheDocument()
  })

  it('wraps amount when privacy toggled on', async () => {
    const user = userEvent.setup()
    render(
      <PrivacyModeProvider>
        <Harness />
      </PrivacyModeProvider>
    )

    await waitFor(() => expect(screen.getByText(/privacy:false/)).toBeInTheDocument())
    await user.click(screen.getByLabelText('Toggle privacy'))

    await waitFor(() => expect(screen.getByText(/privacy:true/)).toBeInTheDocument())
    expect(screen.getByTitle('Amount hidden')).toBeInTheDocument()
    expect(localStorage.getItem('finance-privacy-mode')).toBe('1')
  })
})
