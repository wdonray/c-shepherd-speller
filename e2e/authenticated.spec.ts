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

  test('list manager CRUD: add and remove a word', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /my spelling lists/i }).click()

    // Add a word.
    await page.getByPlaceholder('Add a new word to your list').fill('cat')
    await page.getByPlaceholder('Add a new word to your list').press('Enter')
    await expect(page.getByText('cat')).toBeVisible()

    // Add a sound.
    await page.getByPlaceholder('Add a new sound pattern').fill('sh')
    await page.getByPlaceholder('Add a new sound pattern').press('Enter')
    await expect(page.getByText('sh')).toBeVisible()

    // Remove the word. The Remove button appears on hover.
    const wordText = page.getByText('cat').first()
    await wordText.hover()
    await page
      .getByRole('button', { name: /remove/i })
      .first()
      .click({ force: true })
    await expect(page.getByText('cat')).not.toBeVisible()
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

  test('export downloads a JSON file', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /my spelling lists/i }).click()

    // Seed one word so the export has content.
    await page.getByPlaceholder('Add a new word to your list').fill('dog')
    await page.getByPlaceholder('Add a new word to your list').press('Enter')
    await expect(page.getByText('dog')).toBeVisible()

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /export/i }).click()
    await page.getByRole('button', { name: /save file/i }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.json$/)
  })
})
