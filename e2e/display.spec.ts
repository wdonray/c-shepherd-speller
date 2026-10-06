import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

test.describe('display mode', () => {
  test('redirects unauthenticated visitors to sign-in', async ({ page }) => {
    await page.goto('/display')
    await expect(page).toHaveURL(/\/auth\/signin/)
  })

  // The authenticated display tests are skipped in PR #22.
  // PR #23 replaces the display mode with the interactive spelling tree,
  // which has its own E2E tests.
  test.describe.skip('authenticated', () => {
    test.beforeEach(async ({ context }) => {
      await ensureE2EUser()
      await context.addCookies([await sessionCookie()])
    })

    async function seedLists(page: Page) {
      await page.goto('/')
      await page.getByRole('button', { name: /my spelling lists/i }).click()
      for (const word of ['cat', 'dog', 'bird']) {
        const input = page.getByPlaceholder('Add a new word to your list')
        await input.fill(word)
        await input.press('Enter')
        await expect(page.getByRole('button', { name: `Edit "${word}"` })).toBeVisible()
      }
      const soundInput = page.getByPlaceholder('Add a new sound pattern')
      await soundInput.fill('sh')
      await soundInput.press('Enter')
      await expect(page.getByRole('button', { name: 'Edit "sh"' })).toBeVisible()
      await page.keyboard.press('Escape')
    }

    test('shows all words at once and switches lists', async ({ page }) => {
      await seedLists(page)

      await page.getByRole('link', { name: /present/i }).click()
      await expect(page).toHaveURL(/\/display$/)

      // Chrome-free: no site header or footer.
      await expect(page.getByRole('banner')).toHaveCount(0)
      await expect(page.getByRole('contentinfo')).toHaveCount(0)

      // All words visible at once, numbered.
      for (const word of ['cat', 'dog', 'bird']) {
        await expect(page.getByText(word, { exact: true })).toBeVisible()
      }
      await expect(page.getByRole('button', { name: /words/i })).toHaveAttribute('aria-pressed', 'true')

      // Switch to the sounds list.
      await page.getByRole('button', { name: /sounds/i }).click()
      await expect(page.getByText('sh', { exact: true })).toBeVisible()
      await expect(page.getByText('cat', { exact: true })).toHaveCount(0)

      // Exit back home.
      await page.getByRole('link', { name: /exit display/i }).click()
      await expect(page).toHaveURL(/\/$/)
    })

    test('empty lists show a neutral empty state', async ({ page }) => {
      await page.goto('/display')
      await expect(page.getByText('No words in this list yet.')).toBeVisible()
    })

    for (const theme of ['light', 'dark'] as const) {
      test(`has no WCAG 2.2 AA violations in ${theme} mode with list data`, async ({ page }) => {
        await page.addInitScript((t) => {
          localStorage.setItem('theme', t)
        }, theme)

        await seedLists(page)
        await page.getByRole('link', { name: /present/i }).click()
        await expect(page).toHaveURL(/\/display$/)
        await page.waitForTimeout(1000)

        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
        expect(results.violations).toEqual([])
      })
    }
  })
})
