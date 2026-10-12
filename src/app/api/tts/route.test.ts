import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import type { Session } from 'next-auth'

const { requireSession } = vi.hoisted(() => ({ requireSession: vi.fn() }))
vi.mock('@/lib/require-auth', () => ({ requireSession }))

const { checkRateLimit, getClientIp, rateLimitedResponse } = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  rateLimitedResponse: vi.fn(),
}))
vi.mock('@/lib/antibot', () => ({ checkRateLimit, getClientIp, rateLimitedResponse }))

const { synthesizeEdgeTts, EdgeTtsError } = vi.hoisted(() => ({
  synthesizeEdgeTts: vi.fn(),
  EdgeTtsError: class extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
}))
vi.mock('@/lib/edge-tts', () => ({
  MAX_TTS_TEXT_LENGTH: 500,
  synthesizeEdgeTts,
  EdgeTtsError,
}))

vi.mock('@/lib/report-error', () => ({ reportError: vi.fn() }))

// Imported after the mocks so the route binds to them.
import { GET } from './route'

const SESSION = {
  user: { id: 'sub-1', email: 'teacher@example.com', name: 'Teacher' },
  expires: '2999-01-01',
} as Session

function authed() {
  requireSession.mockResolvedValue({ session: SESSION, response: null })
  checkRateLimit.mockReturnValue({ allowed: true })
  getClientIp.mockReturnValue('1.2.3.4')
}

function requestWithText(text: string | null): NextRequest {
  const url =
    text === null ? 'https://app.example/api/tts' : `https://app.example/api/tts?text=${encodeURIComponent(text)}`
  return new NextRequest(url)
}

describe('GET /api/tts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authed()
  })

  it('returns 401 when not signed in', async () => {
    requireSession.mockResolvedValue({
      session: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })

    const response = await GET(requestWithText('hello'))

    expect(response.status).toBe(401)
    expect(synthesizeEdgeTts).not.toHaveBeenCalled()
  })

  it('returns 429 when the IP is rate limited', async () => {
    checkRateLimit.mockReturnValue({ allowed: false })
    rateLimitedResponse.mockReturnValue(NextResponse.json({ ok: false }, { status: 429 }))

    const response = await GET(requestWithText('hello'))

    expect(response.status).toBe(429)
    expect(checkRateLimit).toHaveBeenCalledWith('tts:1.2.3.4', 120, 10 * 60 * 1000)
    expect(synthesizeEdgeTts).not.toHaveBeenCalled()
  })

  it('returns 400 when text is missing', async () => {
    const response = await GET(requestWithText(null))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'missing-text' })
    expect(synthesizeEdgeTts).not.toHaveBeenCalled()
  })

  it('returns 400 when text is only whitespace', async () => {
    const response = await GET(requestWithText('   '))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'missing-text' })
  })

  it('returns 400 when text exceeds the length cap', async () => {
    const response = await GET(requestWithText('x'.repeat(501)))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'text-too-long' })
    expect(synthesizeEdgeTts).not.toHaveBeenCalled()
  })

  it('returns MP3 audio on success', async () => {
    synthesizeEdgeTts.mockResolvedValue(Buffer.from([1, 2, 3, 4]))

    const response = await GET(requestWithText('  hello  '))

    expect(synthesizeEdgeTts).toHaveBeenCalledWith('hello')
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]))
  })

  it('returns 502 when synthesis fails', async () => {
    synthesizeEdgeTts.mockRejectedValue(new EdgeTtsError('timeout', 'timed out'))

    const response = await GET(requestWithText('hello'))

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({ code: 'tts-unavailable' })
  })
})
