import { test, expect } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

/**
 * Mobile pattern-editor section rhythm (issue #553).
 *
 * The pattern editor stacks its sections with a 24px rhythm (space-y-6).
 * An always-rendered reserved slot for the duplicate-pattern-pair notice
 * sat between the identity fields and the Words section, so the gap below
 * the Sound input measured 72px while every other section gap measured
 * 24px: a dead band of empty space above Words on mobile.
 *
 * This spec measures the Sound-input to Words-heading gap at 390px and
 * asserts it matches the editor's normal section rhythm.
 */
test.describe('pattern editor spacing', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  test('gap below Sound matches the section rhythm on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const response = await page.request.post('/api/lists', {
      data: {
        name: 'Spacing Audit List',
        patterns: [
          {
            sound: 'long e',
            pattern: 'ee',
            frequency: 'common',
            words: ['see', 'tree'],
          },
        ],
      },
    })
    expect(response.ok()).toBe(true)
    const { list } = await response.json()

    await page.goto(`/lists/${list.id}`)
    await page.getByLabel('Target sound').waitFor()

    const gaps = await page.evaluate(() => {
      const sound = document.querySelector('input[id^="pattern-sound-"]')
      const wordsHeading = Array.from(document.querySelectorAll('h4')).find((h) => h.textContent?.startsWith('Words'))
      if (!sound || !wordsHeading) return null
      return Math.round(wordsHeading.getBoundingClientRect().top - sound.getBoundingClientRect().bottom)
    })
    expect(gaps).not.toBeNull()
    // Normal section rhythm is 24px (space-y-6); allow a few px of
    // rounding, but nothing near the 72px dead band from issue #553.
    expect(gaps).toBeLessThanOrEqual(32)
  })
})
