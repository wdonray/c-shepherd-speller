import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CognitoAuthError } from '@/lib/cognito-auth'
import { POST } from './route'

vi.mock('@/lib/cognito-auth', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  cognitoConfirmSignUp: vi.fn(),
}))

const { cognitoConfirmSignUp } = await import('@/lib/cognito-auth')
const cognitoConfirmSignUpMock = vi.mocked(cognitoConfirmSignUp)

const ENV = {
  COGNITO_CLIENT_ID: 'test-client-id',
  COGNITO_CLIENT_SECRET: 'test-secret',
  COGNITO_ISSUER: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test',
}

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/auth/email/verify', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  )
}

beforeEach(() => {
  for (const [key, value] of Object.entries(ENV)) {
    vi.stubEnv(key, value)
  }
  cognitoConfirmSignUpMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/auth/email/verify', () => {
  it('confirms the account and returns ok', async () => {
    cognitoConfirmSignUpMock.mockResolvedValue(undefined)

    const response = await post({ email: 't@e.com', code: '123456' })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(cognitoConfirmSignUpMock).toHaveBeenCalledWith('t@e.com', '123456')
  })

  it('rejects a 503 when the pool is not configured', async () => {
    vi.stubEnv('COGNITO_CLIENT_ID', '')

    const response = await post({ email: 't@e.com', code: '123456' })

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ ok: false, code: 'not-configured' })
    expect(cognitoConfirmSignUpMock).not.toHaveBeenCalled()
  })

  it('rejects invalid bodies with 400', async () => {
    for (const body of [{}, { email: 't@e.com' }, { email: 'nope', code: '123456' }, 'not json{{{']) {
      const response = await post(body)
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ ok: false, code: 'invalid-input' })
    }
    expect(cognitoConfirmSignUpMock).not.toHaveBeenCalled()
  })

  it('maps a wrong code to 400', async () => {
    cognitoConfirmSignUpMock.mockRejectedValue(new CognitoAuthError('invalid-code'))

    const response = await post({ email: 't@e.com', code: '000000' })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ ok: false, code: 'invalid-code' })
  })

  it('maps an expired code to 410', async () => {
    cognitoConfirmSignUpMock.mockRejectedValue(new CognitoAuthError('expired-code'))

    const response = await post({ email: 't@e.com', code: '000000' })

    expect(response.status).toBe(410)
    expect(await response.json()).toMatchObject({ ok: false, code: 'expired-code' })
  })
})
