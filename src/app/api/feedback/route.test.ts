import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
// Node's own File, identical to the production runtime's global. The test
// env's jsdom File is a different class, and the route's `instanceof File`
// check must see the same class the multipart parser produces.
import { File as NodeFile } from 'node:buffer'

const { requireSession } = vi.hoisted(() => ({ requireSession: vi.fn() }))
vi.mock('@/lib/require-auth', () => ({ requireSession }))

const { sendFeedbackEmail } = vi.hoisted(() => ({ sendFeedbackEmail: vi.fn() }))
vi.mock('@/lib/feedback-email', () => ({ sendFeedbackEmail }))

import { POST } from './route'
import { resetRateLimits } from '@/lib/antibot'
import { FEEDBACK_ATTACHMENT_MAX_SIZE } from '@/models/Feedback'

vi.mock('@/lib/antibot', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  verifyTurnstileToken: vi.fn(async () => ({ ok: true })),
}))

const { verifyTurnstileToken } = await import('@/lib/antibot')
const verifyTurnstileTokenMock = vi.mocked(verifyTurnstileToken)

import { version } from '../../../../package.json'

const authed = {
  session: { user: { email: 'Teacher@Example.com', name: 'Chaley Williams' } },
  response: null,
}

const validFields: Record<string, string> = {
  type: 'issue',
  subject: 'Print button is broken',
  details: 'Clicking print on the list page does nothing at all.',
}

function formRequest(fields: Record<string, string>, files: TestFilePart[] = []): NextRequest {
  const boundary = '----patternspell-test-boundary'
  const chunks: Buffer[] = []
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`, 'utf8')
    )
  }
  for (const file of files) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.filename}"\r\n` +
          `Content-Type: ${file.contentType}\r\n\r\n`,
        'utf8'
      )
    )
    chunks.push(typeof file.bytes === 'string' ? Buffer.from(file.bytes, 'utf8') : Buffer.from(file.bytes))
    chunks.push(Buffer.from('\r\n', 'utf8'))
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'))
  return new NextRequest('http://localhost/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat(chunks),
  })
}

interface TestFilePart {
  field: string
  filename: string
  contentType: string
  bytes: string | Uint8Array
}

function pngPart(name = 'screenshot.png', bytes: string | Uint8Array = 'fake-png-bytes'): TestFilePart {
  return { field: 'attachment', filename: name, contentType: 'image/png', bytes }
}

