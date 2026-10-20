import { test, expect } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

/**
 * Hidden videos (issue #443). A teacher can hide a video they do not want
 * suggested: it disappears from the home browse section, the pattern video
 * suggestions, and search results, and can be unhidden from the profile
 * settings list.
 */
test.describe('hidden videos', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  test('hide from a browse card, then unhide from profile settings', async ({ page }) => {
    const cardTitle = 'Digraph CK - 4 Minute Phonics'

    await page.goto('/videos')
    await expect(page.getByRole('heading', { name: 'Song videos' })).toBeVisible()
    await expect(page.getByRole('button', { name: `Play ${cardTitle}` })).toBeVisible()

    // Hide it from the card.
    await page.getByRole('button', { name: `Hide ${cardTitle}` }).click()
    await expect(page.getByRole('button', { name: `Play ${cardTitle}` })).not.toBeVisible()

    // The block persists across a reload.
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Song videos' })).toBeVisible()
    await expect(page.getByRole('button', { name: `Play ${cardTitle}` })).not.toBeVisible()

    // Profile settings lists it with an Unhide action.
    await page.goto('/profile')
    await expect(page.getByRole('heading', { name: 'Hidden videos' })).toBeVisible()
    await expect(page.getByText(cardTitle)).toBeVisible()
    await page.getByRole('button', { name: `Unhide ${cardTitle}` }).click()
    await expect(page.getByText('No hidden videos.')).toBeVisible()

    // The card is back on the videos page.
    await page.goto('/videos')
    await expect(page.getByRole('button', { name: `Play ${cardTitle}` })).toBeVisible()
  })

  test('home spotlight shows three featured videos with a browse-all link (issue #439)', async ({ page }) => {
    await page.goto('/home')
    const spotlight = page.getByRole('region', { name: 'Song videos' })
    await expect(spotlight).toBeVisible()
    // Three cards, not the whole bank; no chip wall.
    await expect(spotlight.getByRole('button', { name: /^Play / })).toHaveCount(3)
    await expect(spotlight.getByLabel('Search song videos')).toBeVisible()
    const browseAll = spotlight.getByRole('link', { name: /Browse all \d+ song videos/ })
    await expect(browseAll).toHaveAttribute('href', '/videos')

    // The link reaches the full catalog.
    await browseAll.click()
    await expect(page.getByRole('heading', { name: 'Song videos' })).toBeVisible()
    await expect(page.getByText(/Showing 38 of 38 videos/)).toBeVisible()
  })

  test('hide from the pattern video suggestions and search', async ({ page }) => {
    const response = await page.request.post('/api/lists', {
      data: {
        name: 'E2E Hidden Videos',
        patterns: [{ id: 'p1', sound: 'long a', pattern: 'ai', frequency: 'common', words: ['rain'] }],
      },
    })
    expect(response.ok()).toBe(true)
    const { list } = await response.json()

    await page.goto(`/lists/${list.id as string}`)
    await page.getByRole('button', { name: 'Manage song videos for pattern ai' }).click()
    const dialog = page.getByRole('dialog', { name: 'Song videos for pattern ai' })
    await expect(dialog).toBeVisible()

    const suggestionTitle = 'When Two Vowels Go Walking | Jack Hartmann Vowel Teams Song | Vowels Song'
    const suggestions = dialog.getByRole('region', { name: 'Suggestions' })
    await expect(suggestions.getByText(suggestionTitle)).toBeVisible()

    // Hide every ai suggestion; the section collapses when all are hidden.
    const hideButton = suggestions.getByRole('button', { name: /^Hide / })
    while ((await hideButton.count()) > 0) {
      await hideButton.first().click()
    }
    await expect(dialog.getByRole('region', { name: 'Suggestions' })).not.toBeVisible()

    // Search no longer surfaces any of them either.
    await dialog.getByLabel('Search videos by title or channel').fill('vowel')
    await expect(dialog.getByText(suggestionTitle)).not.toBeVisible()
  })
})
