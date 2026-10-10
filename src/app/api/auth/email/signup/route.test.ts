import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CognitoAuthError } from '@/lib/cognito-auth'
import { POST } from './route'

vi.mock('@/lib/cognito-auth', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  cognitoSignUp: vi.fn(),
}))

const { cognitoSignUp } = await import('@/lib/cognito-auth')
const cognitoSignUpMock = vi.mocked(cognitoSignUp)

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
    expect(cognitoSignUpMock).toHaveBeenCalledWith('Chaley', 't@e.com', 'S3cure!pass')
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
})
