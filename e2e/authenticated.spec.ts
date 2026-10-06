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

  test('home welcomes the signed-in teacher', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: new RegExp(`welcome, ${E2E_USER_NAME}`, 'i') })).toBeVisible()
    await expect(page.getByText('Shepherd Speller')).toBeVisible()
  })

  test('list manager: creates a new pattern-based list', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /my spelling lists/i }).click()

    // Create a new list.
    await page.getByRole('button', { name: 'New list' }).click()
    await page.getByLabel('List name').fill('E2E Week 1')
    await page.getByRole('button', { name: 'Create list' }).click()

    // The editor opens. Add a pattern.
    await expect(page.getByText('Spelling patterns (0)')).toBeVisible()
    await page.getByRole('button', { name: 'Add pattern' }).click()
    await expect(page.getByText('Spelling patterns (1)')).toBeVisible()

    // Fill in the pattern.
    await page.getByLabel('Sound').fill('long a')
    await page.getByPlaceholder('e.g. a_e').fill('a_e')

    // Add a word.
    await page.getByLabel('New word').fill('cake')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('cake')).toBeVisible()

    // Save and return to the overview.
    await page.getByRole('button', { name: 'Save list' }).click()
    await page.getByRole('button', { name: 'All lists' }).click()
    await expect(page.getByText('E2E Week 1').first()).toBeVisible()
  })

  test('profile dialog opens and saves', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: /menu/i }).click()
    await page.getByText('Profile').click()

    await expect(page.getByText('Teacher Profile')).toBeVisible()
    const nameInput = page.getByLabel(/full name/i)
    await expect(nameInput).toHaveValue(E2E_USER_NAME)

    await nameInput.fill('E2E Teacher Updated')
    await page.getByRole('button', { name: /save profile/i }).click()
    await expect(page.getByText('Profile updated successfully!')).toBeVisible()
  })
})
