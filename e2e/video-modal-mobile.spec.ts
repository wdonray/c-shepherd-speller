import { test, expect } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

/**
 * Song videos modal on mobile (issue #434). The modal's video rows render
 * titles with `truncate` (white-space: nowrap), and the dialog content is a
 * bare CSS grid whose implicit column sizes to the largest min-content
 * contribution. On a 390px viewport the grid blew out past the viewport:
 * the title, description, and rows were cut off mid-word with no wrapping.
 * The dialog must never be wider than its own box or the viewport.
 */
test.describe('song videos modal on mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  test('the modal fits inside the viewport', async ({ page }) => {
    const response = await page.request.post('/api/lists', {
      data: {
        name: 'E2E Videos',
        patterns: [{ id: 'p1', sound: 'long a', pattern: 'ai', frequency: 'common', words: ['rain'] }],
      },
    })
    expect(response.ok()).toBe(true)
    const { list } = await response.json()

    await page.goto(`/lists/${list.id as string}`)
    await page.getByRole('button', { name: 'Manage song videos for pattern ai' }).click()

    const dialog = page.getByRole('dialog', { name: 'Song videos for pattern ai' })
    await expect(dialog).toBeVisible()
    // Let the open animation settle so measurements reflect the final layout.
    await page.waitForTimeout(500)

    const overflow = await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)

    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  })
})
