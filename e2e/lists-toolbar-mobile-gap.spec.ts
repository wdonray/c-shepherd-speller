import { test, expect, type Page } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

/**
 * Mobile toolbar gap regression (issue #476).
 *
 * Donray's decision (Option B): on mobile the site header scrolls away and
 * the lists filter toolbar (All/Favorites, Sort, Search) pins flush to the
 * viewport top with no gap. Desktop behavior stays as-is: the toolbar pins
 * below the 72px site header.
 *
 * Root cause: the toolbar was `sticky top-[72px]` at every breakpoint, but
 * the header's own stickiness is constrained by its 74px slot wrapper
 * (SiteChrome's HeaderSlot), so the header scrolls away with the page and
 * the stuck toolbar floats 72px below the viewport top, leaving a gap.
 */

async function seedList(page: Page, name: string): Promise<void> {
  const response = await page.request.post('/api/lists', {
    data: {
      name,
      patterns: [
        {
          sound: 'long a',
          pattern: 'a_e',
          frequency: 'common',
          words: ['cake', 'bake', 'late'],
        },
      ],
    },
  })
  expect(response.ok()).toBe(true)
}

/** Scrolls to the bottom of the page so the toolbar is stuck, then returns its viewport top. */
async function stuckToolbarTop(page: Page): Promise<number> {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  // Let the scroll settle and the sticky toolbar pin.
  await page.waitForTimeout(500)
  const top = await page.evaluate(() => {
    const toolbar = document.querySelector('[data-testid="lists-filter-toolbar"]')
    return toolbar ? toolbar.getBoundingClientRect().top : null
  })
  expect(top).not.toBeNull()
  return top as number
}

test.describe('lists toolbar mobile gap', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  test('filter toolbar pins flush to the viewport top on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    for (let i = 1; i <= 8; i++) {
      await seedList(page, `Gap Audit List ${i}`)
    }

    await page.goto('/lists')
    await page.getByTestId('lists-grid').waitFor()

    const top = await stuckToolbarTop(page)
    expect(top, `stuck toolbar top=${top}px, expected flush to the viewport top`).toBeLessThanOrEqual(1)
  })

  test('filter toolbar still pins below the site header offset on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    for (let i = 1; i <= 8; i++) {
      await seedList(page, `Gap Audit Desktop List ${i}`)
    }

    await page.goto('/lists')
    await page.getByTestId('lists-grid').waitFor()

    const top = await stuckToolbarTop(page)
    expect(top, `stuck toolbar top=${top}px, expected at the 72px header offset`).toBeGreaterThanOrEqual(71)
    expect(top, `stuck toolbar top=${top}px, expected at the 72px header offset`).toBeLessThanOrEqual(73)
  })
})
