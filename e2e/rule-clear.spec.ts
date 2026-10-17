import { test, expect, type Page } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

/**
 * Clearing spelling rules (issue #363). The per-pattern rule editor's
 * Clear button saves immediately; a Done pressed right after must close
 * the modal once the save settles instead of being swallowed.
 */
test.describe('clearing spelling rules', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  async function clearRuleOnListPage(page: Page, listId: string, ruleText?: string) {
    await page.goto(`/lists/${listId}`)
    const row = page.getByRole('button', { name: /rule for a_e/i }).first()
    await expect(row).toBeVisible()
    if (ruleText) {
      // The classroom's rules load asynchronously; wait for the saved rule
      // before opening the editor, since the modal snapshots the saved
      // rule on open.
      await expect(row).toContainText(ruleText)
    }
    await row.scrollIntoViewIfNeeded()
    await row.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const textarea = dialog.locator('textarea')
    if (ruleText) await expect(textarea).not.toBeEmpty()
    await dialog.getByRole('button', { name: 'Clear', exact: true }).click()
    await expect(textarea).toBeEmpty()
    // Done pressed immediately after Clear: the close must be honored
    // once the save lands, not swallowed while it is in flight.
    await dialog.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByRole('button', { name: /rule for a_e/i }).first()).toContainText('Add a rule')
  }

  test('clearing a classroom rule closes the modal and stays cleared after reload', async ({ page }) => {
    const stamp = Date.now()
    const className = `E2E Rule Class ${stamp}`
    const createResponse = await page.request.post('/api/classes', { data: { name: className } })
    expect(createResponse.ok()).toBe(true)
    const classId = (await createResponse.json()).class.id as string
    const ruleText = 'When a word has a_e, the a says its name.'
    const rulesResponse = await page.request.put(`/api/classes/${classId}/rules`, {
      data: { rules: { a_e: { rule: ruleText } } },
    })
    expect(rulesResponse.ok()).toBe(true)
    const listResponse = await page.request.post('/api/lists', {
      data: {
        name: `E2E Rule List ${stamp}`,
        classId,
        patterns: [{ sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake', 'make'] }],
      },
    })
    expect(listResponse.ok()).toBe(true)
    const listId = (await listResponse.json()).list.id as string

    await clearRuleOnListPage(page, listId, ruleText)

    // Reload: the rule must still be gone (persisted, not just hidden).
    await page.reload()
    const row = page.getByRole('button', { name: /rule for a_e/i }).first()
    await expect(row).toBeVisible()
    await expect(row).toContainText('Add a rule')
  })

  test('clearing an unscoped rule closes the modal and stays cleared after reload', async ({ page }) => {
    const stamp = Date.now()
    const listResponse = await page.request.post('/api/lists', {
      data: {
        name: `E2E Rule List NoClass ${stamp}`,
        patterns: [
          {
            sound: 'long a',
            pattern: 'a_e',
            frequency: 'common',
            words: ['cake'],
            rule: 'When a word has a_e, the a says its name.',
          },
        ],
      },
    })
    expect(listResponse.ok()).toBe(true)
    const listId = (await listResponse.json()).list.id as string

    await clearRuleOnListPage(page, listId, 'When a word has a_e, the a says its name.')

    await page.reload()
    const row = page.getByRole('button', { name: /rule for a_e/i }).first()
    await expect(row).toBeVisible()
    await expect(row).toContainText('Add a rule')
  })
})
