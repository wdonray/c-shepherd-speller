import { test, expect } from '@playwright/test'

import { ensureE2EUser, sessionCookie, E2E_USER_NAME } from './helpers/auth'

/**
 * Authenticated flows. Each test gets a real next-auth session (minted JWT,
 * see helpers/auth.ts) and a fresh E2E user record in DynamoDB Local.
 */
test.describe('authenticated flows', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  test('home shows the teacher dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/my word lists/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'New list' })).toBeVisible()
    // The dashboard has Practice and Present links (Header also has them, so use first)
    await expect(page.getByRole('link', { name: /practice/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /present/i }).first()).toBeVisible()
  })

  test('list manager: creates a new pattern-based list', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /my spelling lists/i }).click()

    // Create a new list. The full-page editor opens on save.
    await page.getByRole('button', { name: 'New list' }).first().click()
    await page.getByLabel('List name').fill('E2E Week 1')
    await page.getByRole('button', { name: 'Create list' }).click()
    await expect(page).toHaveURL(/\/lists\//)

    // The editor opens. Add a pattern.
    await expect(page.getByText('Spelling patterns (0)')).toBeVisible()
    await page.getByRole('button', { name: 'Add a pattern', exact: true }).click()
    await expect(page.getByText('Spelling patterns (1)')).toBeVisible()

    // Fill in the pattern via the spelling select.
    await page.getByLabel('Target sound').fill('long a')
    await page.getByLabel('Pattern spelling').selectOption('a_e')

    // Add a word.
    await page.getByLabel('New word').fill('cake')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('cake')).toBeVisible()

    // Edits auto-save; wait for the confirmation, then go back.
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 15000 })
    await page.getByRole('link', { name: 'My lists' }).click()
    await expect(page.getByText('E2E Week 1').first()).toBeVisible()
  })

  test('profile dialog opens and saves', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: /menu/i }).click()
    await page.getByText('Profile').click()

    await expect(page.getByText('Signed in with Google')).toBeVisible()
    await expect(page.getByRole('heading', { name: E2E_USER_NAME })).toBeVisible()
    const nameInput = page.getByLabel(/full name/i)
    await expect(nameInput).toHaveValue(E2E_USER_NAME)

    await nameInput.fill('E2E Teacher Updated')
    // The profile auto-saves after a short debounce.
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 10000 })
  })
})
