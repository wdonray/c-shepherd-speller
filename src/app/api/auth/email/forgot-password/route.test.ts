import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CognitoAuthError } from '@/lib/cognito-auth'
import { POST } from './route'

vi.mock('@/lib/cognito-auth', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  cognitoForgotPassword: vi.fn(),
}))
vi.mock('@/lib/antibot', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  checkRateLimit: vi.fn(() => ({ allowed: true })),
  getClientIp: vi.fn(() => '9.9.9.9'),
}))

const { cognitoForgotPassword } = await import('@/lib/cognito-auth')
const cognitoForgotPasswordMock = vi.mocked(cognitoForgotPassword)
const { checkRateLimit } = await import('@/lib/antibot')
const checkRateLimitMock = vi.mocked(checkRateLimit)

const ENV = {
  COGNITO_CLIENT_ID: 'test-client-id',
  COGNITO_CLIENT_SECRET: 'test-secret',
  COGNITO_ISSUER: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test',
}

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/auth/email/forgot-password', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  )
}

beforeEach(() => {
  for (const [key, value] of Object.entries(ENV)) {
    vi.stubEnv(key, value)
  }
  cognitoForgotPasswordMock.mockReset()
  checkRateLimitMock.mockReset()
  checkRateLimitMock.mockReturnValue({ allowed: true })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/auth/email/forgot-password', () => {
  it('starts the reset and returns ok', async () => {
    cognitoForgotPasswordMock.mockResolvedValue(undefined)

    const response = await post({ email: 't@e.com' })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(cognitoForgotPasswordMock).toHaveBeenCalledWith('t@e.com')
  })

  it('rejects a 503 when the pool is not configured', async () => {
    vi.stubEnv('COGNITO_CLIENT_ID', '')

    const response = await post({ email: 't@e.com' })

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ ok: false, code: 'not-configured' })
    expect(cognitoForgotPasswordMock).not.toHaveBeenCalled()
  })

  it('rejects invalid bodies with 400', async () => {
    for (const body of [{ email: 'nope' }, 'not json{{{']) {
      const response = await post(body)

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ ok: false, code: 'invalid-input' })
    }
    expect(cognitoForgotPasswordMock).not.toHaveBeenCalled()
  })

  it('still returns ok for an unknown email, to avoid enumeration', async () => {
    cognitoForgotPasswordMock.mockRejectedValue(new CognitoAuthError('invalid-credentials'))

    const response = await post({ email: 'nobody@e.com' })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('maps other failures normally', async () => {
    cognitoForgotPasswordMock.mockRejectedValue(new CognitoAuthError('too-many-attempts'))

    const response = await post({ email: 't@e.com' })

    expect(response.status).toBe(429)
    expect(await response.json()).toMatchObject({ ok: false, code: 'too-many-attempts' })
  })

  it('returns 429 without calling Cognito when the IP is rate limited', async () => {
    checkRateLimitMock.mockReturnValue({ allowed: false })

    const response = await post({ email: 't@e.com' })

    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({ ok: false, code: 'too-many-attempts' })
    expect(cognitoForgotPasswordMock).not.toHaveBeenCalled()
  })
})
