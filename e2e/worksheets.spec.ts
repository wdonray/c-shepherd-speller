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

    // Never open a real print dialog in the test browser; count calls instead.
    await page.addInitScript(() => {
      ;(window as unknown as { __printCalls: number }).__printCalls = 0
      window.print = () => {
        ;(window as unknown as { __printCalls: number }).__printCalls += 1
      }
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

    // The pre-print options panel (issue #512): presets plus the answer-key
    // toggle, with the dialog opening only from the Print button.
    await expect(page.getByRole('region', { name: 'Print options' })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Standard/ })).toBeChecked()
    await expect(page.getByRole('radio', { name: /Large print/ })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Dyslexia-friendly/ })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: /Include answer key/ })).toBeChecked()

    // The print job renders the remaining worksheets and their answer keys.
    await expect(page.getByRole('heading', { name: 'Spelling list' }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Cut and sort' }).first()).toBeVisible()

    // Cut-and-sort (issue #520): one fixed-size paste box per word under
    // labeled columns at the top, the cut-out bank at the bottom, no gray
    // write-in lines anywhere on the sheet.
    const cutSections = page.locator('section[aria-label="Cut and sort"]')
    const studentCut = cutSections.first()
    await expect(studentCut.getByLabel(/Paste box \d+ under/)).toHaveCount(6)
    await expect(studentCut.locator('[class*="border-neutral"]')).toHaveCount(0)
    const columnsBox = await studentCut.getByLabel('Sort the words').boundingBox()
    const bankBox = await studentCut.getByLabel('Word cards to cut out').boundingBox()
    expect(bankBox!.y).toBeGreaterThan(columnsBox!.y + columnsBox!.height)
    // The answer key mirrors the student page: one filled box per word, no bank.
    const keyCut = cutSections.nth(1)
    await expect(keyCut.locator('ol li')).toHaveCount(6)
    await expect(keyCut.getByLabel('Word cards to cut out')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Fill in the blank' }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Crossword' }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Reading practice' }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'A note for families' }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Answer key' })).toBeVisible()
    // The deselected type is absent from both the worksheets and the key.
    await expect(page.getByRole('heading', { name: 'Word search', exact: true })).toHaveCount(0)

    // Switching presets updates the preview in place; the answer-key toggle
    // drops the key without touching the student sheets.
    await page.getByRole('radio', { name: /Large print/ }).check()
    await expect(page.locator('.print-sheets')).toHaveAttribute('data-preset', 'large-print')
    await page.getByRole('checkbox', { name: /Include answer key/ }).uncheck()
    await expect(page.getByRole('heading', { name: 'Answer key' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Spelling list' })).toHaveCount(1)

    // The dialog opens only from the Print button.
    await page.getByRole('button', { name: 'Print worksheets' }).click()
    expect(await page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls)).toBe(1)
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

/**
 * Two-state accept/approve button (issue #511). Once every gap word has a
 * sentence waiting, "Accept all suggestions" flips to the primary green
 * "Approve all", which saves everything and advances to the print step.
 * Clearing a sentence flips it back. Desktop and 390px.
 */
test.describe('approve-all button', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  async function seedGapList(page: import('@playwright/test').Page, words: string[]): Promise<string> {
    const response = await page.request.post('/api/lists', {
      data: {
        name: 'E2E Approve All',
        patterns: [{ sound: 'long a', pattern: 'a_e', frequency: 'common', words }],
      },
    })
    expect(response.ok()).toBeTruthy()
    return (await response.json()).list.id as string
  }

  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    test(`accept flips to Approve all and advances to print at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport)
      const listId = await seedGapList(page, ['cake', 'bake'])
      await page.addInitScript(() => {
        window.print = () => {}
      })
      await page.goto(`/lists/${listId}/worksheets/print?types=reading`)
      await expect(page.getByRole('heading', { name: /sentences needed/i })).toBeVisible()

      const acceptAll = page.getByRole('button', { name: 'Accept all suggestions' })
      await expect(acceptAll).toBeEnabled()
      const before = await acceptAll.boundingBox()

      await acceptAll.click()
      const approveAll = page.getByRole('button', { name: 'Approve all' })
      await expect(approveAll).toBeVisible()
      // Primary green idiom, matching the per-word "Use this sentence" button.
      await expect(approveAll).toHaveClass(/bg-chunk-leaf/)
      // The flip reserves the button's geometry: no layout shift.
      const after = await approveAll.boundingBox()
      expect(after?.width).toBe(before?.width)
      expect(after?.height).toBe(before?.height)

      await approveAll.click()
      await expect(page.getByRole('heading', { name: 'Reading practice' }).first()).toBeVisible()
    })
  }

  test('a word with no suggestion holds the accept state until the teacher types', async ({ page }) => {
    const listId = await seedGapList(page, ['cake', 'zqxwv'])
    await page.goto(`/lists/${listId}/worksheets/print?types=reading`)
    await expect(page.getByRole('heading', { name: /sentences needed/i })).toBeVisible()

    const acceptAll = page.getByRole('button', { name: 'Accept all suggestions' })
    await expect(acceptAll).toBeEnabled()
    await acceptAll.click()

    // cake filled, zqxwv has nothing to accept: still the accept state.
    await expect(page.getByRole('button', { name: 'Accept all suggestions' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Approve all' })).toHaveCount(0)

    const boxes = page.getByLabel(/Or write your own sentence/)
    await expect(boxes).toHaveCount(2)
    await boxes.nth(1).fill('Zqxwv is a made-up word.')

    await expect(page.getByRole('button', { name: 'Approve all' })).toBeVisible()
  })

  test('clearing a filled sentence flips the button back to accept', async ({ page }) => {
    const listId = await seedGapList(page, ['cake', 'bake'])
    await page.goto(`/lists/${listId}/worksheets/print?types=reading`)
    await expect(page.getByRole('heading', { name: /sentences needed/i })).toBeVisible()

    const acceptAll = page.getByRole('button', { name: 'Accept all suggestions' })
    await expect(acceptAll).toBeEnabled()
    await acceptAll.click()
    await expect(page.getByRole('button', { name: 'Approve all' })).toBeVisible()

    const boxes = page.getByLabel(/Or write your own sentence/)
    await boxes.first().fill('')

    await expect(page.getByRole('button', { name: 'Accept all suggestions' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Approve all' })).toHaveCount(0)
  })
})

/**
 * Uniform blank widths (issue #517). Every blank on the fill-in-the-blank
 * and reading sheets is one fixed width, so blank length can never cue
 * the answer.
 */
test.describe('uniform blank widths', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  async function seedBlankList(page: import('@playwright/test').Page): Promise<string> {
    const response = await page.request.post('/api/lists', {
      data: {
        name: 'E2E Uniform Blanks',
        patterns: [
          {
            sound: 'long a',
            pattern: 'a_e',
            frequency: 'common',
            // Short and long words on purpose: widths must not differ.
            words: ['late', 'bake'],
            sentences: {
              late: 'The bus was late this morning.',
              bake: 'I like to bake bread on Sundays.',
            },
          },
          {
            sound: 'long a',
            pattern: 'ai',
            frequency: 'common',
            words: ['rain', 'train'],
            sentences: {
              rain: 'The rain fell all afternoon.',
              train: 'We rode the train to the city.',
            },
          },
        ],
      },
    })
    expect(response.ok()).toBeTruthy()
    return (await response.json()).list.id as string
  }

  async function blankWidths(page: import('@playwright/test').Page, sectionName: string): Promise<number[]> {
    const section = page.locator('section', { has: page.getByRole('heading', { name: sectionName }) })
    const blanks = section.locator('.worksheet-blank')
    await expect(blanks.first()).toBeVisible()
    const boxes = await blanks.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width))
    expect(boxes.length).toBeGreaterThan(1)
    return boxes
  }

  test('fill-in-the-blank and reading blanks render identical widths for short and long words', async ({ page }) => {
    const listId = await seedBlankList(page)
    await page.goto(`/lists/${listId}/worksheets/print?types=fill-blank,reading`)
    await expect(page.getByRole('heading', { name: 'Fill in the blank' }).first()).toBeVisible()

    const fillWidths = await blankWidths(page, 'Fill in the blank')
    const readingWidths = await blankWidths(page, 'Reading practice')

    // Every blank on a sheet is the same width even though the answers
    // have different lengths, and both sheets share the one width.
    const allWidths = [...fillWidths, ...readingWidths]
    const first = allWidths[0]
    for (const width of allWidths) {
      expect(width).toBeCloseTo(first, 0)
    }
    expect(first).toBeGreaterThan(0)
  })
})

/**
 * Name/Date write-in line alignment (issue #533). The rule must sit at the
 * label's text baseline, where handwriting rests, not vertically centered
 * against the label. Desktop and 390px.
 */
test.describe('name-date baseline alignment', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  async function seedBaselineList(request: import('@playwright/test').APIRequestContext): Promise<string> {
    const response = await request.post('/api/lists', {
      data: {
        name: 'E2E NameDate Baseline',
        patterns: [
          {
            sound: 'long a',
            pattern: 'a_e',
            frequency: 'common',
            words: ['cake'],
            sentences: { cake: 'We baked a cake for the party.' },
          },
        ],
      },
    })
    expect(response.ok()).toBeTruthy()
    return (await response.json()).list.id as string
  }

  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    test(`write-in line sits at the label baseline at ${viewport.width}px`, async ({ page }) => {
      const listId = await seedBaselineList(page.request)
      await page.setViewportSize(viewport)
      await page.goto(`/lists/${listId}/worksheets/print?types=reading`)
      await expect(page.getByRole('heading', { name: 'Reading practice' }).first()).toBeVisible()

      const header = page.locator('[aria-label="Name and date lines"]').first()
      const label = header.locator('span.text-sm').first()
      const line = header.locator('span[aria-hidden="true"]').first()
      const labelBox = await label.boundingBox()
      const lineBox = await line.boundingBox()
      expect(labelBox).not.toBeNull()
      expect(lineBox).not.toBeNull()
      // The rule's bottom edge must land in the lower part of the label's
      // line box (at the text baseline), not at its vertical center.
      const lineBottom = lineBox!.y + lineBox!.height
      expect(lineBottom).toBeGreaterThanOrEqual(labelBox!.y + labelBox!.height * 0.7)
      expect(lineBottom).toBeLessThanOrEqual(labelBox!.y + labelBox!.height)
    })
  }
})

/**
 * Word search difficulty by grade band (issue #519). A grade-1 list gets a
 * fixed 10x10 grid, straight-only instructions, large-print cells, and an
 * alphabetical word bank. Desktop and 390px.
 */
test.describe('word search difficulty by grade band', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
    // Never open a real print dialog in the test browser.
    await context.addInitScript(() => {
      window.print = () => {}
    })
  })

  async function seedGrade1List(request: import('@playwright/test').APIRequestContext): Promise<string> {
    const response = await request.post('/api/lists', {
      data: {
        name: 'E2E Grade 1 Word Search',
        gradeLevel: '1',
        patterns: [
          {
            sound: 'long a',
            pattern: 'a_e',
            frequency: 'common',
            words: ['rain', 'cake', 'bake'],
            sentences: {
              rain: 'The rain fell all afternoon.',
              cake: 'We baked a cake for the party.',
              bake: 'I like to bake bread on Sundays.',
            },
          },
        ],
      },
    })
    expect(response.ok()).toBeTruthy()
    return (await response.json()).list.id as string
  }

  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    test(`grade-1 list gets the beginner word search at ${viewport.width}px`, async ({ page }) => {
      const listId = await seedGrade1List(page.request)
      await page.setViewportSize(viewport)
      await page.goto(`/lists/${listId}/worksheets/print?types=word-search`)
      await expect(page.getByRole('heading', { name: 'Word search' }).first()).toBeVisible()

      // Beginners are told words run across or down only (no diagonals).
      await expect(page.getByText('Words run across or down.').first()).toBeVisible()
      await expect(page.getByText('or diagonally')).toHaveCount(0)

      // Fixed 10x10 grid with large-print cells.
      const grid = page.locator('table[aria-label="Word search grid"]').first()
      await expect(grid.locator('tbody tr')).toHaveCount(10)
      await expect(grid.locator('tbody tr').first().locator('td')).toHaveCount(10)
      const cell = grid.locator('tbody tr td').first()
      await expect(cell).toHaveClass(/h-11/)
      await expect(cell).toHaveClass(/w-11/)
      await expect(cell).toHaveClass(/text-2xl/)

      // The word bank is alphabetical, not placement order.
      const bank = page.getByLabel('Word bank').first()
      await expect(bank.locator('span')).toHaveText(['BAKE', 'CAKE', 'RAIN'])
    })
  }
})
