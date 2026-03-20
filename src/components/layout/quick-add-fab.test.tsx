import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

const mockMutate = vi.fn()
vi.mock('@/lib/hooks/use-transactions', () => ({
  useCreateTransaction: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}))

vi.mock('@/lib/hooks/use-accounts', () => ({
  useAccounts: () => ({
    data: [{ id: 'acc-1', name: 'Checking', balance: 5000, is_active: true }],
    isLoading: false,
  }),
}))

vi.mock('@/lib/hooks/use-categories', () => ({
  useCategories: () => ({
    data: [
      { id: 'cat-1', name: 'Food', type: 'expense', icon: 'utensils', color: '#ef4444', sort_order: 0 },
      { id: 'cat-2', name: 'Salary', type: 'income', icon: 'wallet', color: '#10b981', sort_order: 0 },
    ],
    isLoading: false,
  }),
}))

import { QuickAddFAB } from './quick-add-fab'

describe('QuickAddFAB', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    mockMutate.mockClear()
  })

  it('renders the FAB button', () => {
    render(<QuickAddFAB />)
    expect(screen.getByRole('button', { name: 'quickAdd.title' })).toBeInTheDocument()
  })

  it('opens dialog on click', async () => {
    const user = userEvent.setup()
    render(<QuickAddFAB />)

    const fab = screen.getByLabelText('quickAdd.title')
    await user.click(fab)
    expect(screen.getByRole('heading', { name: 'quickAdd.title' })).toBeInTheDocument()
  })

  it('shows expense and income toggle buttons', async () => {
    const user = userEvent.setup()
    render(<QuickAddFAB />)

    const fab = screen.getByLabelText('quickAdd.title')
    await user.click(fab)
    expect(screen.getByRole('button', { name: 'common.expense' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common.income' })).toBeInTheDocument()
  })

  it('has save button disabled when amount is empty', async () => {
    const user = userEvent.setup()
    render(<QuickAddFAB />)

    const fab = screen.getByLabelText('quickAdd.title')
    await user.click(fab)
    const saveBtn = screen.getByRole('button', { name: 'quickAdd.save' })
    expect(saveBtn).toBeDisabled()
  })

  it('enables save button when amount is entered', async () => {
    const user = userEvent.setup()
    render(<QuickAddFAB />)

    const fab = screen.getByLabelText('quickAdd.title')
    await user.click(fab)
    const amountInput = screen.getByPlaceholderText('0.00')
    await user.type(amountInput, '42.50')

    const saveBtn = screen.getByRole('button', { name: 'quickAdd.save' })
    expect(saveBtn).not.toBeDisabled()
  })

  it('calls createTransaction on save', async () => {
    const user = userEvent.setup()
    render(<QuickAddFAB />)

    const fab = screen.getByLabelText('quickAdd.title')
    await user.click(fab)
    const amountInput = screen.getByPlaceholderText('0.00')
    await user.type(amountInput, '100')

    const saveBtn = screen.getByRole('button', { name: 'quickAdd.save' })
    await user.click(saveBtn)

    expect(mockMutate).toHaveBeenCalledOnce()
    const [payload] = mockMutate.mock.calls[0]
    expect(payload.amount).toBe(100)
    expect(payload.type).toBe('expense')
    expect(payload.account_id).toBe('acc-1')
  })
})
