import { test, expect } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

test.describe('screenshot', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  test('capture modal with hide buttons', async ({ page }) => {
    const response = await page.request.post('/api/lists', {
      data: {
        name: 'E2E Shot',
        patterns: [{ id: 'p1', sound: 'long a', pattern: 'ai', frequency: 'common', words: ['rain'] }],
      },
    })
    expect(response.ok()).toBe(true)
    const { list } = await response.json()

    await page.goto(`/lists/${list.id as string}`)
    await page.getByRole('button', { name: 'Manage song videos for pattern ai' }).click()
    const dialog = page.getByRole('dialog', { name: 'Song videos for pattern ai' })
    await expect(dialog).toBeVisible()
    await page.waitForTimeout(500)
    await dialog.screenshot({ path: 'screenshots-tmp/modal-hide-mobile.png' })
  })
})
