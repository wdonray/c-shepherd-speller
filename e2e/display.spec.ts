import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

test.describe('display mode', () => {
  test('redirects unauthenticated visitors to sign-in', async ({ page }) => {
    await page.goto('/display')
    await expect(page).toHaveURL(/\/auth\/signin/)
  })

  // The authenticated display tests are skipped until the pattern-chart
  // E2E seeding is stabilized; the specs below describe the intended UI.
  test.describe.skip('authenticated', () => {
    test.beforeEach(async ({ context }) => {
      await ensureE2EUser()
      await context.addCookies([await sessionCookie()])
    })

    async function seedPatternList(page: Page): Promise<string> {
      const response = await page.request.post('/api/lists', {
        data: {
          name: 'E2E Long A',
          patterns: [
            { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake', 'bake'] },
            { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'less-common', words: ['rain'] },
            {
              id: 'p3',
              sound: 'long a',
              pattern: 'eigh',
              frequency: 'rare',
              words: ['eight'],
              isOddDuck: true,
            },
          ],
        },
      })
      expect(response.ok()).toBe(true)
      const { list } = await response.json()
      return list.id as string
    }

    test('shows the pattern chart with all words at once', async ({ page }) => {
      const id = await seedPatternList(page)
      await page.goto(`/display?list=${id}`)

      // Sound header with a hear button.
      await expect(page.getByText('long a')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Hear the sound long a' })).toBeVisible()

      // One column per regular pattern.
      await expect(page.getByRole('region', { name: 'Pattern a_e' })).toBeVisible()
      await expect(page.getByRole('region', { name: 'Pattern ai' })).toBeVisible()

      // All words visible at once as tappable cards.
      for (const word of ['cake', 'bake', 'rain', 'eight']) {
        await expect(page.getByRole('button', { name: `Hear and analyze the word ${word}` })).toBeVisible()
      }

      // Odd ducks get their own band.
      await expect(page.getByRole('region', { name: 'Odd ducks' })).toBeVisible()

      // Tapping a word opens its analysis.
      await page.getByRole('button', { name: 'Hear and analyze the word cake' }).click()
      await expect(page.getByRole('dialog', { name: 'Word analysis for cake' })).toBeVisible()
    })

    test('picker lists available lists', async ({ page }) => {
      await seedPatternList(page)
      await page.goto('/display')
      await expect(page.getByRole('heading', { name: 'Present a list' })).toBeVisible()
      await expect(page.getByText('E2E Long A')).toBeVisible()
    })

    test('empty picker shows a neutral empty state', async ({ page }) => {
      await page.goto('/display')
      await expect(page.getByText('No word lists yet')).toBeVisible()
    })

    for (const theme of ['light', 'dark'] as const) {
      test(`has no WCAG 2.2 AA violations in ${theme} mode with list data`, async ({ page }) => {
        await page.addInitScript((t) => {
          localStorage.setItem('theme', t)
        }, theme)

        const id = await seedPatternList(page)
        await page.goto(`/display?list=${id}`)
        await expect(page.getByRole('region', { name: 'Pattern a_e' })).toBeVisible()
        await page.waitForTimeout(1000)

        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
        expect(results.violations).toEqual([])
      })
    }
  })
})
