import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CognitoAuthError } from '@/lib/cognito-auth'
import { POST } from './route'

vi.mock('@/lib/cognito-auth', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  cognitoSignUp: vi.fn(),
}))

vi.mock('@/lib/db-utils', () => ({
  getUserByEmail: vi.fn(),
}))

vi.mock('@/lib/antibot', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  checkRateLimit: vi.fn(() => ({ allowed: true })),
  getClientIp: vi.fn(() => '9.9.9.9'),
  verifyTurnstileToken: vi.fn(async () => ({ ok: true })),
}))

const { cognitoSignUp } = await import('@/lib/cognito-auth')
const cognitoSignUpMock = vi.mocked(cognitoSignUp)
const { getUserByEmail } = await import('@/lib/db-utils')
const getUserByEmailMock = vi.mocked(getUserByEmail)
const { checkRateLimit, verifyTurnstileToken } = await import('@/lib/antibot')
const checkRateLimitMock = vi.mocked(checkRateLimit)
const verifyTurnstileTokenMock = vi.mocked(verifyTurnstileToken)

const ENV = {
  COGNITO_CLIENT_ID: 'test-client-id',
  COGNITO_CLIENT_SECRET: 'test-secret',
  COGNITO_ISSUER: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test',
}

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/auth/email/signup', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  )
}

beforeEach(() => {
  for (const [key, value] of Object.entries(ENV)) {
    vi.stubEnv(key, value)
  }
  cognitoSignUpMock.mockReset()
  getUserByEmailMock.mockReset()
  getUserByEmailMock.mockResolvedValue(undefined)
  checkRateLimitMock.mockReset()
  checkRateLimitMock.mockReturnValue({ allowed: true })
  verifyTurnstileTokenMock.mockReset()
  verifyTurnstileTokenMock.mockResolvedValue({ ok: true })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/auth/email/signup', () => {
  it('registers the user and returns ok', async () => {
    cognitoSignUpMock.mockResolvedValue({ userConfirmed: false })

    const response = await post({ name: 'Chaley', email: 't@e.com', password: 'S3cure!pass' })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, userConfirmed: false })
    expect(getUserByEmailMock).toHaveBeenCalledWith('t@e.com')
    expect(cognitoSignUpMock).toHaveBeenCalledWith('Chaley', 't@e.com', 'S3cure!pass')
  })

  it('returns 409 without calling Cognito when the email already has an account', async () => {
    getUserByEmailMock.mockResolvedValue({ id: 'u1', email: 't@e.com' } as never)

    const response = await post({ name: 'N', email: 't@e.com', password: 'S3cure!pass' })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ ok: false, code: 'email-in-use' })
    expect(cognitoSignUpMock).not.toHaveBeenCalled()
  })

  it('rejects a 503 when the pool is not configured', async () => {
    vi.stubEnv('COGNITO_CLIENT_ID', '')

    const response = await post({ name: 'N', email: 't@e.com', password: 'S3cure!pass' })

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ ok: false, code: 'not-configured' })
    expect(cognitoSignUpMock).not.toHaveBeenCalled()
  })

  it('rejects invalid bodies with 400', async () => {
    for (const body of [
      {},
      { name: '', email: 't@e.com', password: 'S3cure!pass' },
      { name: 'N', email: 'not-an-email', password: 'S3cure!pass' },
      { name: 'N', email: 't@e.com', password: 'short' },
      'not json{{{',
    ]) {
      const response = await post(body)
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ ok: false, code: 'invalid-input' })
    }
    expect(cognitoSignUpMock).not.toHaveBeenCalled()
  })

  it('maps a duplicate email to 409', async () => {
    cognitoSignUpMock.mockRejectedValue(new CognitoAuthError('email-in-use'))

    const response = await post({ name: 'N', email: 't@e.com', password: 'S3cure!pass' })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ ok: false, code: 'email-in-use' })
  })

  it('maps unexpected failures to 500', async () => {
    cognitoSignUpMock.mockRejectedValue(new Error('boom'))

    const response = await post({ name: 'N', email: 't@e.com', password: 'S3cure!pass' })

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ ok: false, code: 'server-error' })
  })

  it('returns 429 before parsing when the IP is rate limited', async () => {
    checkRateLimitMock.mockReturnValue({ allowed: false })

    const response = await post('not json{{{')

    expect(checkRateLimitMock).toHaveBeenCalledWith('signup:9.9.9.9', 10, 600_000)
    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({ ok: false, code: 'too-many-attempts' })
    expect(verifyTurnstileTokenMock).not.toHaveBeenCalled()
    expect(cognitoSignUpMock).not.toHaveBeenCalled()
  })

  it('rejects a filled honeypot with 400 before verifying Turnstile', async () => {
    const response = await post({
      name: 'N',
      email: 't@e.com',
      password: 'S3cure!pass',
      website: 'https://spam.example',
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ ok: false, code: 'invalid-input' })
    expect(verifyTurnstileTokenMock).not.toHaveBeenCalled()
    expect(cognitoSignUpMock).not.toHaveBeenCalled()
  })

  it('accepts an empty honeypot field', async () => {
    cognitoSignUpMock.mockResolvedValue({ userConfirmed: false })

    const response = await post({
      name: 'N',
      email: 't@e.com',
      password: 'S3cure!pass',
      website: '',
      turnstileToken: 'token-123',
    })

    expect(response.status).toBe(200)
    expect(verifyTurnstileTokenMock).toHaveBeenCalledWith('token-123', '9.9.9.9')
  })

  it('returns 403 when Turnstile verification fails', async () => {
    verifyTurnstileTokenMock.mockResolvedValue({ ok: false, reason: 'invalid' })

    const response = await post({ name: 'N', email: 't@e.com', password: 'S3cure!pass' })

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ ok: false, code: 'verification-failed' })
    expect(cognitoSignUpMock).not.toHaveBeenCalled()
  })

  it('returns 503 when Turnstile is unconfigured in production', async () => {
    verifyTurnstileTokenMock.mockResolvedValue({ ok: false, reason: 'unconfigured' })

    const response = await post({ name: 'N', email: 't@e.com', password: 'S3cure!pass' })

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ ok: false, code: 'verification-unavailable' })
    expect(cognitoSignUpMock).not.toHaveBeenCalled()
  })
})
