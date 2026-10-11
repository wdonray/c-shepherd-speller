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

  test('signin page shows the email button when Cognito is configured', async ({ page }) => {
    await page.goto('/auth/signin')
    // The Playwright webServer sets dummy COGNITO_* vars, so the Cognito
    // provider is registered and the button renders. The suite never
    // follows the redirect to the dummy issuer.
    await expect(page.getByRole('button', { name: 'Sign in with email and password' })).toBeVisible()
  })

  test('landing page is public; dashboard redirects to signin when unauthenticated', async ({ page }) => {
    const landing = await page.goto('/')
    // The marketing page renders for visitors with no session.
    expect(landing?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: /teach spelling by pattern/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /get started free/i }).first()).toBeVisible()

    // The app dashboard stays behind auth.
    const dashboard = await page.goto('/home')
    expect(dashboard?.status()).toBe(200)
    expect(page.url()).toContain('/auth/signin')
  })

  test('api routes return 401 without a session', async ({ request }) => {
    const response = await request.get('/api/users?email=nobody@example.com')
    expect(response.status()).toBe(401)
  })
})
