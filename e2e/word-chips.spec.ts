import { test, expect, type Page } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

/**
 * Word-chip grid (issue #488). Pattern words render as compact chips in a
 * 2-up responsive grid instead of full-width cards; the whole chip is the
 * audio tap target with a visible speaker affordance, and pattern headers
 * stay exactly as-is. Words never wrap mid-word (issue #507).
 */
test.describe('word chips', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  async function seedList(page: Page): Promise<string> {
    const response = await page.request.post('/api/lists', {
      data: {
        name: 'E2E Word Chips',
        patterns: [
          {
            id: 'p1',
            sound: 'long a',
            pattern: 'a_e',
            frequency: 'common',
            words: ['cake', 'bake', 'made', 'late', 'game', 'name'],
          },
        ],
      },
    })
    expect(response.ok()).toBe(true)
    const { list } = await response.json()
    return list.id as string
  }

  test('words render as chips in a responsive grid, headers unchanged', async ({ page }) => {
    const id = await seedList(page)
    await page.goto(`/display?list=${id}`)

    // Every word is exactly one chip button; the whole chip is the tap target.
    for (const word of ['cake', 'bake', 'made', 'late', 'game', 'name']) {
      await expect(page.getByRole('button', { name: `Hear the word ${word}` })).toBeVisible()
    }
    // No per-word speaker buttons anymore: one button per word.
    await expect(page.getByRole('button', { name: 'Hear the word cake' })).toHaveCount(1)

    // The chips sit in a 2-column grid on mobile viewports.
    const grid = page.locator('section[aria-label="Pattern a_e"] ul')
    await expect(grid).toHaveClass(/grid-cols-2/)

    // Pattern headers: the sound is untouched. The frequency row (issue #510)
    // is hidden by default on the present chart, so its label is not shown
    // until the pattern's eye toggle is turned on.
    await expect(page.getByText('long a').first()).toBeVisible()
    await expect(page.getByText('Common', { exact: true }).first()).toBeHidden()
  })

  test('tapping a chip speaks the word', async ({ page }) => {
    const id = await seedList(page)
    // Stub speechSynthesis so the tap is observable without audio hardware.
    await page.addInitScript(() => {
      const spoken: string[] = []
      ;(window as unknown as { __spokenWords: string[] }).__spokenWords = spoken
      Object.defineProperty(window, 'speechSynthesis', {
        value: {
          speak: (utterance: SpeechSynthesisUtterance) => {
            spoken.push(utterance.text)
          },
          cancel: () => {},
          getVoices: () => [],
        },
        configurable: true,
      })
    })
    await page.goto(`/display?list=${id}`)
    await page.getByRole('button', { name: 'Hear the word cake' }).click()
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __spokenWords: string[] }).__spokenWords))
      .toContain('cake')
  })

  test('words never wrap mid-word inside chips, desktop and mobile (issue #507)', async ({ page }) => {
    // The ai/a/ay words from the issue screenshot. With three patterns at a
    // ~1200px viewport the pattern columns squeeze below their 420px cap, the
    // 3-up chip tracks shrink to ~101px, and break-words wrapped "train" into
    // "trai"+"n", "sway" into "swa"+"y", "spray" into "spra"+"y".
    const words = [
      'rain',
      'train',
      'wait',
      'pain',
      'mail',
      'cat',
      'map',
      'bag',
      'hat',
      'van',
      'say',
      'clay',
      'sway',
      'spray',
      'may',
    ]
    const response = await page.request.post('/api/lists', {
      data: {
        name: 'E2E Chip Wrap',
        patterns: [
          {
            id: 'p1',
            sound: 'long a',
            pattern: 'ai',
            frequency: 'common',
            words: ['rain', 'train', 'wait', 'pain', 'mail'],
          },
          {
            id: 'p2',
            sound: 'short a',
            pattern: 'a',
            frequency: 'common',
            words: ['cat', 'map', 'bag', 'hat', 'van'],
          },
          {
            id: 'p3',
            sound: 'long a',
            pattern: 'ay',
            frequency: 'rare',
            words: ['say', 'clay', 'sway', 'spray', 'may'],
          },
        ],
      },
    })
    expect(response.ok()).toBe(true)
    const { list } = await response.json()

    for (const viewport of [
      { width: 1200, height: 800 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto(`/display?list=${list.id as string}`)
      for (const word of words) {
        const chip = page.getByRole('button', { name: `Hear the word ${word}` })
        await expect(chip).toBeVisible()
        // The word label must render as exactly one line box: no mid-word wrap.
        const label = chip.locator('span')
        const lineCount = await label.evaluate((el) => {
          const range = document.createRange()
          range.selectNodeContents(el)
          return range.getClientRects().length
        })
        expect(lineCount, `chip "${word}" wraps at ${viewport.width}px`).toBe(1)
        // ...and the whole word must stay inside the chip, not spill out.
        const { scrollWidth, clientWidth } = await chip.evaluate((el) => ({
          scrollWidth: (el as HTMLElement).scrollWidth,
          clientWidth: (el as HTMLElement).clientWidth,
        }))
        expect(scrollWidth, `chip "${word}" overflows at ${viewport.width}px`).toBeLessThanOrEqual(clientWidth + 1)
      }
    }
  })
})
