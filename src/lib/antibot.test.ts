import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkRateLimit, getClientIp, rateLimitedResponse, resetRateLimits, verifyTurnstileToken } from './antibot'
import { reportError } from './report-error'

vi.mock('./report-error', () => ({ reportError: vi.fn() }))

const reportErrorMock = vi.mocked(reportError)

function requestWithForwardedFor(value: string | null): Request {
  const headers = new Headers()
  if (value !== null) headers.set('x-forwarded-for', value)
  return new Request('https://patternspell.org/api/auth/email/signup', { headers })
}

describe('getClientIp', () => {
  it('returns the first entry of x-forwarded-for', () => {
    expect(getClientIp(requestWithForwardedFor('1.2.3.4, 5.6.7.8'))).toBe('1.2.3.4')
  })

  it('trims whitespace around the first entry', () => {
    expect(getClientIp(requestWithForwardedFor('  9.9.9.9 , 1.1.1.1'))).toBe('9.9.9.9')
  })

  it('falls back to unknown when the header is missing or empty', () => {
    expect(getClientIp(requestWithForwardedFor(null))).toBe('unknown')
    expect(getClientIp(requestWithForwardedFor(''))).toBe('unknown')
    expect(getClientIp(requestWithForwardedFor('   '))).toBe('unknown')
  })
})

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimits()
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
  })

  afterEach(() => {
    vi.useRealTimers()
    resetRateLimits()
  })

  it('allows requests under the limit', () => {
    expect(checkRateLimit('k', 3, 60_000).allowed).toBe(true)
    expect(checkRateLimit('k', 3, 60_000).allowed).toBe(true)
    expect(checkRateLimit('k', 3, 60_000).allowed).toBe(true)
  })

  it('blocks requests at the limit and allows again after the window', () => {
    for (let i = 0; i < 3; i++) checkRateLimit('k', 3, 60_000)
    expect(checkRateLimit('k', 3, 60_000).allowed).toBe(false)
    vi.setSystemTime(1_000_000 + 60_001)
    expect(checkRateLimit('k', 3, 60_000).allowed).toBe(true)
  })

  it('tracks keys independently', () => {
    checkRateLimit('a', 1, 60_000)
    expect(checkRateLimit('a', 1, 60_000).allowed).toBe(false)
    expect(checkRateLimit('b', 1, 60_000).allowed).toBe(true)
  })

  it('prunes expired entries so the bucket does not grow', () => {
    checkRateLimit('k', 100, 1_000)
    vi.setSystemTime(1_000_000 + 2_000)
    // Old timestamps are dropped; a fresh burst of 100 fits again.
    for (let i = 0; i < 100; i++) {
      expect(checkRateLimit('k', 100, 1_000).allowed).toBe(true)
    }
    expect(checkRateLimit('k', 100, 1_000).allowed).toBe(false)
  })
})

describe('rateLimitedResponse', () => {
  it('returns a 429 with the too-many-attempts code', async () => {
    const response = rateLimitedResponse()
    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({ ok: false, code: 'too-many-attempts' })
  })
})

describe('verifyTurnstileToken', () => {
  const realFetch = globalThis.fetch

  beforeEach(() => {
    reportErrorMock.mockClear()
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret')
    vi.stubEnv('NODE_ENV', 'test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    globalThis.fetch = realFetch
  })

  function mockSiteverify(success: boolean) {
    globalThis.fetch = vi.fn(async () => ({
      json: async () => ({ success }),
    })) as unknown as typeof fetch
  }

  it('returns ok when Cloudflare verifies the token', async () => {
    mockSiteverify(true)
    await expect(verifyTurnstileToken('token-123', '1.2.3.4')).resolves.toEqual({ ok: true })
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0]
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    const body = (init?.body as URLSearchParams).toString()
    expect(body).toContain('secret=test-secret')
    expect(body).toContain('response=token-123')
    expect(body).toContain('remoteip=1.2.3.4')
  })

  it('rejects an invalid token without reporting an error', async () => {
    mockSiteverify(false)
    await expect(verifyTurnstileToken('bad-token', '1.2.3.4')).resolves.toEqual({
      ok: false,
      reason: 'invalid',
    })
    expect(reportErrorMock).not.toHaveBeenCalled()
  })

  it('rejects a missing token', async () => {
    mockSiteverify(true)
    await expect(verifyTurnstileToken(undefined, '1.2.3.4')).resolves.toEqual({
      ok: false,
      reason: 'missing',
    })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('rejects an empty token', async () => {
    mockSiteverify(true)
    await expect(verifyTurnstileToken('', '1.2.3.4')).resolves.toEqual({
      ok: false,
      reason: 'missing',
    })
  })

  it('fails closed and reports when Cloudflare is unreachable', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch
    await expect(verifyTurnstileToken('token-123', '1.2.3.4')).resolves.toEqual({
      ok: false,
      reason: 'error',
    })
    expect(reportErrorMock).toHaveBeenCalled()
  })

  it('fails closed with unconfigured when the secret is missing in production', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
    vi.stubEnv('NODE_ENV', 'production')
    mockSiteverify(true)
    await expect(verifyTurnstileToken('token-123', '1.2.3.4')).resolves.toEqual({
      ok: false,
      reason: 'unconfigured',
    })
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(reportErrorMock).toHaveBeenCalled()
  })

  it('skips verification when the secret is missing outside production', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
    vi.stubEnv('NODE_ENV', 'development')
    mockSiteverify(true)
    await expect(verifyTurnstileToken(undefined, '1.2.3.4')).resolves.toEqual({ ok: true })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
