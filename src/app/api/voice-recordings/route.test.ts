import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }))
vi.mock('@/lib/require-auth', () => ({ requireUser }))

const { docSend, getPresignedPutUrl, s3ObjectExists, deleteS3Object, reportError } = vi.hoisted(() => ({
  docSend: vi.fn(),
  getPresignedPutUrl: vi.fn(),
  s3ObjectExists: vi.fn(),
  deleteS3Object: vi.fn(),
  reportError: vi.fn(),
}))
vi.mock('@/lib/s3', () => ({
  getVoiceDocClient: () => ({ send: docSend }),
  getPresignedPutUrl,
  s3ObjectExists,
  deleteS3Object,
}))
vi.mock('@/lib/report-error', () => ({ reportError }))

import { GET, POST, PATCH, DELETE } from './route'
import { VOICE_STORAGE_QUOTA_BYTES } from '@/models/VoiceRecording'

const authed = { user: { id: 'u1', email: 't@example.com' }, response: null }
const unauthorized = {
  user: null,
  response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}

function jsonRequest(body: unknown, method = 'POST'): NextRequest {
  return new NextRequest('http://localhost/api/voice-recordings', {
    method,
    body: JSON.stringify(body),
  })
}

function badJsonRequest(method = 'POST'): NextRequest {
  return new NextRequest('http://localhost/api/voice-recordings', {
    method,
    body: 'not-json{',
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

describe('GET /api/voice-recordings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not signed in', async () => {
    requireUser.mockResolvedValue(unauthorized)
    const res = await GET()
    expect(res.status).toBe(401)
    expect(docSend).not.toHaveBeenCalled()
  })

  it('returns only completed uploads, newest first', async () => {
    requireUser.mockResolvedValue(authed)
    docSend.mockResolvedValue({
      Items: [
        item({ text: 'old', updatedAt: 100 }),
        item({ text: 'new', updatedAt: 300 }),
        item({ text: 'pending', uploadComplete: false }),
      ],
    })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recordings.map((r: { text: string }) => r.text)).toEqual(['new', 'old'])
    expect(body.recordings[0]).not.toHaveProperty('s3Key')
    expect(body.recordings[0]).not.toHaveProperty('PK')
  })

  it('returns an empty list when the query has no items', async () => {
    requireUser.mockResolvedValue(authed)
    docSend.mockResolvedValue({})
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ recordings: [] })
  })

  it('marks the response no-store', async () => {
    requireUser.mockResolvedValue(authed)
    docSend.mockResolvedValue({ Items: [] })
    const res = await GET()
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('returns 500 when the database fails', async () => {
    requireUser.mockResolvedValue(authed)
    docSend.mockRejectedValue(new Error('db down'))
    const res = await GET()
    expect(res.status).toBe(500)
    expect(reportError).toHaveBeenCalled()
  })
})

