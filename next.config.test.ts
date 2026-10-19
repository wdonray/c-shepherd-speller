/**
 * Regression tests for the Content-Security-Policy in next.config.ts.
 *
 * Issue #438: song-video thumbnails rendered as blank boxes because the
 * policy did not allow YouTube's thumbnail host (img-src 'self' data:
 * blob: only).
 *
 * Issue #440: song videos did not play at all. The player area showed
 * Chrome's blocked-frame page ("This content is blocked. Contact the site
 * owner to fix the issue."), which is the browser refusing to frame
 * https://www.youtube-nocookie.com: with no frame-src directive the
 * default-src 'self' fallback blocks every video embed.
 */
import { describe, it, expect } from 'vitest'
import nextConfig from './next.config'

async function contentSecurityPolicy(): Promise<string> {
  const headers = await nextConfig.headers?.()
  const csp = headers?.flatMap((route) => route.headers).find((header) => header.key === 'Content-Security-Policy')
  expect(csp).toBeDefined()
  return csp?.value ?? ''
}

describe('next.config.ts Content-Security-Policy', () => {
  it('allows YouTube thumbnail images', async () => {
    const csp = await contentSecurityPolicy()
    const imgSrc = csp.split(';').find((directive) => directive.trim().startsWith('img-src'))
    expect(imgSrc).toContain('https://i.ytimg.com')
  })

  it('allows framing the privacy-enhanced YouTube embeds', async () => {
    const csp = await contentSecurityPolicy()
    const frameSrc = csp.split(';').find((directive) => directive.trim().startsWith('frame-src'))
    expect(frameSrc).toContain('https://www.youtube-nocookie.com')
  })

  it('allows verifying pasted links through YouTube oEmbed', async () => {
    const csp = await contentSecurityPolicy()
    const connectSrc = csp.split(';').find((directive) => directive.trim().startsWith('connect-src'))
    expect(connectSrc).toContain('https://www.youtube.com')
  })
})
