import { test, expect, type Page } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

/**
 * Word-chip grid (issue #488). Pattern words render as compact chips in a
 * responsive grid (2 columns on mobile, 3 on desktop) instead of
 * full-width cards; the whole chip is the audio tap target with a visible
 * speaker affordance, and pattern headers stay exactly as-is.
 */
test.describe('word chips', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  async function seedList(page: Page): Promise<string> {
    const response = await page.request.post('/api/lists', {
      data: {
        name: 'E2E Word Chips',
        patterns: [
          {
            id: 'p1',
            sound: 'long a',
            pattern: 'a_e',
            frequency: 'common',
            words: ['cake', 'bake', 'made', 'late', 'game', 'name'],
          },
        ],
      },
    })
    expect(response.ok()).toBe(true)
    const { list } = await response.json()
    return list.id as string
  }

  test('words render as chips in a responsive grid, headers unchanged', async ({ page }) => {
    const id = await seedList(page)
    await page.goto(`/display?list=${id}`)

    // Every word is exactly one chip button; the whole chip is the tap target.
    for (const word of ['cake', 'bake', 'made', 'late', 'game', 'name']) {
      await expect(page.getByRole('button', { name: `Hear the word ${word}` })).toBeVisible()
    }
    // No per-word speaker buttons anymore: one button per word.
    await expect(page.getByRole('button', { name: 'Hear the word cake' })).toHaveCount(1)

    // The chips sit in a 2-column grid on mobile viewports.
    const grid = page.locator('section[aria-label="Pattern a_e"] ul')
    await expect(grid).toHaveClass(/grid-cols-2/)

    // Pattern headers are untouched: sound, frequency label, and rule slot.
    await expect(page.getByText('long a').first()).toBeVisible()
    await expect(page.getByText('Common').first()).toBeVisible()
  })

  test('tapping a chip speaks the word', async ({ page }) => {
    const id = await seedList(page)
    // Stub speechSynthesis so the tap is observable without audio hardware.
    await page.addInitScript(() => {
      const spoken: string[] = []
      ;(window as unknown as { __spokenWords: string[] }).__spokenWords = spoken
      Object.defineProperty(window, 'speechSynthesis', {
        value: {
          speak: (utterance: SpeechSynthesisUtterance) => {
            spoken.push(utterance.text)
          },
          cancel: () => {},
          getVoices: () => [],
        },
        configurable: true,
      })
    })
    await page.goto(`/display?list=${id}`)
    await page.getByRole('button', { name: 'Hear the word cake' }).click()
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __spokenWords: string[] }).__spokenWords))
      .toContain('cake')
  })
})
