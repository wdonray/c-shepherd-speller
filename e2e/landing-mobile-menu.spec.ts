import { test, expect } from '@playwright/test'

/**
 * Landing page header on mobile. Below the md breakpoint only the brand
 * stays visible in the bar; everything else moves into a hamburger that
 * opens a bottom sheet, matching the app's existing mobile menu pattern.
 * No auth is needed: the landing page is public.
 */
test.describe('landing page mobile menu', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('bar shows only the brand and hamburger; the nav actions move into the sheet', async ({ page }) => {
    await page.goto('/')

    const header = page.locator('header')
    await expect(header.getByRole('link', { name: 'PatternSpell home' })).toBeVisible()
    await expect(header.getByRole('button', { name: /open menu/i })).toBeVisible()

    // The desktop nav actions are hidden in the bar at this viewport.
    await expect(header.getByRole('link', { name: /how it works/i })).toBeHidden()
    await expect(header.getByRole('link', { name: /who it is for/i })).toBeHidden()
    await expect(header.getByRole('link', { name: /^log in$/i })).toBeHidden()
    await expect(header.getByRole('link', { name: /get started free/i })).toBeHidden()

    // The hamburger opens a bottom sheet with every nav action.
    await header.getByRole('button', { name: /open menu/i }).click()
    const menu = page.getByRole('dialog')
    await expect(menu.getByRole('link', { name: /how it works/i })).toBeVisible()
    await expect(menu.getByRole('link', { name: /who it is for/i })).toBeVisible()
    await expect(menu.getByRole('link', { name: /^log in$/i })).toBeVisible()
    await expect(menu.getByRole('link', { name: /get started free/i })).toBeVisible()

    // Escape closes the sheet.
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
