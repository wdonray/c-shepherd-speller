import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CognitoAuthError } from './cognito-auth'
import { emailAuthErrorResponse, requireEmailAuth } from './email-auth-api'
import { reportError } from './report-error'

vi.mock('./report-error', () => ({ reportError: vi.fn() }))

const reportErrorMock = vi.mocked(reportError)

const ENV = {
  COGNITO_CLIENT_ID: 'test-client-id',
  COGNITO_CLIENT_SECRET: 'test-secret',
  COGNITO_ISSUER: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test',
}

beforeEach(() => {
  for (const [key, value] of Object.entries(ENV)) {
    vi.stubEnv(key, value)
  }
  reportErrorMock.mockClear()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('requireEmailAuth', () => {
  it('returns null when the pool is configured', () => {
    expect(requireEmailAuth()).toBeNull()
  })

  it('returns a 503 not-configured response otherwise', async () => {
    vi.stubEnv('COGNITO_CLIENT_ID', '')

    const response = requireEmailAuth()
    expect(response).not.toBeNull()
    expect(response!.status).toBe(503)
    expect(await response!.json()).toMatchObject({ ok: false, code: 'not-configured' })
  })
})

describe('emailAuthErrorResponse', () => {
  it('maps a Cognito failure to its status and user-safe copy', async () => {
    const response = emailAuthErrorResponse(new CognitoAuthError('invalid-code'), 'test-location')

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ ok: false, code: 'invalid-code' })
    expect(reportErrorMock).not.toHaveBeenCalled()
  })

  it('reports unexpected Cognito failures to Sentry', async () => {
    const error = new CognitoAuthError('server-error')
    const response = emailAuthErrorResponse(error, 'test-location')

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ ok: false, code: 'server-error' })
    expect(reportErrorMock).toHaveBeenCalledWith(error, { location: 'test-location' })
  })

  it('reports non-Cognito failures as 500s', async () => {
    const error = new Error('database exploded')
    const response = emailAuthErrorResponse(error, 'test-location')

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body).toMatchObject({ ok: false, code: 'server-error' })
    expect(body.message).not.toContain('database exploded')
    expect(reportErrorMock).toHaveBeenCalledWith(error, { location: 'test-location' })
  })
})
