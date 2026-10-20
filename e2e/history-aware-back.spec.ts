import { test, expect } from '@playwright/test'

import { ensureE2EUser, sessionCookie } from './helpers/auth'

/**
 * History-aware back controls (issue #504). The back control names the page
 * the teacher actually came from and performs a real history-back; on direct
 * landing it falls back to the parent-named link.
 */
test.describe('history-aware back button', () => {
  test.beforeEach(async ({ context }) => {
    await ensureE2EUser()
    await context.addCookies([await sessionCookie()])
  })

  async function seedList(request: import('@playwright/test').APIRequestContext, name: string): Promise<string> {
    const response = await request.post('/api/lists', {
      data: {
        name,
        patterns: [
          {
            sound: 'long a',
            pattern: 'a_e',
            frequency: 'common',
            words: ['cake', 'bake'],
          },
        ],
      },
    })
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    return body.list.id as string
  }

  /** The card for the named list, wherever list cards render. */
  function listCard(page: import('@playwright/test').Page, name: string) {
    return page.locator('div.grid > div', { hasText: name }).first()
  }

  test('Home -> Edit list: back control is named Home and returns home', async ({ page }) => {
    const name = `E2E Back Home ${Date.now()}`
    const listId = await seedList(page.request, name)

    await page.goto('/home')

    // In-app navigation: dashboard "Edit list" card button (router.push).
    const card = listCard(page, name)
    await expect(card).toBeVisible()
    await card.getByRole('button', { name: 'Edit list' }).click()
    await expect(page).toHaveURL(new RegExp(`/lists/${listId}`))
    await expect(page.getByRole('heading', { name })).toBeVisible()

    // The back control names the page we came from and is a real back action.
    const back = page.getByRole('button', { name: 'Home' })
    await expect(back).toBeVisible()
    await back.click()
    await expect(page).toHaveURL(/\/home/)
  })

  test('Lists -> Edit list: back control is named My spelling lists and returns there', async ({ page }) => {
    const name = `E2E Back Lists ${Date.now()}`
    const listId = await seedList(page.request, name)

    await page.goto('/lists')
    await expect(page.getByRole('heading', { name: 'My Spelling Lists' })).toBeVisible()

    const card = listCard(page, name)
    await expect(card).toBeVisible()
    await card.getByRole('button', { name: 'Edit list' }).click()
    await expect(page).toHaveURL(new RegExp(`/lists/${listId}`))

    const back = page.getByRole('button', { name: 'My spelling lists' })
    await expect(back).toBeVisible()
    await back.click()
    await expect(page).toHaveURL(/\/lists$/)
  })

  test('direct load of the edit page falls back to the parent-named link', async ({ page }) => {
    const name = `E2E Back Direct ${Date.now()}`
    const listId = await seedList(page.request, name)

    // Fresh tab, no in-app referrer: the control is a plain parent link.
    await page.goto(`/lists/${listId}`)
    await expect(page.getByRole('heading', { name })).toBeVisible()

    const backLink = page.getByRole('link', { name: 'My spelling lists', exact: true })
    await expect(backLink).toBeVisible()
    expect(await backLink.getAttribute('href')).toBe('/lists')
    await expect(page.getByRole('button', { name: 'Home' })).toHaveCount(0)
  })

  test('display picker -> chart: back control names the picker and returns to it', async ({ page }) => {
    const name = `E2E Back Present ${Date.now()}`
    await seedList(page.request, name)

    // Direct load of the picker: no in-app referrer, parent-named link.
    await page.goto('/display')
    const pickerBack = page.getByRole('link', { name: 'Home', exact: true })
    await expect(pickerBack).toBeVisible()

    // In-app navigation to the chart is a same-route search-param step.
    await page.getByRole('link', { name: `Present chart: ${name}` }).click()
    await expect(page).toHaveURL(/\/display\?list=/)

    // The back control names the picker (not the page before it) and the
    // click is a real history-back to the picker.
    const back = page.getByRole('button', { name: 'Present a list' })
    await expect(back).toBeVisible()
    await back.click()
    await expect(page).toHaveURL(/\/display$/)
    await expect(page.getByRole('link', { name: 'Home', exact: true })).toBeVisible()
  })
})