describe('POST /api/voice-recordings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPresignedPutUrl.mockResolvedValue('https://signed.example/put')
  })

  const validBody = { text: 'cake', mimeType: 'audio/webm', byteSize: 1000, recordedAt: 123 }

  it('returns 401 when not signed in', async () => {
    requireUser.mockResolvedValue(unauthorized)
    const res = await POST(jsonRequest(validBody))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid JSON', async () => {
    requireUser.mockResolvedValue(authed)
    const res = await POST(badJsonRequest())
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid bodies', async () => {
    requireUser.mockResolvedValue(authed)
    for (const body of [
      { ...validBody, text: '' },
      { ...validBody, mimeType: 'video/mp4' },
      { ...validBody, mimeType: 123 },
      { ...validBody, byteSize: 0 },
      { ...validBody, byteSize: 3_000_000 },
      { ...validBody, recordedAt: -1 },
    ]) {
      const res = await POST(jsonRequest(body))
      expect(res.status).toBe(400)
    }
  })

  it('reports which field failed validation', async () => {
    requireUser.mockResolvedValue(authed)
    const res = await POST(jsonRequest({ ...validBody, byteSize: 0 }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.details.fieldErrors.byteSize).toBeDefined()
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        location: 'POST /api/voice-recordings',
        extra: expect.objectContaining({ fieldErrors: expect.anything() }),
      })
    )
  })

  it('accepts codec-suffixed and upper-case MIME types', async () => {
    requireUser.mockResolvedValue(authed)
    docSend.mockResolvedValue({ Items: [] })
    for (const mimeType of ['audio/mp4;codecs=mp4a.40.2', 'AUDIO/WEBM']) {
      const res = await POST(jsonRequest({ ...validBody, mimeType }))
      expect(res.status).toBe(200)
    }
    // The codec suffix is stripped before the presigned URL is minted.
    expect(getPresignedPutUrl).toHaveBeenCalledWith(expect.any(String), 'audio/mp4', 1000)
    expect(getPresignedPutUrl).toHaveBeenCalledWith(expect.any(String), 'audio/webm', 1000)
  })

  it('begins an upload with a presigned URL', async () => {
    requireUser.mockResolvedValue(authed)
    docSend.mockResolvedValue({ Items: [] })
    const res = await POST(jsonRequest(validBody))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.uploadUrl).toBe('https://signed.example/put')
    expect(body.expiresIn).toBe(900)
    expect(body.s3Key).toContain('voice-recordings/u1/')
    expect(getPresignedPutUrl).toHaveBeenCalledWith(body.s3Key, 'audio/webm', 1000)
    // The metadata row starts incomplete.
    const putCall = docSend.mock.calls.find((c) => c[0].constructor.name === 'PutCommand')
    expect(putCall![0].input.Item.uploadComplete).toBe(false)
  })

  it('returns 413 when the quota is exceeded', async () => {
    requireUser.mockResolvedValue(authed)
    docSend.mockResolvedValue({ Items: [item({ SK: 'VOICE#other', byteSize: VOICE_STORAGE_QUOTA_BYTES })] })
    const res = await POST(jsonRequest(validBody))
    expect(res.status).toBe(413)
    const body = await res.json()
    expect(body.error).toContain('storage is full')
    expect(body.quota).toBe(VOICE_STORAGE_QUOTA_BYTES)
  })

  it('excludes the item being replaced from the quota math', async () => {
    requireUser.mockResolvedValue(authed)
    // A re-record of the same word near the limit must not 413.
    const { voiceRecordKeys } = await import('@/models/VoiceRecording')
    const keys = voiceRecordKeys('u1', 'cake')
    docSend.mockResolvedValue({
      Items: [item({ SK: keys.SK, byteSize: VOICE_STORAGE_QUOTA_BYTES })],
    })
    const res = await POST(jsonRequest(validBody))
    expect(res.status).toBe(200)
  })

  it('sweeps stale incomplete uploads', async () => {
    requireUser.mockResolvedValue(authed)
    const stale = item({
      SK: 'VOICE#stale',
      text: 'stale',
      s3Key: 'voice-recordings/u1/stale.webm',
      uploadComplete: false,
      updatedAt: Date.now() - 25 * 60 * 60 * 1000,
    })
    const fresh = item({
      SK: 'VOICE#fresh',
      text: 'fresh',
      s3Key: 'voice-recordings/u1/fresh.webm',
      uploadComplete: false,
      updatedAt: Date.now(),
    })
    docSend.mockResolvedValue({ Items: [stale, fresh] })
    s3ObjectExists.mockResolvedValue(true)
    const res = await POST(jsonRequest(validBody))
    expect(res.status).toBe(200)
    expect(deleteS3Object).toHaveBeenCalledWith(stale.s3Key)
    expect(deleteS3Object).not.toHaveBeenCalledWith(fresh.s3Key)
  })

  it('still uploads when the orphan sweep fails', async () => {
    requireUser.mockResolvedValue(authed)
    const stale = item({
      SK: 'VOICE#stale',
      text: 'stale',
      uploadComplete: false,
      updatedAt: Date.now() - 25 * 60 * 60 * 1000,
    })
    docSend.mockResolvedValue({ Items: [stale] })
    deleteS3Object.mockRejectedValueOnce(new Error('s3 down'))
    const res = await POST(jsonRequest(validBody))
    expect(res.status).toBe(200)
    expect(reportError).toHaveBeenCalled()
  })

  it('returns 500 when the database fails', async () => {
    requireUser.mockResolvedValue(authed)
    docSend.mockRejectedValue(new Error('db down'))
    const res = await POST(jsonRequest(validBody))
    expect(res.status).toBe(500)
  })
})

