import { describe, it, expect } from 'vitest'
import { RELEASES_API, RELEASES_URL, sortReleasesNewestFirst, type Release } from './github'

describe('github release endpoints', () => {
  it('points at the repo releases API', () => {
    expect(RELEASES_API).toBe('https://api.github.com/repos/wdonray/c-shepherd-speller/releases?per_page=5')
  })

  it('points at the repo releases page', () => {
    expect(RELEASES_URL).toBe('https://github.com/wdonray/c-shepherd-speller/releases')
  })
})

describe('sortReleasesNewestFirst', () => {
  const release = (version: string): Release => ({
    version,
    url: 'https://github.com/wdonray/c-shepherd-speller/releases',
    publishedAt: null,
    summary: null,
  })

  it('orders by version descending regardless of input order', () => {
    // Backfilled releases can arrive in creation order, which diverges
    // from version order; the Latest badge must still mark the true newest.
    const sorted = sortReleasesNewestFirst([release('0.30.0'), release('0.28.0'), release('0.30.2')])
    expect(sorted.map((r) => r.version)).toEqual(['0.30.2', '0.30.0', '0.28.0'])
  })

  it('does not mutate the input array', () => {
    const input = [release('0.28.0'), release('0.30.2')]
    sortReleasesNewestFirst(input)
    expect(input.map((r) => r.version)).toEqual(['0.28.0', '0.30.2'])
  })
})
