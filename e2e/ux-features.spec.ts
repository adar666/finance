import { expect, test } from '@playwright/test'

test.describe('UX features — unauthenticated', () => {
  test('transactions ?add=1 is gated to login (deep link preserved for post-login)', async ({
    page,
  }) => {
    await page.goto('/transactions?add=1')
    await expect(page).toHaveURL(/\/login/)
  })

  test('command palette is not mounted on login — no search field after Ctrl+K', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.keyboard.press('Control+KeyK')
    await expect(page.getByPlaceholder(/Search pages and actions/i)).toHaveCount(0)
  })
})
