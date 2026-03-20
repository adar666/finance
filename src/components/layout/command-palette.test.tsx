import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import en from '../../../messages/en.json'
import { CommandPalette } from './command-palette'

const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

function renderCommandPalette() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <CommandPalette />
    </NextIntlClientProvider>
  )
}

describe('CommandPalette', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    push.mockClear()
  })

  it('opens on Meta+K and lists navigation + add action', async () => {
    const user = userEvent.setup()
    renderCommandPalette()

    await user.keyboard('{Meta>}k{/Meta}')

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search pages and actions/i)).toBeInTheDocument()
    })
    expect(screen.getByText('Add transaction')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('opens on Control+K', async () => {
    const user = userEvent.setup()
    renderCommandPalette()

    await user.keyboard('{Control>}k{/Control}')

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search pages and actions/i)).toBeInTheDocument()
    })
  })

  it('navigates to add-transaction URL when Add transaction is chosen', async () => {
    const user = userEvent.setup()
    renderCommandPalette()

    await user.keyboard('{Control>}k{/Control}')
    await waitFor(() => {
      expect(screen.getByText('Add transaction')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('option', { name: /Add transaction/i }))
    expect(push).toHaveBeenCalledWith('/transactions?add=1')
  })

  it('navigates to dashboard when Dashboard is chosen', async () => {
    const user = userEvent.setup()
    renderCommandPalette()

    await user.keyboard('{Control>}k{/Control}')
    await waitFor(() =>
      expect(screen.getByRole('option', { name: /^Dashboard$/ })).toBeInTheDocument()
    )

    await user.click(screen.getByRole('option', { name: /^Dashboard$/ }))
    expect(push).toHaveBeenCalledWith('/')
  })
})
