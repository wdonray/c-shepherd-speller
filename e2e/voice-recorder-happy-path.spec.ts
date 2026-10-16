import { test, expect, type Page } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

// The fake media stream flags must be set at browser launch, which Playwright
// only allows at the top level of a spec file, hence this separate file.
test.use({
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
})

/**
 * Voice recorder happy path with a fake microphone: record, save, and land
 * on the saved phase.
 */
test.describe('voice recorder happy path', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  test('records, saves, and shows the saved recording', async ({ page }) => {
    const response = await page.request.post('/api/lists', {
      data: {
        name: 'E2E Voice',
        patterns: [{ id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake'] }],
      },
    })
    expect(response.ok()).toBe(true)
    const { list } = await response.json()

    await page.goto(`/lists/${list.id as string}`)
    await page.getByRole('button', { name: 'Record your voice for cake' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Record', exact: true }).click()
    // Recordings under 2 seconds are treated as accidental taps.
    await page.waitForTimeout(3500)
    await dialog.getByRole('button', { name: 'Stop' }).click()

    await expect(dialog.getByRole('button', { name: 'Save recording' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Save recording' }).click()
    await expect(dialog.getByText('Your saved recording')).toBeVisible()
  })
})
