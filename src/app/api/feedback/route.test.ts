import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { requireSession } = vi.hoisted(() => ({ requireSession: vi.fn() }))
vi.mock('@/lib/require-auth', () => ({ requireSession }))

const { sendFeedbackEmail } = vi.hoisted(() => ({ sendFeedbackEmail: vi.fn() }))
vi.mock('@/lib/feedback-email', () => ({ sendFeedbackEmail }))

import { POST } from './route'
import { resetRateLimits } from '@/lib/antibot'

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

const validBody = {
  type: 'issue',
  subject: 'Print button is broken',
  details: 'Clicking print on the list page does nothing at all.',
}

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/feedback', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetRateLimits()
    verifyTurnstileTokenMock.mockResolvedValue({ ok: true })
  })

  it('returns 401 when not signed in', async () => {
    requireSession.mockResolvedValue({
      session: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const res = await POST(jsonRequest(validBody))

    expect(res.status).toBe(401)
    expect(sendFeedbackEmail).not.toHaveBeenCalled()
  })

  it('returns 400 when the body is not JSON', async () => {
    requireSession.mockResolvedValue(authed)
    const req = new NextRequest('http://localhost/api/feedback', { method: 'POST', body: 'not json {' })

    const res = await POST(req)

    expect(res.status).toBe(400)
    expect(sendFeedbackEmail).not.toHaveBeenCalled()
  })

  it('returns 400 when the payload fails validation', async () => {
    requireSession.mockResolvedValue(authed)

    const res = await POST(jsonRequest({ ...validBody, details: 'x' }))

    expect(res.status).toBe(400)
    expect(sendFeedbackEmail).not.toHaveBeenCalled()
  })

  it('emails the feedback with the caller address, name, and app version', async () => {
    requireSession.mockResolvedValue(authed)
    sendFeedbackEmail.mockResolvedValue(undefined)

    const res = await POST(jsonRequest(validBody))

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

  it('rate limits to five messages per user per hour', async () => {
    requireSession.mockResolvedValue(authed)
    sendFeedbackEmail.mockResolvedValue(undefined)

    for (let i = 0; i < 5; i++) {
      const res = await POST(jsonRequest(validBody))
      expect(res.status).toBe(200)
    }

    const limited = await POST(jsonRequest(validBody))
    expect(limited.status).toBe(429)
    expect(sendFeedbackEmail).toHaveBeenCalledTimes(5)
  })

  it('returns 500 when sending fails', async () => {
    requireSession.mockResolvedValue(authed)
    sendFeedbackEmail.mockRejectedValue(new Error('MessageRejected'))

    const res = await POST(jsonRequest(validBody))

    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Could not send your message. Please try again.')
  })

  it('verifies the Turnstile token with the client IP', async () => {
    requireSession.mockResolvedValue(authed)
    sendFeedbackEmail.mockResolvedValue(undefined)

    const res = await POST(jsonRequest({ ...validBody, turnstileToken: 'token-123' }))

    expect(res.status).toBe(200)
    expect(verifyTurnstileTokenMock).toHaveBeenCalledWith('token-123', 'unknown')
  })

  it('returns 403 when Turnstile verification fails', async () => {
    requireSession.mockResolvedValue(authed)
    verifyTurnstileTokenMock.mockResolvedValue({ ok: false, reason: 'invalid' })

    const res = await POST(jsonRequest(validBody))

    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Verification failed. Please try again.')
    expect(sendFeedbackEmail).not.toHaveBeenCalled()
  })

  it('returns 503 when Turnstile is unconfigured', async () => {
    requireSession.mockResolvedValue(authed)
    verifyTurnstileTokenMock.mockResolvedValue({ ok: false, reason: 'unconfigured' })

    const res = await POST(jsonRequest(validBody))

    expect(res.status).toBe(503)
    expect(sendFeedbackEmail).not.toHaveBeenCalled()
  })

  it('rejects a filled honeypot without verifying Turnstile or sending', async () => {
    requireSession.mockResolvedValue(authed)

    const res = await POST(jsonRequest({ ...validBody, website: 'http://spam.example' }))

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
      const res = await POST(jsonRequest(validBody))
      expect(res.status).toBe(200)
    }

    requireSession.mockResolvedValue({
      session: { user: { email: 'user20@example.com', name: 'User 20' } },
      response: null,
    })
    const limited = await POST(jsonRequest(validBody))
    expect(limited.status).toBe(429)
    expect(sendFeedbackEmail).toHaveBeenCalledTimes(20)
  })
})
