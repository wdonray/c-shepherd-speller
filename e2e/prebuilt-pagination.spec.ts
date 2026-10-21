import { test, expect } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

/**
 * Regression tests for the prebuilt library pagination and the lighter
 * video thumbnails (issue #481). The prebuilt section used to render all 30
 * grade weeks at once; it now paginates at 12 per page.
 */
test.describe('prebuilt library pagination (issue #481)', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  test('paginates grade weeks at 12 per page', async ({ page }) => {
    await page.goto('/lists')
    await expect(page.getByRole('heading', { name: 'Ready-made library' })).toBeVisible()

    const grid = page.getByTestId('prebuilt-grid')
    await expect(page.getByText('Showing 1-12 of 30 weeks of Grade 1 spelling patterns.')).toBeVisible()
    await expect(grid.getByRole('link', { name: 'Preview: Grade 1 - Week 1', exact: true })).toBeVisible()
    await expect(grid.getByRole('link', { name: 'Preview: Grade 1 - Week 13' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Next page' }).click()
    await expect(page.getByText('Showing 13-24 of 30 weeks of Grade 1 spelling patterns.')).toBeVisible()
    await expect(grid.getByRole('link', { name: 'Preview: Grade 1 - Week 13' })).toBeVisible()
    await expect(grid.getByRole('link', { name: 'Preview: Grade 1 - Week 1', exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: 'Go to page 3' }).click()
    await expect(page.getByText('Showing 25-30 of 30 weeks of Grade 1 spelling patterns.')).toBeVisible()
    await expect(grid.getByRole('link', { name: /Preview:/ })).toHaveCount(6)
    await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled()

    await page.getByRole('button', { name: 'Previous page' }).click()
    await expect(page.getByText('Showing 13-24 of 30 weeks of Grade 1 spelling patterns.')).toBeVisible()
  })

  test('resets to page 1 when the grade changes', async ({ page }) => {
    await page.goto('/lists')
    await expect(page.getByRole('heading', { name: 'Ready-made library' })).toBeVisible()

    await page.getByRole('button', { name: 'Go to page 2' }).click()
    await expect(page.getByText('Showing 13-24 of 30 weeks of Grade 1 spelling patterns.')).toBeVisible()

    await page.getByRole('tab', { name: 'K' }).click()
    await expect(page.getByText('Showing 1-12 of 12 weeks of Kindergarten spelling patterns.')).toBeVisible()
    // A single page needs no pager.
    await expect(page.getByRole('navigation', { name: 'Ready-made library pages' })).toHaveCount(0)
  })

  test('resets to page 1 when the search changes', async ({ page }) => {
    await page.goto('/lists')
    await expect(page.getByRole('heading', { name: 'Ready-made library' })).toBeVisible()

    await page.getByRole('button', { name: 'Go to page 2' }).click()
    await expect(page.getByText('Showing 13-24 of 30 weeks of Grade 1 spelling patterns.')).toBeVisible()

    await page.getByLabel('Search ready-made lists by pattern').fill('tion')
    await expect(page.getByText(/Showing 1-8 of 8 weeks matching "tion" across all grades/)).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Ready-made library pages' })).toHaveCount(0)
  })

  test('switches between the standard and UFLI sequences (issue #506)', async ({ page }) => {
    await page.goto('/lists')
    await expect(page.getByRole('heading', { name: 'Ready-made library' })).toBeVisible()

    await page.getByRole('tab', { name: 'UFLI sequence' }).click()
    await expect(page.getByText('Showing 1-12 of 30 weeks of Grade 1 spelling patterns.')).toBeVisible()
    const grid = page.getByTestId('prebuilt-grid')
    await expect(grid.getByRole('link', { name: 'Preview: UFLI Grade 1 - Week 1', exact: true })).toBeVisible()
    // UFLI Foundations is K-2 plus advanced Grade 3: no grades 4 or 5.
    const gradeTabs = page.getByRole('tablist', { name: 'Filter ready-made lists by grade' })
    await expect(gradeTabs.getByRole('tab', { name: '4' })).toHaveCount(0)
    await expect(gradeTabs.getByRole('tab', { name: '5' })).toHaveCount(0)
    // The non-endorsement disclaimer shows for the UFLI set.
    await expect(page.getByText(/Not created by, affiliated with, or endorsed by/)).toBeVisible()

    await page.getByRole('tab', { name: 'Standard sequence' }).click()
    await expect(grid.getByRole('link', { name: 'Preview: Grade 1 - Week 1', exact: true })).toBeVisible()
    await expect(gradeTabs.getByRole('tab', { name: '5' })).toBeVisible()
  })
})

test.describe('video thumbnails (issue #481)', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  test('/videos thumbnails load the lighter mqdefault size', async ({ page }) => {
    await page.goto('/videos')
    await expect(page.getByRole('heading', { name: 'Song videos' })).toBeVisible()
    const thumbnail = page.locator('img[src*="i.ytimg.com"]').first()
    await expect(thumbnail).toBeVisible()
    const src = await thumbnail.getAttribute('src')
    expect(src).toContain('mqdefault.jpg')
  })
})
