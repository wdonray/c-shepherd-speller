import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

/**
 * WCAG 2.2 AA axe-core scans. Every page is scanned in both light and dark
 * themes because color contrast is theme-dependent. Zero violations is the
 * gate; real violations are fixed, never suppressed.
 */
test.describe('accessibility', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  const pages = [
    { path: '/auth/signin', name: 'signin' },
    { path: '/', name: 'home' },
  ]

  for (const { path, name } of pages) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${name} page has no WCAG 2.2 AA violations in ${theme} mode`, async ({ page }) => {
        // next-themes stores the theme in localStorage; set it before load
        // for a deterministic theme without clicking through the UI.
        await page.addInitScript((t) => {
          localStorage.setItem('theme', t)
        }, theme)

        await page.goto(path)
        // Let the client hydrate and the theme apply before scanning.
        await page.waitForTimeout(1000)

        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()

        expect(results.violations).toEqual([])
      })
    }
  }
})
