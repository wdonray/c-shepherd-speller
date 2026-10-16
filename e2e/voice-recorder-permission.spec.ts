import { test, expect, type Page } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

/**
 * Voice recorder microphone-permission UX. When the browser blocks the
 * microphone, the denied screen must name the real browser UI (the
 * address-bar blocked-microphone icon), never the lock icon Chrome removed
 * in 2023. A second spec covers the happy path: record, save, saved phase.
 */

async function seedListWithWord(page: Page): Promise<string> {
  const response = await page.request.post('/api/lists', {
    data: {
      name: 'E2E Voice',
      patterns: [{ id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake'] }],
    },
  })
  expect(response.ok()).toBe(true)
  const { list } = await response.json()
  return list.id as string
}

test.describe('voice recorder permission denied', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  test('denied screen names the blocked microphone icon, not the lock icon', async ({ page }) => {
    // Simulate a browser-level microphone denial: the warmup getUserMedia
    // request rejects with NotAllowedError, driving the modal to its denied
    // phase exactly as a real denial would. (CDP Browser.setPermission is
    // not reliable in headless Chromium: with no audio device the denial
    // surfaces as NotFoundError, and --use-fake-ui-for-media-stream
    // overrides the denial entirely.)
    await page.addInitScript(() => {
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        value: () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')),
        configurable: true,
      })
    })

    const id = await seedListWithWord(page)
    await page.goto(`/lists/${id}`)
    await page.getByRole('button', { name: 'Record your voice for cake' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Microphone is blocked')).toBeVisible()
    // Chromium one-click path: the blocked-microphone icon in the address bar.
    await expect(dialog.getByText(/microphone icon with a line through it/)).toBeVisible()
    await expect(dialog.getByText(/Look for this blocked microphone icon/)).toBeVisible()
    // The lock icon was removed from Chrome in 2023; the copy must not name it.
    await expect(dialog.getByText(/lock icon/i)).toHaveCount(0)

    // For the human report; /tmp is outside the repo and never committed.
    await dialog.screenshot({ path: '/tmp/voice-denied-screen.png' })
  })
})
