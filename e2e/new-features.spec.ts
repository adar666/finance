import { expect, test } from '@playwright/test'

test.describe('New feature routes — unauthenticated', () => {
  test('settings page redirects to login', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/login/)
  })

  test('transactions page redirects to login', async ({ page }) => {
    await page.goto('/transactions')
    await expect(page).toHaveURL(/\/login/)
  })

  test('dashboard redirects to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('planning page redirects to login', async ({ page }) => {
    await page.goto('/planning')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Mobile Quick-Add FAB — unauthenticated', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('login page renders without Quick-Add FAB (FAB is behind auth)', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Welcome back')).toBeVisible()
    const fab = page.locator('button[aria-label]').filter({ hasText: /\+/ })
    await expect(fab).toHaveCount(0)
  })
})