describe('PATCH /api/voice-recordings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not signed in', async () => {
    requireUser.mockResolvedValue(unauthorized)
    const res = await PATCH(jsonRequest({ text: 'cake' }, 'PATCH'))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid JSON and bodies', async () => {
    requireUser.mockResolvedValue(authed)
    expect((await PATCH(badJsonRequest('PATCH'))).status).toBe(400)
    expect((await PATCH(jsonRequest({ text: '' }, 'PATCH'))).status).toBe(400)
  })

  it('returns 404 when there is no such upload', async () => {
    requireUser.mockResolvedValue(authed)
    docSend.mockResolvedValue({})
    const res = await PATCH(jsonRequest({ text: 'cake' }, 'PATCH'))
    expect(res.status).toBe(404)
  })

  it('returns 409 when the S3 object never landed', async () => {
    requireUser.mockResolvedValue(authed)
    docSend.mockResolvedValue({ Item: item({ uploadComplete: false }) })
    s3ObjectExists.mockResolvedValue(false)
    const res = await PATCH(jsonRequest({ text: 'cake' }, 'PATCH'))
    expect(res.status).toBe(409)
  })

  it('confirms the upload and returns the server timestamp', async () => {
    requireUser.mockResolvedValue(authed)
    docSend.mockResolvedValue({ Item: item({ uploadComplete: false }) })
    s3ObjectExists.mockResolvedValue(true)
    const res = await PATCH(jsonRequest({ text: 'cake' }, 'PATCH'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(typeof body.updatedAt).toBe('number')
    const updateCall = docSend.mock.calls.find((c) => c[0].constructor.name === 'UpdateCommand')
    expect(updateCall![0].input.UpdateExpression).toContain('uploadComplete')
  })

  it('is idempotent when the confirm response was lost', async () => {
    requireUser.mockResolvedValue(authed)
    docSend.mockResolvedValue({ Item: item({ uploadComplete: true, updatedAt: 777 }) })
    s3ObjectExists.mockResolvedValue(true)
    const res = await PATCH(jsonRequest({ text: 'cake' }, 'PATCH'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.updatedAt).toBe(777)
    expect(docSend.mock.calls.some((c) => c[0].constructor.name === 'UpdateCommand')).toBe(false)
  })

  it('returns 500 when the database fails', async () => {
    requireUser.mockResolvedValue(authed)
    docSend.mockRejectedValue(new Error('db down'))
    const res = await PATCH(jsonRequest({ text: 'cake' }, 'PATCH'))
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/voice-recordings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not signed in', async () => {
    requireUser.mockResolvedValue(unauthorized)
    const res = await DELETE(jsonRequest({ text: 'cake' }, 'DELETE'))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid JSON and bodies', async () => {
    requireUser.mockResolvedValue(authed)
    expect((await DELETE(badJsonRequest('DELETE'))).status).toBe(400)
    expect((await DELETE(jsonRequest({ text: '' }, 'DELETE'))).status).toBe(400)
  })

  it('deletes the S3 object and the metadata row', async () => {
    requireUser.mockResolvedValue(authed)
    docSend.mockResolvedValue({ Item: item() })
    const res = await DELETE(jsonRequest({ text: 'cake' }, 'DELETE'))
    expect(res.status).toBe(200)
    expect(deleteS3Object).toHaveBeenCalledWith('voice-recordings/u1/abc.webm')
    expect(docSend.mock.calls.some((c) => c[0].constructor.name === 'DeleteCommand')).toBe(true)
  })

  it('is a no-op when nothing exists', async () => {
    requireUser.mockResolvedValue(authed)
    docSend.mockResolvedValue({})
    const res = await DELETE(jsonRequest({ text: 'cake' }, 'DELETE'))
    expect(res.status).toBe(200)
    expect(deleteS3Object).not.toHaveBeenCalled()
  })

  it('returns 500 when the database fails', async () => {
    requireUser.mockResolvedValue(authed)
    docSend.mockRejectedValue(new Error('db down'))
    const res = await DELETE(jsonRequest({ text: 'cake' }, 'DELETE'))
    expect(res.status).toBe(500)
  })
})
