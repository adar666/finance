import { expect, test } from '@playwright/test'

test.describe('unauthenticated smoke', () => {
  test('login page shows email field and magic link CTA', async ({ page }) => {
    await page.goto('/login')
    // CardTitle is a styled div, not a semantic heading
    await expect(page.getByText('Welcome back')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Send magic link' })).toBeVisible()
  })

  test('root redirects to login when not signed in', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
  })
})
