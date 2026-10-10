import { describe, it, expect } from 'vitest'
import { RELEASES_API, RELEASES_URL } from './github'

describe('github release endpoints', () => {
  it('points at the repo releases API', () => {
    expect(RELEASES_API).toBe('https://api.github.com/repos/wdonray/c-shepherd-speller/releases?per_page=5')
  })

  it('points at the repo releases page', () => {
    expect(RELEASES_URL).toBe('https://github.com/wdonray/c-shepherd-speller/releases')
  })
})
