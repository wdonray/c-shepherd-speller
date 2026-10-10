import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  CognitoAuthError,
  COGNITO_ERROR_MESSAGES,
  computeSecretHash,
  cognitoConfirmSignUp,
  cognitoDeleteUser,
  cognitoForgotPassword,
  cognitoResendConfirmationCode,
  cognitoResetPassword,
  cognitoSignIn,
  cognitoSignUp,
  cognitoVerifyPassword,
  isCognitoEmailAuthConfigured,
  parseCognitoRegion,
  toCognitoAuthError,
  type CognitoErrorCode,
  type CognitoIdpClient,
} from './cognito-auth'

const ENV = {
  COGNITO_CLIENT_ID: 'test-client-id',
  COGNITO_CLIENT_SECRET: 'test-secret',
  COGNITO_ISSUER: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test',
}

function mockClient() {
  const send = vi.fn()
  return { send, client: { send } as unknown as CognitoIdpClient }
}

function sdkError(name: string) {
  const error = new Error(name)
  error.name = name
  return error
}

function fakeIdToken(payload: unknown): string {
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${b64({ alg: 'none' })}.${b64(payload)}.sig`
}

beforeEach(() => {
  for (const [key, value] of Object.entries(ENV)) {
    vi.stubEnv(key, value)
  }
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('computeSecretHash', () => {
  it('matches the known HMAC-SHA256 test vector', () => {
    expect(computeSecretHash('teacher@example.com', 'test-client-id', 'test-secret')).toBe(
      'ubMq12ua7Sob8EJy4crIRzaQLGUIELfDWkbXBRqlgVw='
    )
  })
})

describe('CognitoAuthError', () => {
  it('carries the code and the default user-facing message', () => {
    const error = new CognitoAuthError('invalid-code')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('CognitoAuthError')
    expect(error.code).toBe('invalid-code')
    expect(error.message).toBe(COGNITO_ERROR_MESSAGES['invalid-code'])
  })

  it('accepts an explicit message override', () => {
    const error = new CognitoAuthError('server-error', 'custom')
    expect(error.message).toBe('custom')
    expect(error.code).toBe('server-error')
  })
})

describe('toCognitoAuthError', () => {
  it('passes CognitoAuthError through untouched', () => {
    const original = new CognitoAuthError('expired-code')
    expect(toCognitoAuthError(original)).toBe(original)
  })

  it.each<[string, CognitoErrorCode]>([
    ['NotAuthorizedException', 'invalid-credentials'],
    ['UserNotFoundException', 'invalid-credentials'],
    ['UserNotConfirmedException', 'not-confirmed'],
    ['UsernameExistsException', 'email-in-use'],
    ['CodeMismatchException', 'invalid-code'],
    ['ExpiredCodeException', 'expired-code'],
    ['InvalidPasswordException', 'weak-password'],
    ['TooManyRequestsException', 'too-many-attempts'],
    ['LimitExceededException', 'too-many-attempts'],
    ['InvalidParameterException', 'invalid-input'],
  ])('maps %s to %s with user-safe copy', (name, code) => {
    const error = toCognitoAuthError(sdkError(name))
    expect(error).toBeInstanceOf(CognitoAuthError)
    expect(error.code).toBe(code)
    expect(error.message).toBe(COGNITO_ERROR_MESSAGES[code])
    // The raw SDK message never leaks to the user.
    expect(error.message).not.toContain(name)
  })

  it('maps unknown failures to server-error', () => {
    expect(toCognitoAuthError(sdkError('SomethingWeirdHappened')).code).toBe('server-error')
    expect(toCognitoAuthError(new Error('plain')).code).toBe('server-error')
    expect(toCognitoAuthError(null).code).toBe('server-error')
    expect(toCognitoAuthError('a string').code).toBe('server-error')
  })
})

describe('isCognitoEmailAuthConfigured', () => {
  it('is true when all three env vars are set', () => {
    expect(isCognitoEmailAuthConfigured()).toBe(true)
  })

  it('is false when any env var is missing', () => {
    vi.stubEnv('COGNITO_CLIENT_SECRET', '')
    expect(isCognitoEmailAuthConfigured()).toBe(false)
  })
})

describe('cognitoSignIn', () => {
  it('returns the user identity from a valid ID token', async () => {
    const { send, client } = mockClient()
    const idToken = fakeIdToken({ sub: 'cognito-sub-1', email: 'Teacher@Example.com', name: 'Chaley' })
    send.mockResolvedValue({ AuthenticationResult: { IdToken: idToken } })

    const user = await cognitoSignIn('Teacher@Example.com', 's3cret-pass', client)

    expect(user).toEqual({ sub: 'cognito-sub-1', email: 'Teacher@Example.com', name: 'Chaley' })
    const command = send.mock.calls[0][0]
    expect(command.input.AuthFlow).toBe('USER_PASSWORD_AUTH')
    expect(command.input.ClientId).toBe(ENV.COGNITO_CLIENT_ID)
    // The username is normalized so sign-in is not case-sensitive.
    expect(command.input.AuthParameters.USERNAME).toBe('teacher@example.com')
    expect(command.input.AuthParameters.PASSWORD).toBe('s3cret-pass')
    expect(command.input.AuthParameters.SECRET_HASH).toBe(
      computeSecretHash('teacher@example.com', ENV.COGNITO_CLIENT_ID, ENV.COGNITO_CLIENT_SECRET)
    )
  })

  it('falls back to the normalized email and null name when the token lacks them', async () => {
    const { send, client } = mockClient()
    send.mockResolvedValue({ AuthenticationResult: { IdToken: fakeIdToken({ sub: 'sub-only' }) } })

    const user = await cognitoSignIn('teacher@example.com', 'pw', client)

    expect(user).toEqual({ sub: 'sub-only', email: 'teacher@example.com', name: null })
  })

  it('rejects when Cognito presents an unexpected challenge', async () => {
    const { send, client } = mockClient()
    send.mockResolvedValue({ ChallengeName: 'NEW_PASSWORD_REQUIRED', Session: 'sess' })

    await expect(cognitoSignIn('t@e.com', 'pw', client)).rejects.toMatchObject({ code: 'server-error' })
  })

  it('rejects when there is no ID token', async () => {
    const { send, client } = mockClient()
    send.mockResolvedValue({ AuthenticationResult: {} })

    await expect(cognitoSignIn('t@e.com', 'pw', client)).rejects.toMatchObject({ code: 'server-error' })
  })

  it.each([['not-a-jwt'], ['a.b'], ['a.W10=.c']])('rejects malformed ID token %s', async (token) => {
    const { send, client } = mockClient()
    send.mockResolvedValue({ AuthenticationResult: { IdToken: token } })

    await expect(cognitoSignIn('t@e.com', 'pw', client)).rejects.toMatchObject({ code: 'server-error' })
  })

  it('rejects an ID token without a usable sub', async () => {
    const { send, client } = mockClient()
    send.mockResolvedValue({ AuthenticationResult: { IdToken: fakeIdToken({ sub: 42 }) } })

    await expect(cognitoSignIn('t@e.com', 'pw', client)).rejects.toMatchObject({ code: 'server-error' })
  })

  it('maps SDK failures to user-safe errors', async () => {
    const { send, client } = mockClient()
    send.mockRejectedValue(sdkError('NotAuthorizedException'))

    await expect(cognitoSignIn('t@e.com', 'wrong', client)).rejects.toMatchObject({
      code: 'invalid-credentials',
      message: COGNITO_ERROR_MESSAGES['invalid-credentials'],
    })
  })

  it('maps an unconfirmed user to not-confirmed', async () => {
    const { send, client } = mockClient()
    send.mockRejectedValue(sdkError('UserNotConfirmedException'))

    await expect(cognitoSignIn('t@e.com', 'pw', client)).rejects.toMatchObject({ code: 'not-confirmed' })
  })

  it('throws not-configured when the pool is not set up', async () => {
    const { client } = mockClient()
    vi.stubEnv('COGNITO_CLIENT_ID', '')

    await expect(cognitoSignIn('t@e.com', 'pw', client)).rejects.toMatchObject({ code: 'not-configured' })
  })
})

describe('cognitoSignUp', () => {
  it('registers the user with email and name attributes', async () => {
    const { send, client } = mockClient()
    send.mockResolvedValue({ UserConfirmed: false, UserSub: 'new-sub' })

    const result = await cognitoSignUp(' Chaley ', 'Teacher@Example.com', 'S3cure!pass', client)

    expect(result).toEqual({ userConfirmed: false })
    const command = send.mock.calls[0][0]
    expect(command.input.Username).toBe('teacher@example.com')
    expect(command.input.Password).toBe('S3cure!pass')
    expect(command.input.SecretHash).toBe(
      computeSecretHash('teacher@example.com', ENV.COGNITO_CLIENT_ID, ENV.COGNITO_CLIENT_SECRET)
    )
    expect(command.input.UserAttributes).toEqual([
      { Name: 'email', Value: 'teacher@example.com' },
      { Name: 'name', Value: 'Chaley' },
    ])
  })

  it('reports an already-confirmed user', async () => {
    const { send, client } = mockClient()
    send.mockResolvedValue({ UserConfirmed: true })

    await expect(cognitoSignUp('N', 't@e.com', 'pw', client)).resolves.toEqual({ userConfirmed: true })
  })

  it('defaults a missing UserConfirmed flag to false', async () => {
    const { send, client } = mockClient()
    send.mockResolvedValue({})

    await expect(cognitoSignUp('N', 't@e.com', 'pw', client)).resolves.toEqual({ userConfirmed: false })
  })

  it('maps a duplicate email to email-in-use', async () => {
    const { send, client } = mockClient()
    send.mockRejectedValue(sdkError('UsernameExistsException'))

    await expect(cognitoSignUp('N', 't@e.com', 'pw', client)).rejects.toMatchObject({ code: 'email-in-use' })
  })

  it('maps a policy violation to weak-password', async () => {
    const { send, client } = mockClient()
    send.mockRejectedValue(sdkError('InvalidPasswordException'))

    await expect(cognitoSignUp('N', 't@e.com', 'weak', client)).rejects.toMatchObject({ code: 'weak-password' })
  })
})

describe('cognitoConfirmSignUp', () => {
  it('confirms with the trimmed code', async () => {
    const { send, client } = mockClient()
    send.mockResolvedValue({})

    await cognitoConfirmSignUp('Teacher@Example.com', ' 123456 ', client)

    const command = send.mock.calls[0][0]
    expect(command.input.Username).toBe('teacher@example.com')
    expect(command.input.ConfirmationCode).toBe('123456')
    expect(command.input.SecretHash).toBe(
      computeSecretHash('teacher@example.com', ENV.COGNITO_CLIENT_ID, ENV.COGNITO_CLIENT_SECRET)
    )
  })

  it('maps a wrong code to invalid-code', async () => {
    const { send, client } = mockClient()
    send.mockRejectedValue(sdkError('CodeMismatchException'))

    await expect(cognitoConfirmSignUp('t@e.com', '000000', client)).rejects.toMatchObject({
      code: 'invalid-code',
    })
  })

  it('maps an old code to expired-code', async () => {
    const { send, client } = mockClient()
    send.mockRejectedValue(sdkError('ExpiredCodeException'))

    await expect(cognitoConfirmSignUp('t@e.com', '000000', client)).rejects.toMatchObject({
      code: 'expired-code',
    })
  })
})

describe('cognitoResendConfirmationCode', () => {
  it('resends to the normalized email', async () => {
    const { send, client } = mockClient()
    send.mockResolvedValue({})

    await cognitoResendConfirmationCode('Teacher@Example.com', client)

    expect(send.mock.calls[0][0].input.Username).toBe('teacher@example.com')
  })

  it('maps rate limiting to too-many-attempts', async () => {
    const { send, client } = mockClient()
    send.mockRejectedValue(sdkError('LimitExceededException'))

    await expect(cognitoResendConfirmationCode('t@e.com', client)).rejects.toMatchObject({
      code: 'too-many-attempts',
    })
  })
})

describe('cognitoForgotPassword', () => {
  it('starts the reset for the normalized email', async () => {
    const { send, client } = mockClient()
    send.mockResolvedValue({})

    await cognitoForgotPassword('Teacher@Example.com', client)

    expect(send.mock.calls[0][0].input.Username).toBe('teacher@example.com')
  })

  it('maps failures to user-safe errors', async () => {
    const { send, client } = mockClient()
    send.mockRejectedValue(sdkError('TooManyRequestsException'))

    await expect(cognitoForgotPassword('t@e.com', client)).rejects.toMatchObject({
      code: 'too-many-attempts',
    })
  })
})

describe('cognitoResetPassword', () => {
  it('confirms with the code and the new password', async () => {
    const { send, client } = mockClient()
    send.mockResolvedValue({})

    await cognitoResetPassword('t@e.com', '123456', 'N3w!password', client)

    const command = send.mock.calls[0][0]
    expect(command.input.Username).toBe('t@e.com')
    expect(command.input.ConfirmationCode).toBe('123456')
    expect(command.input.Password).toBe('N3w!password')
  })

  it('maps a weak replacement password to weak-password', async () => {
    const { send, client } = mockClient()
    send.mockRejectedValue(sdkError('InvalidPasswordException'))

    await expect(cognitoResetPassword('t@e.com', '123456', 'weak', client)).rejects.toMatchObject({
      code: 'weak-password',
    })
  })
})

describe('parseCognitoRegion', () => {
  it('extracts the region from a cognito-idp issuer URL', () => {
    expect(parseCognitoRegion('https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_abc')).toBe('eu-west-1')
  })

  it('falls back to us-east-1 for anything else', () => {
    expect(parseCognitoRegion('not-a-cognito-url')).toBe('us-east-1')
    expect(parseCognitoRegion('')).toBe('us-east-1')
  })
})

describe('default client construction', () => {
  it('builds and caches a real SDK client when none is injected', async () => {
    // Constructing the client performs no network I/O; send() then fails
    // while resolving credentials, which surfaces as a CognitoAuthError.
    // The second call exercises the cache hit.
    await expect(cognitoSignUp('N', 't@e.com', 'S3cure!pass')).rejects.toBeInstanceOf(CognitoAuthError)
    await expect(cognitoSignUp('N', 't@e.com', 'S3cure!pass')).rejects.toBeInstanceOf(CognitoAuthError)
  })
})

describe('cognitoVerifyPassword', () => {
  it('returns the access token when the password is correct', async () => {
    const { send, client } = mockClient()
    send.mockResolvedValue({ AuthenticationResult: { AccessToken: 'token-123' } })
    await expect(cognitoVerifyPassword('t@e.com', 'S3cure!pass', client)).resolves.toBe('token-123')
    const command = send.mock.calls[0][0]
    expect(command.input.AuthFlow).toBe('USER_PASSWORD_AUTH')
    expect(command.input.AuthParameters.USERNAME).toBe('t@e.com')
  })

  it('throws invalid-credentials for a wrong password', async () => {
    const { send, client } = mockClient()
    send.mockRejectedValue(sdkError('NotAuthorizedException'))
    const error = await cognitoVerifyPassword('t@e.com', 'wrong', client).catch((e) => e)
    expect(error).toBeInstanceOf(CognitoAuthError)
    expect(error.code).toBe('invalid-credentials')
  })

  it('throws server-error when Cognito issues a challenge', async () => {
    const { send, client } = mockClient()
    send.mockResolvedValue({ ChallengeName: 'NEW_PASSWORD_REQUIRED' })
    const error = await cognitoVerifyPassword('t@e.com', 'S3cure!pass', client).catch((e) => e)
    expect(error).toBeInstanceOf(CognitoAuthError)
    expect(error.code).toBe('server-error')
  })

  it('throws server-error when no access token is returned', async () => {
    const { send, client } = mockClient()
    send.mockResolvedValue({ AuthenticationResult: {} })
    const error = await cognitoVerifyPassword('t@e.com', 'S3cure!pass', client).catch((e) => e)
    expect(error).toBeInstanceOf(CognitoAuthError)
    expect(error.code).toBe('server-error')
  })
})

describe('cognitoDeleteUser', () => {
  it('deletes the user with the access token', async () => {
    const { send, client } = mockClient()
    send.mockResolvedValue({})
    await expect(cognitoDeleteUser('token-123', client)).resolves.toBeUndefined()
    expect(send.mock.calls[0][0].input).toEqual({ AccessToken: 'token-123' })
  })

  it('treats an already-deleted user as success', async () => {
    const { send, client } = mockClient()
    send.mockRejectedValue(sdkError('UserNotFoundException'))
    await expect(cognitoDeleteUser('token-123', client)).resolves.toBeUndefined()
  })

  it('maps other failures to CognitoAuthError', async () => {
    const { send, client } = mockClient()
    send.mockRejectedValue(sdkError('TooManyRequestsException'))
    const error = await cognitoDeleteUser('token-123', client).catch((e) => e)
    expect(error).toBeInstanceOf(CognitoAuthError)
    expect(error.code).toBe('too-many-attempts')
  })
})
