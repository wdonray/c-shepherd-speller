import { test, expect } from '@playwright/test'

/**
 * Unauthenticated smoke tests. No session cookie is set, so these verify
 * the app's auth gating: public pages render, protected pages redirect.
 */
test.describe('unauthenticated smoke', () => {
  test('signin page renders with a Google button', async ({ page }) => {
    const response = await page.goto('/auth/signin')
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'PatternSpell' })).toBeVisible()
    await expect(page.getByText('A pattern-based spelling toolkit for K-3 teachers.')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible()
  })

  test('home redirects to signin when unauthenticated', async ({ page }) => {
    const response = await page.goto('/')
    // Next.js proxy issues a 307 to /auth/signin; Playwright follows it.
    expect(response?.status()).toBe(200)
    expect(page.url()).toContain('/auth/signin')
  })

  test('api routes return 401 without a session', async ({ request }) => {
    const response = await request.get('/api/users?email=nobody@example.com')
    expect(response.status()).toBe(401)
  })
})
