import { describe, it, expect } from 'vitest'
import sitemap from './sitemap'

describe('sitemap', () => {
  it('lists only public pages, including the flagship word-list page', () => {
    const urls = sitemap().map((entry) => entry.url)
    expect(urls).toContain('https://patternspell.org')
    expect(urls).toContain('https://patternspell.org/word-lists/ufli-lesson-84-ai-ay')
    expect(urls.every((url) => !url.includes('/lists/prebuilt'))).toBe(true)
    expect(urls.every((url) => !url.includes('/home'))).toBe(true)
  })
})
