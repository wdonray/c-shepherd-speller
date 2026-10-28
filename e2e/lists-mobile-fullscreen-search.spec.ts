import { test, expect, type Page } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

/**
 * Full-screen search view on mobile (issue #555).
 *
 * On mobile widths, tapping the search icon in the lists toolbar opens a
 * dedicated full-screen view instead of expanding the field inline in the
 * 56px toolbar row: with the keyboard up, the inline field left almost no
 * room for results and the cards ended up behind the keyboard. The view
 * keeps the field focused at the top, shows matching results in a
 * scrollable region sized to the dynamic viewport height (so it stays
 * above the keyboard), and offers both platform ways out: a back arrow
 * (Android) and a Cancel label (iOS). Search semantics do not change.
 * Desktop keeps the inline expansion (covered by
 * lists-compact-mobile-bar.spec.ts).
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

test.describe('mobile full-screen search', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  test('opens a full-screen view with a focused field at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await seedList(page, 'Fullscreen Search View List')

    await page.goto('/lists')
    await page.getByTestId('lists-grid').waitFor()

    await page.getByTestId('mobile-filter-bar').getByRole('button', { name: 'Search lists' }).click()
    const overlay = page.getByTestId('mobile-search-overlay')
    await expect(overlay).toBeVisible()

    // The view fills the viewport: full width, and its height tracks the
    // dynamic viewport (h-dvh), which is what keeps results above the
    // on-screen keyboard.
    const box = await overlay.boundingBox()
    expect(box, 'search view should fill the viewport').not.toBeNull()
    expect(box!.width).toBe(390)
    expect(box!.height).toBeGreaterThanOrEqual(840)

    // The cursor is ready with no second tap.
    await expect(overlay.getByRole('textbox', { name: 'Search lists' })).toBeFocused()

    // Both platform ways out are present.
    await expect(overlay.getByRole('button', { name: 'Back', exact: true })).toBeVisible()
    await expect(overlay.getByRole('button', { name: 'Cancel search', exact: true })).toBeVisible()
  })

  test('Cancel restores the full list unchanged', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const tag = Date.now().toString(36)
    const matchName = `Fullscreen Cancel Match ${tag}`
    const otherName = `Fullscreen Cancel Other ${tag}`
    await seedList(page, matchName)
    await seedList(page, otherName)

    await page.goto('/lists')
    await page.getByTestId('lists-grid').waitFor()

    await page.getByTestId('mobile-filter-bar').getByRole('button', { name: 'Search lists' }).click()
    const overlay = page.getByTestId('mobile-search-overlay')
    await overlay.getByRole('textbox', { name: 'Search lists' }).fill(`cancel match ${tag}`)
    await expect(overlay.getByText(matchName)).toBeVisible()
    await expect(overlay.getByText(otherName)).toBeHidden()

    await overlay.getByRole('button', { name: 'Cancel search', exact: true }).click()
    await expect(overlay).toBeHidden()
    // Dismissing restores the list exactly as it was: both lists, no filter.
    await expect(page.getByText(matchName)).toBeVisible()
    await expect(page.getByText(otherName)).toBeVisible()
    await expect(page.getByText(/results? for/)).toBeHidden()
  })

  test('the back arrow restores the full list unchanged', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const tag = Date.now().toString(36)
    const matchName = `Fullscreen Back Match ${tag}`
    const otherName = `Fullscreen Back Other ${tag}`
    await seedList(page, matchName)
    await seedList(page, otherName)

    await page.goto('/lists')
    await page.getByTestId('lists-grid').waitFor()

    await page.getByTestId('mobile-filter-bar').getByRole('button', { name: 'Search lists' }).click()
    const overlay = page.getByTestId('mobile-search-overlay')
    await overlay.getByRole('textbox', { name: 'Search lists' }).fill(`back match ${tag}`)
    await expect(overlay.getByText(matchName)).toBeVisible()

    await overlay.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(overlay).toBeHidden()
    await expect(page.getByText(matchName)).toBeVisible()
    await expect(page.getByText(otherName)).toBeVisible()
  })

  test('results stay in the view while typing at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const tag = Date.now().toString(36)
    for (let i = 1; i <= 6; i++) {
      await seedList(page, `Fullscreen Typing ${tag} List ${i}`)
    }

    await page.goto('/lists')
    await page.getByTestId('lists-grid').waitFor()

    await page.getByTestId('mobile-filter-bar').getByRole('button', { name: 'Search lists' }).click()
    const overlay = page.getByTestId('mobile-search-overlay')
    const input = overlay.getByRole('textbox', { name: 'Search lists' })
    await input.fill(`typing ${tag} list 3`)
    await expect(overlay.getByText(`Fullscreen Typing ${tag} List 3`)).toBeVisible()

    // The result renders inside the view's scrollable region, not behind it.
    const resultsBox = await page.getByTestId('mobile-search-results').boundingBox()
    const overlayBox = await overlay.boundingBox()
    expect(resultsBox, 'results region should be inside the view').not.toBeNull()
    expect(resultsBox!.y).toBeGreaterThanOrEqual(overlayBox!.y)
    expect(resultsBox!.y + resultsBox!.height).toBeLessThanOrEqual(overlayBox!.y + overlayBox!.height + 1)
  })
})
