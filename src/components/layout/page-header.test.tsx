import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageHeader } from './page-header'

describe('PageHeader', () => {
  it('renders title and optional description', () => {
    render(
      <PageHeader title="Dashboard" description="Your financial overview" />
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('Your financial overview')).toBeInTheDocument()
  })

  it('renders children in the actions slot', () => {
    render(
      <PageHeader title="Accounts">
        <button type="button">Add</button>
      </PageHeader>
    )
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })
})
