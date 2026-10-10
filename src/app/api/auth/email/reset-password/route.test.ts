import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CognitoAuthError } from '@/lib/cognito-auth'
import { POST } from './route'

vi.mock('@/lib/cognito-auth', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  cognitoResetPassword: vi.fn(),
}))
vi.mock('@/lib/antibot', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  checkRateLimit: vi.fn(() => ({ allowed: true })),
  getClientIp: vi.fn(() => '9.9.9.9'),
}))

const { cognitoResetPassword } = await import('@/lib/cognito-auth')
const cognitoResetPasswordMock = vi.mocked(cognitoResetPassword)
const { checkRateLimit } = await import('@/lib/antibot')
const checkRateLimitMock = vi.mocked(checkRateLimit)

const ENV = {
  COGNITO_CLIENT_ID: 'test-client-id',
  COGNITO_CLIENT_SECRET: 'test-secret',
  COGNITO_ISSUER: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test',
}

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/auth/email/reset-password', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  )
}

beforeEach(() => {
  for (const [key, value] of Object.entries(ENV)) {
    vi.stubEnv(key, value)
  }
  cognitoResetPasswordMock.mockReset()
  checkRateLimitMock.mockReset()
  checkRateLimitMock.mockReturnValue({ allowed: true })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/auth/email/reset-password', () => {
  it('resets the password and returns ok', async () => {
    cognitoResetPasswordMock.mockResolvedValue(undefined)

    const response = await post({ email: 't@e.com', code: '123456', newPassword: 'N3w!password' })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(cognitoResetPasswordMock).toHaveBeenCalledWith('t@e.com', '123456', 'N3w!password')
  })

  it('rejects a 503 when the pool is not configured', async () => {
    vi.stubEnv('COGNITO_CLIENT_ID', '')

    const response = await post({ email: 't@e.com', code: '123456', newPassword: 'N3w!password' })

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ ok: false, code: 'not-configured' })
    expect(cognitoResetPasswordMock).not.toHaveBeenCalled()
  })

  it('rejects invalid bodies with 400', async () => {
    for (const body of [
      { email: 't@e.com', code: '123456', newPassword: 'short' },
      { email: 't@e.com', code: '123456' },
      'not json{{{',
    ]) {
      const response = await post(body)
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ ok: false, code: 'invalid-input' })
    }
    expect(cognitoResetPasswordMock).not.toHaveBeenCalled()
  })

  it('maps a wrong code to 400', async () => {
    cognitoResetPasswordMock.mockRejectedValue(new CognitoAuthError('invalid-code'))

    const response = await post({ email: 't@e.com', code: '000000', newPassword: 'N3w!password' })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ ok: false, code: 'invalid-code' })
  })

  it('maps a weak replacement password to 400', async () => {
    cognitoResetPasswordMock.mockRejectedValue(new CognitoAuthError('weak-password'))

    const response = await post({ email: 't@e.com', code: '123456', newPassword: 'N3w!password' })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ ok: false, code: 'weak-password' })
  })

  it('returns 429 without calling Cognito when the IP is rate limited', async () => {
    checkRateLimitMock.mockReturnValue({ allowed: false })

    const response = await post({ email: 't@e.com', code: '123456', newPassword: 'N3w!passw' })

    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({ ok: false, code: 'too-many-attempts' })
    expect(cognitoResetPasswordMock).not.toHaveBeenCalled()
  })
})
