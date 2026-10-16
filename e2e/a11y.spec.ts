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
    { path: '/display', name: 'display' },
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

/**
 * The list edit page hosts the pattern editing card (issue #324), so it gets
 * its own scan: a seeded list with one pattern renders the full card.
 */
test.describe('list edit page accessibility', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`list edit page has no WCAG 2.2 AA violations in ${theme} mode`, async ({ page }) => {
      await page.addInitScript((t) => {
        localStorage.setItem('theme', t)
      }, theme)

      const created = await page.request.post('/api/lists', {
        data: {
          name: 'A11y Week 1',
          patterns: [{ sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake', 'bake'] }],
        },
      })
      expect(created.ok()).toBe(true)
      const { list } = await created.json()

      await page.goto(`/lists/${list.id}`)
      // Let the client hydrate and the pattern card render before scanning.
      await page.waitForTimeout(1000)

      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()

      expect(results.violations).toEqual([])
    })
  }
})
/**
 * The custom email auth pages serve signed-out visitors, so they run without
 * the session cookie the block above installs.
 */
test.describe('email auth pages accessibility', () => {
  const emailPages = [
    { path: '/auth/email/signin', name: 'email-signin' },
    { path: '/auth/email/signup', name: 'email-signup' },
    { path: '/auth/email/verify', name: 'email-verify' },
    { path: '/auth/email/forgot-password', name: 'email-forgot-password' },
    { path: '/auth/email/reset-password', name: 'email-reset-password' },
  ]

  for (const { path, name } of emailPages) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${name} page has no WCAG 2.2 AA violations in ${theme} mode`, async ({ page }) => {
        await page.addInitScript((t) => {
          localStorage.setItem('theme', t)
        }, theme)

        await page.goto(path)
        await page.waitForTimeout(1000)

        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()

        expect(results.violations).toEqual([])
      })
    }
  }
})
