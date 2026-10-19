import { test, expect, type Page } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

/**
 * Toolbar stick-offset regression (issues #476, #485).
 *
 * The site header is `sticky top-0` inside SiteChrome's fixed-height
 * (min-h-[74px]) slot wrapper, so it has nowhere to travel and scrolls
 * away with the page at EVERY breakpoint. Any toolbar stick offset that
 * assumed the header stays stuck (the old `top-[72px]`) floats the stuck
 * toolbar 72px below the viewport top with nothing above it, leaving a
 * gap that scrolling cards slide through: the toolbar then cuts through
 * the middle of the cards instead of sitting above the content.
 *
 * So at every breakpoint the lists filter toolbar (All/Favorites, Sort,
 * Search) pins flush to the viewport top with no gap.
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

test.describe('lists toolbar stick offset', () => {
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

  test('filter toolbar pins flush to the viewport top on desktop (issue #485)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    for (let i = 1; i <= 8; i++) {
      await seedList(page, `Gap Audit Desktop List ${i}`)
    }

    await page.goto('/lists')
    await page.getByTestId('lists-grid').waitFor()

    const top = await stuckToolbarTop(page)
    expect(top, `stuck toolbar top=${top}px, expected flush to the viewport top`).toBeLessThanOrEqual(1)
  })
})
