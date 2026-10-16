import { test, expect, type Page, type BrowserContext } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

/**
 * Layout-shift regression (issue #341). Every skeleton loader must occupy
 * exactly the space its loaded content will take: navigating each
 * skeleton-bearing route must produce effectively zero cumulative layout
 * shift (CLS <= 0.01) at desktop and mobile viewports.
 *
 * API responses are delayed so the skeleton state is always capturable;
 * CLS is measured with a PerformanceObserver from navigation until the
 * page settles.
 */

const CLS_THRESHOLD = 0.01
const API_DELAY_MS = 1200

async function seedList(page: Page): Promise<string> {
  const response = await page.request.post('/api/lists', {
    data: {
      name: 'CLS Audit List',
      patterns: [
        {
          id: 'p1',
          sound: 'long a',
          pattern: 'a_e',
          frequency: 'common',
          words: ['cake', 'bake', 'late'],
          rule: 'a_e comes at the end.',
        },
        { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'common', words: ['rain', 'paint'] },
      ],
    },
  })
  expect(response.ok()).toBe(true)
  const { list } = await response.json()
  return list.id as string
}

async function installClsObserver(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    ;(window as unknown as { __clsTotal: number }).__clsTotal = 0
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
        if (entry.hadRecentInput) continue
        ;(window as unknown as { __clsTotal: number }).__clsTotal += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })
}

async function delayApi(page: Page): Promise<void> {
  await page.route('**/api/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, API_DELAY_MS))
    await route.continue()
  })
}

async function measureCls(page: Page, url: string, skeletonName: string): Promise<number> {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  const skeleton = page.getByRole('status', { name: skeletonName })
  // The skeleton must actually appear; otherwise the test proves nothing.
  await expect(skeleton).toBeVisible({ timeout: 10000 })
  await expect(skeleton).toBeHidden({ timeout: 20000 })
  await page.waitForTimeout(1000)
  return page.evaluate(() => (window as unknown as { __clsTotal: number }).__clsTotal ?? 0)
}

const ROUTES: Array<{ name: string; path: (listId: string) => string; skeleton: string }> = [
  { name: 'home', path: () => '/home', skeleton: 'Loading dashboard' },
  { name: 'lists', path: () => '/lists', skeleton: 'Loading word lists' },
  { name: 'list editor', path: (id) => `/lists/${id}`, skeleton: 'Loading list editor' },
  { name: 'display picker', path: () => '/display', skeleton: 'Loading lists' },
  { name: 'display chart', path: (id) => `/display?list=${id}`, skeleton: 'Loading chart' },
  { name: 'practice picker', path: () => '/practice', skeleton: 'Loading practice' },
  { name: 'print', path: (id) => `/lists/${id}/print`, skeleton: 'Loading print preview' },
]

test.describe('no layout shift', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
    await installClsObserver(context)
  })

  for (const route of ROUTES) {
    test(`${route.name} shifts negligibly on desktop`, async ({ page }) => {
      const listId = await seedList(page)
      await delayApi(page)
      const cls = await measureCls(page, route.path(listId), route.skeleton)
      expect(cls).toBeLessThanOrEqual(CLS_THRESHOLD)
    })

    test(`${route.name} shifts negligibly on mobile`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      const listId = await seedList(page)
      await delayApi(page)
      const cls = await measureCls(page, route.path(listId), route.skeleton)
      expect(cls).toBeLessThanOrEqual(CLS_THRESHOLD)
    })
  }
})
