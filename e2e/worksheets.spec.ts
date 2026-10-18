import { test, expect } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

/**
 * Worksheet picker to print flow (issue #402). Seeds a list with sentences
 * for every word via the API, so the print page has no sentence gaps and
 * proceeds straight to the print job.
 */
test.describe('printable worksheets', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  async function seedList(request: import('@playwright/test').APIRequestContext): Promise<string> {
    const response = await request.post('/api/lists', {
      data: {
        name: 'E2E Worksheets Week',
        patterns: [
          {
            sound: 'long a',
            pattern: 'a_e',
            frequency: 'common',
            words: ['cake', 'bake', 'late'],
            sentences: {
              cake: 'We baked a cake for the party.',
              bake: 'I like to bake bread on Sundays.',
              late: 'The bus was late this morning.',
            },
          },
          {
            sound: 'long a',
            pattern: 'ai',
            frequency: 'common',
            words: ['rain', 'train', 'paint'],
            sentences: {
              rain: 'The rain fell all afternoon.',
              train: 'We rode the train to the city.',
              paint: 'She will paint the fence blue.',
            },
          },
        ],
      },
    })
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    return body.list.id as string
  }

  test('picker selects types and the print page renders sheets with answer keys', async ({ page }) => {
    const listId = await seedList(page.request)

    // Never open a real print dialog in the test browser.
    await page.addInitScript(() => {
      window.print = () => {}
    })

    await page.goto(`/lists/${listId}/worksheets`)
    await expect(page.getByRole('heading', { name: 'Printable worksheets' })).toBeVisible()

    // All seven types are selected by default.
    const checkboxes = page.getByRole('checkbox')
    expect(await checkboxes.count()).toBe(7)
    for (const box of await checkboxes.all()) {
      await expect(box).toBeChecked()
    }

    // Deselect one type; it must not appear in the print job.
    await page.getByRole('checkbox', { name: /word search/i }).uncheck()
    await page.getByRole('button', { name: /preview and print/i }).click()
    await expect(page).toHaveURL(new RegExp(`/lists/${listId}/worksheets/print`))
    expect(page.url()).not.toContain('word-search')

    // The print job renders the remaining worksheets and their answer keys.
    await expect(page.getByRole('heading', { name: 'Spelling list' }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Cut and sort' }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Fill in the blank' }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Crossword' }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Reading practice' }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'A note for families' }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Answer key' })).toBeVisible()
    // The deselected type is absent from both the worksheets and the key.
    await expect(page.getByRole('heading', { name: 'Word search', exact: true })).toHaveCount(0)
  })

  test('print page shows the sentence gap flow when a word has no sentence', async ({ page }) => {
    const response = await page.request.post('/api/lists', {
      data: {
        name: 'E2E Gap Week',
        patterns: [
          {
            sound: 'long a',
            pattern: 'a_e',
            frequency: 'common',
            words: ['cake', 'zqxwv'],
            sentences: { cake: 'We baked a cake for the party.' },
          },
        ],
      },
    })
    expect(response.ok()).toBeTruthy()
    const listId = (await response.json()).list.id as string

    await page.addInitScript(() => {
      window.print = () => {}
    })
    await page.goto(`/lists/${listId}/worksheets/print?types=reading`)

    // The gap panel names the word missing a sentence instead of printing.
    await expect(page.getByRole('heading', { name: /sentences needed/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /zqxwv/ })).toBeVisible()
    // Removing the word from the worksheet clears the gap.
    await page.getByRole('button', { name: /remove zqxwv from worksheet/i }).click()
    await expect(page.getByRole('heading', { name: 'Reading practice' }).first()).toBeVisible()
  })
})
