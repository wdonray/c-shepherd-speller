/**
 * Regression test for issue #438: song-video thumbnails rendered as blank
 * boxes because the Content-Security-Policy in next.config.ts did not
 * allow YouTube's thumbnail host (img-src 'self' data: blob: only).
 */
import { describe, it, expect } from 'vitest'
import nextConfig from './next.config'

describe('next.config.ts Content-Security-Policy', () => {
  it('allows YouTube thumbnail images', async () => {
    const headers = await nextConfig.headers?.()
    const csp = headers?.flatMap((route) => route.headers).find((header) => header.key === 'Content-Security-Policy')
    expect(csp).toBeDefined()
    const imgSrc = csp?.value.split(';').find((directive) => directive.trim().startsWith('img-src'))
    expect(imgSrc).toContain('https://i.ytimg.com')
  })
})
