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
 * Mobile layout regression tests for the prebuilt library section on the
 * lists page (issue #463 redesign). The grade pills, pattern search, week
 * cards, and read-only chart preview must all fit a 390px viewport with no
 * horizontal scrolling.
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

  test('/lists prebuilt section has no horizontal overflow', async ({ page }) => {
    await page.goto('/lists')
    await expect(page.getByRole('heading', { name: 'Ready-made library' })).toBeVisible()
    await expect(page.getByTestId('prebuilt-grid')).toBeVisible()
    await assertNoHorizontalOverflow(page, '/lists prebuilt section')
  })

  test('grade pills and pattern search fit the viewport', async ({ page }) => {
    await page.goto('/lists')
    const tablist = page.getByRole('tablist', { name: 'Filter ready-made lists by grade' })
    await expect(tablist).toBeVisible()
    const box = await tablist.boundingBox()
    expect(box, 'tablist should be visible').toBeTruthy()
    expect(box!.width).toBeLessThanOrEqual(390)
    await expect(page.getByLabel('Search ready-made lists by pattern')).toBeVisible()
    await assertNoHorizontalOverflow(page, '/lists prebuilt filters')
  })

  test('pattern search filters weeks across grades', async ({ page }) => {
    await page.goto('/lists')
    await page.getByLabel('Search ready-made lists by pattern').fill('tion')
    await expect(page.getByText(/weeks matching "tion" across all grades/)).toBeVisible()
    await assertNoHorizontalOverflow(page, '/lists prebuilt search results')
  })

  test('/lists/prebuilt/[id] preview has no horizontal overflow', async ({ page }) => {
    await page.goto('/lists/prebuilt/prebuilt-g1-w01')
    await expect(page.getByRole('heading', { name: 'Grade 1 - Week 1' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy to my lists' })).toBeVisible()
    await assertNoHorizontalOverflow(page, '/lists/prebuilt/prebuilt-g1-w01')
  })

  test('/lists/prebuilt/[id] pull-patterns modal has no horizontal overflow', async ({ page }) => {
    await page.goto('/lists/prebuilt/prebuilt-g1-w01')
    await expect(page.getByRole('heading', { name: 'Grade 1 - Week 1' })).toBeVisible()
    await page.getByRole('button', { name: 'Add patterns to...' }).click()
    await expect(page.getByRole('dialog', { name: 'Add patterns to your lists' })).toBeVisible()
    await assertNoHorizontalOverflow(page, '/lists/prebuilt/[id] pull modal')
  })
  test('/lists/prebuilt/[id] action buttons fit the viewport', async ({ page }) => {
    await page.goto('/lists/prebuilt/prebuilt-g1-w01')
    await expect(page.getByRole('heading', { name: 'Grade 1 - Week 1' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Present' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Practice' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Worksheets' })).toBeVisible()
    await assertNoHorizontalOverflow(page, '/lists/prebuilt/[id] action buttons')
  })

  test('present from a prebuilt week shows the badge and no horizontal overflow', async ({ page }) => {
    await page.goto('/display?prebuilt=prebuilt-g1-w01')
    await expect(page.getByRole('heading', { name: /Grade 1 - Week 1/ })).toBeVisible()
    await expect(page.getByText('Ready-made')).toBeVisible()
    await assertNoHorizontalOverflow(page, '/display?prebuilt')
  })

  test('worksheets picker for a prebuilt week has no horizontal overflow', async ({ page }) => {
    await page.goto('/lists/prebuilt/prebuilt-g1-w01/worksheets')
    await expect(page.getByRole('heading', { name: /Printable worksheets/ })).toBeVisible()
    await assertNoHorizontalOverflow(page, '/lists/prebuilt/[id]/worksheets')
  })
})
