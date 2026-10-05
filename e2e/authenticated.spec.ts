import { test, expect } from '@playwright/test'
import { writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

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

  test('list manager: edits an item inline', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /my spelling lists/i }).click()

    await page.getByPlaceholder('Add a new word to your list').fill('cat')
    await page.getByPlaceholder('Add a new word to your list').press('Enter')
    await expect(page.getByText('cat')).toBeVisible()

    await page.getByRole('button', { name: 'Edit "cat"' }).click()
    await page.getByLabel('Edit words 1').fill('bat')
    await page.getByRole('button', { name: 'Save "cat"' }).click()

    await expect(page.getByText('bat')).toBeVisible()
    await expect(page.getByText('cat')).not.toBeVisible()
  })

  test('list manager: blocks duplicate adds with an inline error', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /my spelling lists/i }).click()

    const input = page.getByPlaceholder('Add a new word to your list')
    await input.fill('cat')
    await input.press('Enter')
    await expect(page.getByText('cat')).toBeVisible()

    await input.fill('CAT')
    await input.press('Enter')
    await expect(page.getByRole('alert')).toContainText('already in your words list')
    // Still exactly one item row for "cat".
    await expect(page.getByText('cat', { exact: true })).toHaveCount(1)
  })

  test('list manager: malformed import shows an inline error, not a native dialog', async ({ page }) => {
    const badFile = join(tmpdir(), 'shepherd-speller-bad-import.json')
    writeFileSync(badFile, '{ this is not json')

    const dialogs: string[] = []
    page.on('dialog', (d) => dialogs.push(d.type()))

    await page.goto('/')
    await page.getByRole('button', { name: /my spelling lists/i }).click()

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: /import/i }).click(),
    ])
    await fileChooser.setFiles(badFile)

    await expect(page.getByRole('alert')).toContainText('Could not import that file')
    expect(dialogs).toEqual([])
  })
})
