import { test, expect } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

/**
 * Worksheet print output assertions (issue #524).
 *
 * Print margins and font embedding are asserted nowhere in our CSS. This spec
 * pins them down with real print-pipeline evidence instead of comments:
 *
 * 1. The named `@page worksheet` rule carries explicit `margin: 0.75in` and
 *    `size: letter portrait` (read back from the live stylesheet).
 * 2. The Lexend webfont the sheets print in is actually loaded before the
 *    print job renders.
 * 3. A real print PDF generated from the print page is US Letter-sized and
 *    has the font embedded (Chromium embeds loaded web fonts into printed
 *    PDFs; an un-embedded font would be substituted with layout shifts).
 *
 * Lexend is deliberately kept for print rather than falling back to a
 * Base-14 stack: it is self-hosted via next/font/local (no network fetch to
 * fail), and the worksheet blanks are sized in em, so the print-preview
 * screen must use the same font as the printed page.
 */
test.describe('worksheet print output', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  async function seedList(request: import('@playwright/test').APIRequestContext): Promise<string> {
    const response = await request.post('/api/lists', {
      data: {
        name: 'E2E Print Output Week',
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
        ],
      },
    })
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    return body.list.id as string
  }

  test('print page pins Letter paper with 0.75in margins and embeds Lexend', async ({ page }) => {
    const listId = await seedList(page.request)
    await page.goto(`/lists/${listId}/worksheets/print?types=reading`)
    await expect(page.locator('.print-sheets')).toBeVisible()

    // 1. The named @page rule asserts explicit margins and paper size.
    // The rule lives inside @media print, so recurse into nested rules.
    const pageRule = await page.evaluate(() => {
      function scan(rules: CSSRuleList): { margin: string; size: string } | null {
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSPageRule && rule.selectorText === 'worksheet') {
            return {
              margin: rule.style.getPropertyValue('margin'),
              size: rule.style.getPropertyValue('size'),
            }
          }
          if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule) {
            const found = scan(rule.cssRules)
            if (found) return found
          }
        }
        return null
      }
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList | null = null
        try {
          rules = sheet.cssRules
        } catch {
          // Cross-origin stylesheets (none expected here) are unreadable.
          continue
        }
        const found = scan(rules)
        if (found) return found
      }
      return null
    })
    expect(pageRule).not.toBeNull()
    expect(pageRule?.margin).toBe('0.75in')
    // Chromium serializes "letter portrait" as "letter" (portrait is the
    // default orientation); the paper size is what this pins down.
    expect(pageRule?.size).toBe('letter')

    // 2. The print font stack is loaded before the print job runs.
    await expect
      .poll(
        async () =>
          page.evaluate(() =>
            Array.from(document.fonts).some((face) => /lexend/i.test(face.family) && face.status === 'loaded')
          ),
        { timeout: 10_000 }
      )
      .toBe(true)

    // 3. A real print PDF is Letter-sized with the font embedded.
    // Never open a real print dialog in the test browser; page.pdf() drives
    // the same Chromium print pipeline headlessly. Chromium subset-embeds
    // Lexend as Type 3 fonts (glyph outlines baked into the PDF as vector
    // paths) rather than as an sfnt /FontFile2 stream: the subset tag
    // (XXXXXX+Lexend) is the PDF spec's marker for an embedded subset, so no
    // viewer can substitute the font and shift the layout.
    const pdf = await page.pdf({ printBackground: true })
    const pdfText = pdf.toString('latin1')
    // US Letter portrait page box: 612 x 792 pt.
    expect(pdfText).toContain('/MediaBox [0 0 612 792]')
    expect(pdfText).toContain('/FontFamily (Lexend)')
    expect(pdfText).toMatch(/\/[A-Z]{6}\+Lexend/)
  })
})
