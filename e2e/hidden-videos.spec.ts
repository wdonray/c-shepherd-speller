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

    await page.goto('/home')
    const browse = page.getByRole('region', { name: 'Song videos' })
    await expect(browse).toBeVisible()
    await expect(browse.getByRole('button', { name: `Play ${cardTitle}` })).toBeVisible()

    // Hide it from the card.
    await browse.getByRole('button', { name: `Hide ${cardTitle}` }).click()
    await expect(browse.getByRole('button', { name: `Play ${cardTitle}` })).not.toBeVisible()

    // The block persists across a reload.
    await page.reload()
    const browseAfterReload = page.getByRole('region', { name: 'Song videos' })
    await expect(browseAfterReload).toBeVisible()
    await expect(browseAfterReload.getByRole('button', { name: `Play ${cardTitle}` })).not.toBeVisible()

    // Profile settings lists it with an Unhide action.
    await page.goto('/profile')
    await expect(page.getByRole('heading', { name: 'Hidden videos' })).toBeVisible()
    await expect(page.getByText(cardTitle)).toBeVisible()
    await page.getByRole('button', { name: `Unhide ${cardTitle}` }).click()
    await expect(page.getByText('No hidden videos.')).toBeVisible()

    // The card is back on the home page.
    await page.goto('/home')
    const browseAgain = page.getByRole('region', { name: 'Song videos' })
    await expect(browseAgain.getByRole('button', { name: `Play ${cardTitle}` })).toBeVisible()
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

    // Hiding the only ai suggestion removes the whole section.
    await suggestions.getByRole('button', { name: `Hide ${suggestionTitle}` }).click()
    await expect(dialog.getByRole('region', { name: 'Suggestions' })).not.toBeVisible()

    // Search no longer surfaces it either.
    await dialog.getByLabel('Search videos by title or channel').fill('vowel')
    await expect(dialog.getByText(suggestionTitle)).not.toBeVisible()
  })
})
