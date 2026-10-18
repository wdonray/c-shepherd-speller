import { test, expect, type Page } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

/**
 * Sticky toolbar stacking regression (issue #421).
 *
 * On the lists page the filter toolbar (All/Favorites tabs, sort, search)
 * sticks below the site header while scrolling. WordListCard's action
 * button row is `relative z-10` (so the buttons sit above the card's
 * stretched link). When the toolbar was also z-10, the equal z-index tie
 * was broken by DOM order and the scrolling card's Edit list / Present /
 * Delete buttons painted ON TOP of the sticky toolbar.
 *
 * This test scrolls a card's action button underneath the stuck toolbar and
 * asserts the toolbar occludes it: the topmost element at the button's
 * center must belong to the toolbar, not the card.
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

test.describe('lists toolbar stacking', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  test('sticky filter toolbar stays above scrolling card action buttons on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await seedList(page, 'Stacking Audit List A')
    await seedList(page, 'Stacking Audit List B')
    await seedList(page, 'Stacking Audit List C')

    await page.goto('/lists')
    await page.getByTestId('lists-grid').waitFor()

    // Scroll the first card's action button so it sits underneath the
    // stuck toolbar, the real-world scroll position from issue #421.
    await page.evaluate(() => {
      const grid = document.querySelector('[data-testid="lists-grid"]')
      const button = Array.from(grid?.querySelectorAll('button') ?? []).find((b) =>
        b.textContent?.includes('Edit list')
      )
      const rect = button?.getBoundingClientRect()
      if (rect) window.scrollBy(0, rect.top - 200)
    })
    // Let the scroll settle and the sticky toolbar pin.
    await page.waitForTimeout(500)

    const hit = await page.evaluate(() => {
      const grid = document.querySelector('[data-testid="lists-grid"]')
      const button = Array.from(grid?.querySelectorAll('button') ?? []).find((b) =>
        b.textContent?.includes('Edit list')
      )
      const rect = button?.getBoundingClientRect()
      if (!rect) return { error: 'no Edit list button found' }
      const el = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      // The sticky filter bar itself (not the "List views" tablist, which
      // only renders when the teacher has favorites).
      const stickyToolbar = document.querySelector('[data-testid="lists-filter-toolbar"]')
      return {
        buttonCenter: { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) },
        topmostTag: el?.tagName,
        topmostText: (el?.textContent ?? '').slice(0, 40),
        topmostIsToolbar: !!stickyToolbar && stickyToolbar.contains(el),
        topmostIsCardButton: (el?.closest('button')?.textContent ?? '').includes('Edit list'),
      }
    })

    expect(hit.error ?? null).toBeNull()
    // The toolbar must occlude the card button: the topmost element at the
    // button's center belongs to the toolbar, never to the card.
    expect(hit.topmostIsToolbar).toBe(true)
    expect(hit.topmostIsCardButton).toBe(false)
  })
})
