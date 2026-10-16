import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }))
vi.mock('@/lib/require-auth', () => ({ requireUser }))

const { docSend, getPresignedGetUrl, reportError } = vi.hoisted(() => ({
  docSend: vi.fn(),
  getPresignedGetUrl: vi.fn(),
  reportError: vi.fn(),
}))
vi.mock('@/lib/s3', () => ({
  getVoiceDocClient: () => ({ send: docSend }),
  getPresignedGetUrl,
}))
vi.mock('@/lib/report-error', () => ({ reportError }))

import { POST } from './route'

const authed = { user: { id: 'u1', email: 't@example.com' }, response: null }
const unauthorized = {
  user: null,
  response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/voice-recordings/download-urls', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const item = (overrides = {}) => ({
  PK: 'USER#u1',
  SK: 'VOICE#abc',
  text: 'cake',
  s3Key: 'voice-recordings/u1/abc.webm',
  mimeType: 'audio/webm',
  byteSize: 1000,
  recordedAt: 100,
  updatedAt: 200,
  uploadComplete: true,
  ...overrides,
})

describe('POST /api/voice-recordings/download-urls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPresignedGetUrl.mockImplementation(async (key: string) => `https://signed.example/${key}`)
  })

  it('returns 401 when not signed in', async () => {
    requireUser.mockResolvedValue(unauthorized)
    const res = await POST(jsonRequest({ texts: ['cake'] }))
    expect(res.status).toBe(401)
    expect(docSend).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid JSON and bodies', async () => {
    requireUser.mockResolvedValue(authed)
    const bad = new NextRequest('http://localhost/api/voice-recordings/download-urls', {
      method: 'POST',
      body: 'not-json{',
    })
    expect((await POST(bad)).status).toBe(400)
    expect((await POST(jsonRequest({ texts: [] }))).status).toBe(400)
    expect((await POST(jsonRequest({ texts: [''] }))).status).toBe(400)
    expect((await POST(jsonRequest({ texts: new Array(101).fill('x') }))).status).toBe(400)
  })

  it('returns presigned urls for completed uploads only', async () => {
    requireUser.mockResolvedValue(authed)
    docSend.mockResolvedValue({
      Responses: {
        'patternspell-voice-recordings': [
          item(),
          item({ SK: 'VOICE#def', text: 'bake', s3Key: 'voice-recordings/u1/def.webm', uploadComplete: false }),
        ],
      },
    })
    const res = await POST(jsonRequest({ texts: ['cake', 'bake', 'missing'] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Object.keys(body.urls)).toEqual(['cake'])
    expect(body.urls.cake).toContain('voice-recordings/u1/abc.webm')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('returns no urls when the batch get has no responses', async () => {
    requireUser.mockResolvedValue(authed)
    docSend.mockResolvedValue({})
    const res = await POST(jsonRequest({ texts: ['cake'] }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ urls: {} })
  })

  it('returns 500 when the database fails', async () => {
    requireUser.mockResolvedValue(authed)
    docSend.mockRejectedValue(new Error('db down'))
    const res = await POST(jsonRequest({ texts: ['cake'] }))
    expect(res.status).toBe(500)
    expect(reportError).toHaveBeenCalled()
  })
})
