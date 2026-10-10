import { test, expect } from '@playwright/test'

// iPhone 14 viewport on Chromium (the iPhone 14 device descriptor targets
// WebKit, which is not installed here; these are the same geometry).
test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
})

/**
 * Mobile layout regression tests for the auth pages.
 * Donray reported the custom email auth pages felt cramped and, worse,
 * could not be scrolled at all (a `body { overflow: hidden }` rule on
 * auth pages). These tests pin the fix: the page must always scroll,
 * including on short viewports and keyboard-sized viewports.
 */
const AUTH_PAGES = [
  '/auth/signin',
  '/auth/email/signin',
  '/auth/email/signup',
  '/auth/email/verify',
  '/auth/email/forgot-password',
  '/auth/email/reset-password',
]

test.describe('auth pages mobile layout', () => {
  for (const path of AUTH_PAGES) {
    test(`${path} does not lock body scroll`, async ({ page }) => {
      await page.goto(path)
      const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow)
      expect(overflow).not.toBe('hidden')
    })
  }

  test('a long auth form scrolls on a short viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 500 })
    await page.goto('/auth/email/signup')
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()

    const result = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement
      const canScroll = el.scrollHeight > window.innerHeight
      window.scrollTo(0, 200)
      return { canScroll, scrolledY: window.scrollY }
    })
    expect(result.canScroll).toBe(true)
    expect(result.scrolledY).toBeGreaterThan(0)
  })

  test('the submit button stays reachable with a keyboard-sized viewport', async ({ page }) => {
    // 420px tall approximates the visible area with the iOS keyboard open.
    await page.setViewportSize({ width: 390, height: 420 })
    await page.goto('/auth/email/signin')
    const submit = page.getByRole('button', { name: 'Sign in', exact: true })
    await expect(submit).toBeVisible()
    await submit.scrollIntoViewIfNeeded()

    const box = await submit.boundingBox()
    const viewport = page.viewportSize()
    expect(box).not.toBeNull()
    expect(viewport).not.toBeNull()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1)
  })

  test('auth card uses the mobile-first layout, not the old fixed offset', async ({ page }) => {
    await page.goto('/auth/email/signin')
    const className = await page.evaluate(
      () => document.querySelector('main, #__next, body > div')?.firstElementChild?.className ?? ''
    )
    // The old layout pushed content down with a 128px top offset.
    expect(className).not.toMatch(/(^|\s)pt-32(\s|$)/)
  })
})
