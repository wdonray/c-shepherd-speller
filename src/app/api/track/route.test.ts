import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import {
  recordPageView,
  isRateLimited,
  __resetRateLimitForTests,
} from '@/lib/analytics'

vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>()
  return {
    ...actual,
    recordPageView: vi.fn(),
    isRateLimited: vi.fn(),
  }
})

const recordPageViewMock = vi.mocked(recordPageView)
const isRateLimitedMock = vi.mocked(isRateLimited)

function makeRequest(body: unknown, userAgent = 'Mozilla/5.0'): Request {
  return new Request('https://example.com/api/track', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': userAgent,
      'x-forwarded-for': '1.2.3.4',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/track', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetRateLimitForTests()
    isRateLimitedMock.mockReturnValue(false)
    recordPageViewMock.mockResolvedValue(true)
  })

  it('records a valid page view and returns ok', async () => {
    const res = await POST(makeRequest({ path: '/display' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(recordPageViewMock).toHaveBeenCalledWith(
      '/display',
      '1.2.3.4',
      'Mozilla/5.0'
    )
  })

  it('returns 429 when rate limited', async () => {
    isRateLimitedMock.mockReturnValue(true)
    const res = await POST(makeRequest({ path: '/' }))
    expect(res.status).toBe(429)
    expect(recordPageViewMock).not.toHaveBeenCalled()
  })

  it('returns 400 for a missing path', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    expect(recordPageViewMock).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid path', async () => {
    const res = await POST(makeRequest({ path: 'not-a-path' }))
    expect(res.status).toBe(400)
    expect(recordPageViewMock).not.toHaveBeenCalled()
  })

  it('returns ok even when recording throws (analytics never breaks the site)', async () => {
    recordPageViewMock.mockRejectedValue(new Error('dynamo down'))
    const res = await POST(makeRequest({ path: '/' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('returns ok for malformed JSON bodies', async () => {
    const req = new Request('https://example.com/api/track', {
      method: 'POST',
      headers: { 'x-forwarded-for': '1.2.3.4' },
      body: 'not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
