import { test, expect, type Page } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

/**
 * Compact mobile filter bar (issue #484).
 *
 * On mobile the lists toolbar pinned three stacked full-width rows
 * (All/Favorites tabs, Sort, Search), about 200px of pinned chrome on a
 * 390px phone. Below the md breakpoint it collapses to one 56px sticky
 * row: compact tabs, a sort icon button opening the existing bottom
 * sheet, and a search icon that expands into the full search field.
 *
 * Also covers the Donray-confirmed scroll behavior: the page scrolls to
 * top when the result set changes (view tab, sort order, search query),
 * but not for actions that leave the result set alone (favoriting).
 */

async function seedList(page: Page, name: string): Promise<string> {
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
  const { list } = await response.json()
  return list.id as string
}

async function setFavorite(page: Page, id: string, isFavorite: boolean): Promise<void> {
  const response = await page.request.put(`/api/lists/${encodeURIComponent(id)}`, {
    data: { isFavorite, favoriteOrder: 0 },
  })
  expect(response.ok()).toBe(true)
}

async function scrollY(page: Page): Promise<number> {
  return page.evaluate(() => window.scrollY)
}

test.describe('compact mobile filter bar', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  test('renders a single compact sticky row on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const id = await seedList(page, 'Compact Bar Tab List')
    await setFavorite(page, id, true)

    await page.goto('/lists')
    await page.getByTestId('lists-grid').waitFor()

    const mobileBar = page.getByTestId('mobile-filter-bar')
    const desktopBar = page.getByTestId('desktop-filter-bar')
    await expect(mobileBar).toBeVisible()
    await expect(desktopBar).toBeHidden()

    // The row itself is 56px (h-14); the whole pinned toolbar (row plus the
    // container's vertical padding) stays far below the old ~200px stack.
    const barBox = await mobileBar.boundingBox()
    expect(barBox, 'mobile bar should be a single 56px row').not.toBeNull()
    expect(barBox!.height).toBeLessThanOrEqual(58)
    const toolbarBox = await page.getByTestId('lists-filter-toolbar').boundingBox()
    expect(toolbarBox, 'pinned toolbar should stay compact').not.toBeNull()
    expect(toolbarBox!.height).toBeLessThanOrEqual(80)

    await expect(mobileBar.getByRole('tab', { name: 'All' })).toBeVisible()
    await expect(mobileBar.getByRole('tab', { name: 'Favorites' })).toBeVisible()
    await expect(mobileBar.getByRole('button', { name: 'Sort lists' })).toBeVisible()
    await expect(mobileBar.getByRole('button', { name: 'Search lists' })).toBeVisible()

    // Leave the shared E2E user the way we found it.
    await setFavorite(page, id, false)
  })

  test('search expands, filters, and collapses back on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const tag = Date.now().toString(36)
    const listName = `Compact Bar Zucchini ${tag}`
    await seedList(page, listName)

    await page.goto('/lists')
    await page.getByTestId('lists-grid').waitFor()
    const mobileBar = page.getByTestId('mobile-filter-bar')

    // Expanding the search must not move the content below the sticky bar:
    // the field renders as an absolute overlay inside the fixed 56px row.
    const gridTopBefore = await page.evaluate(() => {
      const grid = document.querySelector('[data-testid="lists-grid"]')
      return grid?.getBoundingClientRect().top ?? null
    })
    await mobileBar.getByRole('button', { name: 'Search lists' }).click()
    const searchInput = mobileBar.getByRole('textbox', { name: 'Search lists' })
    await expect(searchInput).toBeVisible()
    await expect(searchInput).toBeFocused()

    const gridTopExpanded = await page.evaluate(() => {
      const grid = document.querySelector('[data-testid="lists-grid"]')
      return grid?.getBoundingClientRect().top ?? null
    })
    expect(gridTopExpanded, 'expanding search must not shift the grid').toBe(gridTopBefore)

    await searchInput.fill(`zucchini ${tag}`)
    await expect(page.getByText(`1 result for "zucchini ${tag}".`)).toBeVisible()
    await expect(page.getByText(listName)).toBeVisible()

    await mobileBar.getByRole('button', { name: 'Clear search and close' }).click()
    await expect(mobileBar.getByTestId('mobile-search-expanded')).toBeHidden()
    await expect(page.getByText(listName)).toBeVisible()
    const gridTopAfter = await page.evaluate(() => {
      const grid = document.querySelector('[data-testid="lists-grid"]')
      return grid?.getBoundingClientRect().top ?? null
    })
    expect(gridTopAfter, 'collapsing search must not shift the grid').toBe(gridTopBefore)
  })

  test('scrolls to top when the view tab changes on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const tag = Date.now().toString(36)
    const favoriteName = `Compact Bar Scroll Favorite ${tag}`
    const favoriteId = await seedList(page, favoriteName)
    await setFavorite(page, favoriteId, true)
    for (let i = 1; i <= 8; i++) {
      await seedList(page, `Compact Bar Scroll List ${i}`)
    }

    await page.goto('/lists')
    await page.getByTestId('lists-grid').waitFor()

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(300)
    expect(await scrollY(page)).toBeGreaterThan(200)

    await page.getByTestId('mobile-filter-bar').getByRole('tab', { name: 'Favorites' }).click()
    expect(await scrollY(page), 'changing the view tab scrolls to top').toBe(0)
    await expect(page.getByText(favoriteName)).toBeVisible()

    await setFavorite(page, favoriteId, false)
  })

  test('scrolls to top when the sort changes on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    for (let i = 1; i <= 8; i++) {
      await seedList(page, `Compact Bar Sort List ${i}`)
    }

    await page.goto('/lists')
    await page.getByTestId('lists-grid').waitFor()

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(300)
    expect(await scrollY(page)).toBeGreaterThan(200)

    await page.getByTestId('mobile-filter-bar').getByRole('button', { name: 'Sort lists' }).click()
    await expect(page.getByRole('dialog', { name: 'Sort lists' })).toBeVisible()
    await page.getByRole('button', { name: 'Name A-Z' }).click()
    expect(await scrollY(page), 'changing the sort scrolls to top').toBe(0)
  })

  test('scrolls to top when the search query changes on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const tag = Date.now().toString(36)
    for (let i = 1; i <= 8; i++) {
      await seedList(page, `Compact Bar Query ${tag} List ${i}`)
    }

    await page.goto('/lists')
    await page.getByTestId('lists-grid').waitFor()

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(300)
    expect(await scrollY(page)).toBeGreaterThan(200)

    const mobileBar = page.getByTestId('mobile-filter-bar')
    await mobileBar.getByRole('button', { name: 'Search lists' }).click()
    await mobileBar.getByRole('textbox', { name: 'Search lists' }).fill(`query ${tag} list 3`)
    expect(await scrollY(page), 'changing the search query scrolls to top').toBe(0)
  })

  test('does not scroll when a list is favorited on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const tag = Date.now().toString(36)
    const starName = `Compact Bar Star ${tag}`
    const id = await seedList(page, starName)
    for (let i = 1; i <= 6; i++) {
      await seedList(page, `Compact Bar Star Filler ${i}`)
    }

    await page.goto('/lists')
    await page.getByTestId('lists-grid').waitFor()

    await page.evaluate(() => window.scrollTo(0, 400))
    await page.waitForTimeout(300)
    const before = await scrollY(page)

    // dispatchEvent (not click): Playwright's click would scroll the star
    // button into view itself, which would mask the app's own behavior.
    // We want to prove favoriting alone does not move the page.
    await page.getByRole('button', { name: `Add ${starName} to favorites` }).dispatchEvent('click')
    await expect(page.getByRole('button', { name: `Remove ${starName} from favorites` })).toBeVisible()
    const after = await scrollY(page)
    expect(Math.abs(after - before), 'favoriting must not scroll').toBeLessThan(2)

    await setFavorite(page, id, false)
  })

  test('keeps the full stacked toolbar on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const id = await seedList(page, 'Compact Bar Desktop List')
    await setFavorite(page, id, true)

    await page.goto('/lists')
    await page.getByTestId('lists-grid').waitFor()

    await expect(page.getByTestId('mobile-filter-bar')).toBeHidden()
    const desktopBar = page.getByTestId('desktop-filter-bar')
    await expect(desktopBar).toBeVisible()
    await expect(desktopBar.getByRole('tab', { name: 'All' })).toBeVisible()
    await expect(desktopBar.getByRole('tab', { name: 'Favorites' })).toBeVisible()
    await expect(desktopBar.getByRole('button', { name: /Sort:/ })).toBeVisible()
    await expect(desktopBar.getByRole('textbox', { name: 'Search lists' })).toBeVisible()

    await setFavorite(page, id, false)
  })
})
