import { test, expect } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

/**
 * Mobile header menu. Below the md breakpoint the header collapses to ONE
 * menu entry point: the hamburger button opens a bottom sheet with an
 * account header, a Navigate group, an Account group, and the footer
 * actions (Version, Analytics, Sign out). The avatar account menu trigger
 * is desktop-only (hidden below md), so there is never a second menu-like
 * control beside the hamburger.
 */
test.describe('mobile header menu', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  test('bar has a single menu entry point; the avatar trigger is hidden', async ({ page }) => {
    await page.goto('/')

    const header = page.locator('header')
    await expect(header.getByRole('link', { name: 'PatternSpell home' })).toBeVisible()
    await expect(header.getByRole('button', { name: /open menu/i })).toBeVisible()
    // The avatar account menu trigger is desktop-only.
    await expect(header.getByRole('button', { name: /open account menu/i })).toBeHidden()

    // The inline nav actions are hidden in the bar at this viewport.
    await expect(header.getByRole('link', { name: 'My spelling lists' })).toBeHidden()
    await expect(header.getByRole('link', { name: 'Present' })).toBeHidden()
  })

  test('the sheet groups navigation and account actions under an account header', async ({ page }) => {
    await page.goto('/')

    await page
      .locator('header')
      .getByRole('button', { name: /open menu/i })
      .click()
    const menu = page.getByRole('dialog')

    // Account header.
    await expect(menu.getByRole('button', { name: 'Change profile photo' })).toBeVisible()
    await expect(menu.getByText('E2E Teacher')).toBeVisible()
    await expect(menu.getByText('e2e@example.com')).toBeVisible()

    // Grouped actions.
    await expect(menu.getByText('Navigate')).toBeVisible()
    await expect(menu.getByRole('link', { name: 'My spelling lists' })).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Present' })).toBeVisible()
    await expect(menu.getByText('Account')).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Profile' })).toBeVisible()
    await expect(menu.getByRole('button', { name: /import \/ export/i })).toBeVisible()
    await expect(menu.getByRole('button', { name: /theme:/i })).toBeVisible()
    await expect(menu.getByRole('button', { name: /get help/i })).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Version' })).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Analytics' })).toBeVisible()
    await expect(menu.getByRole('button', { name: /sign out/i })).toBeVisible()

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