describe('POST /api/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetRateLimits()
    verifyTurnstileTokenMock.mockResolvedValue({ ok: true })
    // Match the production runtime: the route's `instanceof File` check and
    // `request.formData()` both operate on this class.
    vi.stubGlobal('File', NodeFile)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns 401 when not signed in', async () => {
    requireSession.mockResolvedValue({
      session: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const res = await POST(formRequest(validFields))

    expect(res.status).toBe(401)
    expect(sendFeedbackEmail).not.toHaveBeenCalled()
  })

  it('returns 400 when the body is not a valid form', async () => {
    requireSession.mockResolvedValue(authed)
    const req = new NextRequest('http://localhost/api/feedback', { method: 'POST', body: 'not a form' })

    const res = await POST(req)

    expect(res.status).toBe(400)
    expect(sendFeedbackEmail).not.toHaveBeenCalled()
  })

  it('returns 400 when the payload fails validation', async () => {
    requireSession.mockResolvedValue(authed)

    const res = await POST(formRequest({ ...validFields, details: 'x' }))

    expect(res.status).toBe(400)
    expect(sendFeedbackEmail).not.toHaveBeenCalled()
  })

  it('returns 400 when a field is a file instead of text', async () => {
    requireSession.mockResolvedValue(authed)
    const fields = { ...validFields }
    delete fields.subject

    const res = await POST(formRequest(fields, [{ ...pngPart(), field: 'subject' }]))

    expect(res.status).toBe(400)
    expect(sendFeedbackEmail).not.toHaveBeenCalled()
  })

  it('emails the feedback with the caller address, name, and app version', async () => {
    requireSession.mockResolvedValue(authed)
    sendFeedbackEmail.mockResolvedValue(undefined)

    const res = await POST(formRequest(validFields))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(sendFeedbackEmail).toHaveBeenCalledWith({
      type: 'issue',
      subject: 'Print button is broken',
      details: 'Clicking print on the list page does nothing at all.',
      reporterEmail: 'Teacher@Example.com',
      reporterName: 'Chaley Williams',
      appVersion: version,
    })
  })

  it('forwards a valid image attachment to the email sender', async () => {
    requireSession.mockResolvedValue(authed)
    sendFeedbackEmail.mockResolvedValue(undefined)

    const res = await POST(formRequest(validFields, [pngPart('shot.png', 'fake-png-bytes')]))

    expect(res.status).toBe(200)
    const call = vi.mocked(sendFeedbackEmail).mock.calls[0][0]
    expect(call.attachment).toBeDefined()
    expect(call.attachment!.filename).toBe('shot.png')
    expect(call.attachment!.contentType).toBe('image/png')
    expect(call.attachment!.data).toEqual(Buffer.from('fake-png-bytes'))
  })

  it('ignores an empty attachment file', async () => {
    requireSession.mockResolvedValue(authed)
    sendFeedbackEmail.mockResolvedValue(undefined)

    const res = await POST(formRequest(validFields, [pngPart('empty.png', '')]))

    expect(res.status).toBe(200)
    const call = vi.mocked(sendFeedbackEmail).mock.calls[0][0]
    expect(call.attachment).toBeUndefined()
  })

  it('defaults an empty attachment filename', async () => {
    requireSession.mockResolvedValue(authed)
    sendFeedbackEmail.mockResolvedValue(undefined)

    const res = await POST(formRequest(validFields, [pngPart('', 'fake-png-bytes')]))

    expect(res.status).toBe(200)
    const call = vi.mocked(sendFeedbackEmail).mock.calls[0][0]
    expect(call.attachment!.filename).toBe('screenshot')
  })

  it('returns 400 for a non-image attachment', async () => {
    requireSession.mockResolvedValue(authed)
    const exe: TestFilePart = {
      field: 'attachment',
      filename: 'evil.exe',
      contentType: 'application/x-msdownload',
      bytes: 'MZ',
    }

    const res = await POST(formRequest(validFields, [exe]))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Attachments must be PNG, JPEG, GIF, or WebP images.')
    expect(sendFeedbackEmail).not.toHaveBeenCalled()
  })

  it('returns 400 for an oversized attachment', async () => {
    requireSession.mockResolvedValue(authed)
    const big = pngPart('big.png', new Uint8Array(FEEDBACK_ATTACHMENT_MAX_SIZE + 1))

    const res = await POST(formRequest(validFields, [big]))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Attachments must be 5 MB or smaller.')
    expect(sendFeedbackEmail).not.toHaveBeenCalled()
  })

  it('rate limits to five messages per user per hour', async () => {
    requireSession.mockResolvedValue(authed)
    sendFeedbackEmail.mockResolvedValue(undefined)

    for (let i = 0; i < 5; i++) {
      const res = await POST(formRequest(validFields))
      expect(res.status).toBe(200)
    }

    const limited = await POST(formRequest(validFields))
    expect(limited.status).toBe(429)
    expect(sendFeedbackEmail).toHaveBeenCalledTimes(5)
  })

  it('returns 500 when sending fails', async () => {
    requireSession.mockResolvedValue(authed)
    sendFeedbackEmail.mockRejectedValue(new Error('MessageRejected'))

    const res = await POST(formRequest(validFields))

    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Could not send your message. Please try again.')
  })

  it('verifies the Turnstile token with the client IP', async () => {
    requireSession.mockResolvedValue(authed)
    sendFeedbackEmail.mockResolvedValue(undefined)

    const res = await POST(formRequest({ ...validFields, turnstileToken: 'token-123' }))

    expect(res.status).toBe(200)
    expect(verifyTurnstileTokenMock).toHaveBeenCalledWith('token-123', 'unknown')
  })

  it('returns 403 when Turnstile verification fails', async () => {
    requireSession.mockResolvedValue(authed)
    verifyTurnstileTokenMock.mockResolvedValue({ ok: false, reason: 'invalid' })

    const res = await POST(formRequest(validFields))

    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Verification failed. Please try again.')
    expect(sendFeedbackEmail).not.toHaveBeenCalled()
  })

  it('returns 503 when Turnstile is unconfigured', async () => {
    requireSession.mockResolvedValue(authed)
    verifyTurnstileTokenMock.mockResolvedValue({ ok: false, reason: 'unconfigured' })

    const res = await POST(formRequest(validFields))

    expect(res.status).toBe(503)
    expect(sendFeedbackEmail).not.toHaveBeenCalled()
  })

  it('rejects a filled honeypot without verifying Turnstile or sending', async () => {
    requireSession.mockResolvedValue(authed)

    const res = await POST(formRequest({ ...validFields, website: 'http://spam.example' }))

    expect(res.status).toBe(400)
    expect(verifyTurnstileTokenMock).not.toHaveBeenCalled()
    expect(sendFeedbackEmail).not.toHaveBeenCalled()
  })

  it('rate limits to twenty messages per IP per hour across users', async () => {
    sendFeedbackEmail.mockResolvedValue(undefined)

    for (let i = 0; i < 20; i++) {
      requireSession.mockResolvedValue({
        session: { user: { email: `user${i}@example.com`, name: `User ${i}` } },
        response: null,
      })
      const res = await POST(formRequest(validFields))
      expect(res.status).toBe(200)
    }

    requireSession.mockResolvedValue({
      session: { user: { email: 'user20@example.com', name: 'User 20' } },
      response: null,
    })
    const limited = await POST(formRequest(validFields))
    expect(limited.status).toBe(429)
    expect(sendFeedbackEmail).toHaveBeenCalledTimes(20)
  })
})
