import { test, expect, type Page } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

/**
 * Classroom deletion (issue #309). Each test gets a real next-auth session
 * (minted JWT, see helpers/auth.ts) and a fresh E2E user record in
 * DynamoDB Local.
 *
 * Donray's decision (2026-10-15): a classroom with saved rules, assigned
 * lists, or students cannot be deleted. Only an empty, unassigned classroom
 * can be deleted, after confirmation.
 */
test.describe('classroom deletion', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  async function gotoClassrooms(page: Page) {
    await page.goto('/profile')
    await expect(page.getByRole('heading', { name: 'Classrooms' })).toBeVisible()
  }

  test('deletes an empty classroom after confirmation', async ({ page }) => {
    await gotoClassrooms(page)

    // Create a classroom to delete.
    const className = `E2E Delete Me ${Date.now()}`
    await page.getByLabel('New classroom').fill(className)
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    const row = page.locator('li', { hasText: className })
    await expect(row).toBeVisible()

    // A fresh classroom is empty, so its Delete button is enabled.
    await expect(row.getByRole('button', { name: 'Delete' })).toBeEnabled()

    // Confirm the deletion in the dialog.
    await row.getByRole('button', { name: 'Delete' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Delete this classroom?')).toBeVisible()
    await expect(dialog.getByText(`Delete "${className}"? The classroom is empty.`)).toBeVisible()
    await dialog.getByRole('button', { name: 'Delete' }).click()

    // The dialog closes and the classroom row is removed once the delete lands.
    await expect(row).not.toBeVisible()
  })

  test('disables Delete and explains what is attached for a classroom with saved rules', async ({ page }) => {
    // Seed a classroom with one saved rule through the API.
    const className = `E2E Ruled Class ${Date.now()}`
    const createResponse = await page.request.post('/api/classes', { data: { name: className } })
    expect(createResponse.ok()).toBe(true)
    const { class: created } = await createResponse.json()
    const rulesResponse = await page.request.put(`/api/classes/${created.id as string}/rules`, {
      data: { rules: { a_e: { rule: 'When a word has a_e, the a says its name.' } } },
    })
    expect(rulesResponse.ok()).toBe(true)

    await gotoClassrooms(page)
    const row = page.locator('li', { hasText: className })
    await expect(row).toBeVisible()

    await expect(row.getByRole('button', { name: 'Delete' })).toBeDisabled()
    await expect(row.getByText('Cannot delete: 1 saved rule.')).toBeVisible()
  })
})
