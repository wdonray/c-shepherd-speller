import { test, expect, type Page } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

// iPhone 14 viewport on Chromium (the iPhone 14 device descriptor targets
// WebKit, which is not installed here; these are the same geometry).
test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
})

/**
 * Mobile layout regression tests for the prebuilt library (issue #463).
 * The grade tabs, week rows, pattern chips, and read-only chart preview
 * must all fit a 390px viewport with no horizontal scrolling.
 */
async function assertNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(
    overflow.scrollWidth,
    `${label}: page scrolls horizontally (${overflow.scrollWidth}px > ${overflow.clientWidth}px)`
  ).toBeLessThanOrEqual(overflow.clientWidth)
}

test.describe('prebuilt library mobile layout', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  test('/library has no horizontal overflow', async ({ page }) => {
    await page.goto('/library')
    await expect(page.getByRole('heading', { name: 'Prebuilt spelling lists' })).toBeVisible()
    await assertNoHorizontalOverflow(page, '/library')
  })

  test('/library grade tabs do not overflow', async ({ page }) => {
    await page.goto('/library')
    const tablist = page.getByRole('tablist', { name: 'Filter prebuilt lists by grade' })
    await expect(tablist).toBeVisible()
    const box = await tablist.boundingBox()
    expect(box, 'tablist should be visible').toBeTruthy()
    expect(box!.width).toBeLessThanOrEqual(390)
  })

  test('/library/[id] preview has no horizontal overflow', async ({ page }) => {
    await page.goto('/library/prebuilt-g1-w01')
    await expect(page.getByRole('heading', { name: 'Grade 1 - Week 1' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy to my lists' })).toBeVisible()
    await assertNoHorizontalOverflow(page, '/library/prebuilt-g1-w01')
  })

  test('/library/[id] pull-patterns modal has no horizontal overflow', async ({ page }) => {
    await page.goto('/library/prebuilt-g1-w01')
    await expect(page.getByRole('heading', { name: 'Grade 1 - Week 1' })).toBeVisible()
    await page.getByRole('button', { name: 'Add patterns to...' }).click()
    await expect(page.getByRole('dialog', { name: 'Add patterns to your lists' })).toBeVisible()
    await assertNoHorizontalOverflow(page, '/library/[id] pull modal')
  })
})
