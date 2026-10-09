import { test, expect } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

/**
 * Mobile header menu. Below the md breakpoint the header actions collapse
 * into a hamburger button that opens a bottom sheet (the same behavior
 * pattern as donray.dev's mobile header). Every header item is preserved:
 * the logo, wordmark, and account menu stay in the bar; My Spelling Lists
 * and Present move into the sheet.
 */
test.describe('mobile header menu', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  test('bar keeps logo, account menu, and hamburger; actions live in the sheet', async ({ page }) => {
    await page.goto('/')

    const header = page.locator('header')
    await expect(header.getByRole('link', { name: 'PatternSpell home' })).toBeVisible()
    await expect(header.getByRole('button', { name: /open account menu/i })).toBeVisible()
    await expect(header.getByRole('button', { name: /open menu/i })).toBeVisible()

    // The actions are hidden in the bar at this viewport.
    await expect(header.getByRole('link', { name: 'My spelling lists' })).toBeHidden()
    await expect(header.getByRole('link', { name: 'Present' })).toBeHidden()

    // Open the menu: both actions are there.
    await header.getByRole('button', { name: /open menu/i }).click()
    const menu = page.getByRole('dialog')
    await expect(menu.getByRole('link', { name: 'My spelling lists' })).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Present' })).toBeVisible()

    // Escape closes the menu.
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('My Spelling Lists in the mobile menu goes to the lists page', async ({ page }) => {
    await page.goto('/')

    await page
      .locator('header')
      .getByRole('button', { name: /open menu/i })
      .click()
    await page.getByRole('dialog').getByRole('link', { name: 'My spelling lists' }).click()

    // The mobile menu closes and the lists page opens.
    await expect(page).toHaveURL('/lists')
    await expect(page.getByRole('heading', { name: 'My spelling lists' })).toBeVisible()
  })

  test('Present in the mobile menu goes to display mode', async ({ page }) => {
    await page.goto('/')

    await page
      .locator('header')
      .getByRole('button', { name: /open menu/i })
      .click()
    await page.getByRole('dialog').getByRole('link', { name: 'Present' }).click()

    await expect(page).toHaveURL(/\/display/)
  })
})
