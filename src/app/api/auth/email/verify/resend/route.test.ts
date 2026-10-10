import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CognitoAuthError } from '@/lib/cognito-auth'
import { POST } from './route'

vi.mock('@/lib/cognito-auth', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  cognitoResendConfirmationCode: vi.fn(),
}))

const { cognitoResendConfirmationCode } = await import('@/lib/cognito-auth')
const cognitoResendConfirmationCodeMock = vi.mocked(cognitoResendConfirmationCode)

const ENV = {
  COGNITO_CLIENT_ID: 'test-client-id',
  COGNITO_CLIENT_SECRET: 'test-secret',
  COGNITO_ISSUER: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test',
}

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/auth/email/verify/resend', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  )
}

beforeEach(() => {
  for (const [key, value] of Object.entries(ENV)) {
    vi.stubEnv(key, value)
  }
  cognitoResendConfirmationCodeMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/auth/email/verify/resend', () => {
  it('resends the code and returns ok', async () => {
    cognitoResendConfirmationCodeMock.mockResolvedValue(undefined)

    const response = await post({ email: 't@e.com' })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(cognitoResendConfirmationCodeMock).toHaveBeenCalledWith('t@e.com')
  })

  it('rejects a 503 when the pool is not configured', async () => {
    vi.stubEnv('COGNITO_CLIENT_ID', '')

    const response = await post({ email: 't@e.com' })

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ ok: false, code: 'not-configured' })
    expect(cognitoResendConfirmationCodeMock).not.toHaveBeenCalled()
  })

  it('rejects invalid bodies with 400', async () => {
    for (const body of [{ email: 'nope' }, 'not json{{{']) {
      const response = await post(body)

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ ok: false, code: 'invalid-input' })
    }
    expect(cognitoResendConfirmationCodeMock).not.toHaveBeenCalled()
  })

  it('maps rate limiting to 429', async () => {
    cognitoResendConfirmationCodeMock.mockRejectedValue(new CognitoAuthError('too-many-attempts'))

    const response = await post({ email: 't@e.com' })

    expect(response.status).toBe(429)
    expect(await response.json()).toMatchObject({ ok: false, code: 'too-many-attempts' })
  })
})
