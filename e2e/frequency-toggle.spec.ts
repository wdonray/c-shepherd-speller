import { test, expect, type Page } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

/**
 * Per-pattern frequency toggle (issue #510). The frequency row (the power
 * bar + Common/Rare label under the sound) is hidden by default on the
 * present chart. Each pattern column carries its own eye toggle in the
 * header; the choice persists with the list. Toggling must not shift the
 * column layout: the hidden row keeps its space.
 */
async function seedPatternList(page: Page): Promise<string> {
  const response = await page.request.post('/api/lists', {
    data: {
      name: 'E2E Frequency Toggle',
      patterns: [
        { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake', 'bake'] },
        { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'less-common', words: ['rain'] },
      ],
    },
  })
  expect(response.ok()).toBe(true)
  const { list } = await response.json()
  return list.id as string
}

test.describe('frequency toggle', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  test('hides the frequency row by default on fresh load', async ({ page }) => {
    const id = await seedPatternList(page)
    await page.goto(`/display?list=${id}`)

    const column = page.getByRole('region', { name: 'Pattern a_e' })
    await expect(column).toBeVisible()
    // Off by default: the power bar and label are not exposed.
    await expect(column.getByRole('img', { name: 'Frequency: Common' })).toHaveCount(0)
    // But the row keeps its space so toggling never shifts the layout.
    await expect(column.getByTestId('frequency-row')).toBeHidden()
    // The toggle itself is always visible.
    await expect(column.getByRole('button', { name: 'Show frequency for pattern a_e' })).toBeVisible()
  })

  test('toggle shows and hides the frequency row without shifting the layout', async ({ page }) => {
    const id = await seedPatternList(page)
    await page.goto(`/display?list=${id}`)

    const column = page.getByRole('region', { name: 'Pattern a_e' })
    await expect(column).toBeVisible()
    const wordsList = column.locator('ul').first()
    const before = await wordsList.boundingBox()

    await column.getByRole('button', { name: 'Show frequency for pattern a_e' }).click()
    await expect(column.getByRole('img', { name: 'Frequency: Common' })).toBeVisible()
    await expect(column.getByText('Common', { exact: true })).toBeVisible()
    await expect(column.getByRole('button', { name: 'Hide frequency for pattern a_e' })).toBeVisible()

    // Toggling the row on must not move the content below it.
    const afterShow = await wordsList.boundingBox()
    expect(before).not.toBeNull()
    expect(afterShow).not.toBeNull()
    expect(Math.abs((before?.y ?? 0) - (afterShow?.y ?? 0))).toBeLessThan(1)

    await column.getByRole('button', { name: 'Hide frequency for pattern a_e' }).click()
    await expect(column.getByRole('img', { name: 'Frequency: Common' })).toHaveCount(0)
    const afterHide = await wordsList.boundingBox()
    expect(Math.abs((before?.y ?? 0) - (afterHide?.y ?? 0))).toBeLessThan(1)
  })

  test('the toggle is per pattern: other patterns stay hidden', async ({ page }) => {
    const id = await seedPatternList(page)
    await page.goto(`/display?list=${id}`)

    const aE = page.getByRole('region', { name: 'Pattern a_e' })
    const ai = page.getByRole('region', { name: 'Pattern ai' })
    await expect(aE).toBeVisible()

    await aE.getByRole('button', { name: 'Show frequency for pattern a_e' }).click()
    await expect(aE.getByRole('img', { name: 'Frequency: Common' })).toBeVisible()
    await expect(ai.getByRole('img', { name: 'Frequency: Less common' })).toHaveCount(0)
  })

  test('the choice persists across reload', async ({ page }) => {
    const id = await seedPatternList(page)
    await page.goto(`/display?list=${id}`)

    const column = page.getByRole('region', { name: 'Pattern a_e' })
    await expect(column).toBeVisible()
    // Arm the save listener before clicking: the PUT fires immediately on
    // the optimistic update, so listening after the click can miss it.
    const saveResponse = page.waitForResponse(
      (r) => r.url().includes('/api/lists/') && r.request().method() === 'PUT',
      { timeout: 15000 }
    )
    await column.getByRole('button', { name: 'Show frequency for pattern a_e' }).click()
    await expect(column.getByRole('img', { name: 'Frequency: Common' })).toBeVisible()
    // Wait for the save to land before reloading, or the reload can win the race.
    await saveResponse

    await page.reload()
    const reloaded = page.getByRole('region', { name: 'Pattern a_e' })
    await expect(reloaded).toBeVisible()
    await expect(reloaded.getByRole('img', { name: 'Frequency: Common' })).toBeVisible()
    await expect(reloaded.getByRole('button', { name: 'Hide frequency for pattern a_e' })).toBeVisible()
    // The other pattern is still off after the reload.
    const ai = page.getByRole('region', { name: 'Pattern ai' })
    await expect(ai.getByRole('img', { name: 'Frequency: Less common' })).toHaveCount(0)
  })
})

test.describe('frequency toggle on mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  test('the 390px chart hides the row by default and the toggle fits its 44px target', async ({ page }) => {
    const id = await seedPatternList(page)
    await page.goto(`/display?list=${id}`)

    const column = page.getByRole('region', { name: 'Pattern a_e' })
    await expect(column).toBeVisible()
    await expect(column.getByRole('img', { name: 'Frequency: Common' })).toHaveCount(0)

    const toggle = column.getByRole('button', { name: 'Show frequency for pattern a_e' })
    await expect(toggle).toBeVisible()
    const box = await toggle.boundingBox()
    expect(box).not.toBeNull()
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44)
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)

    await toggle.click()
    await expect(column.getByRole('img', { name: 'Frequency: Common' })).toBeVisible()
  })
})
