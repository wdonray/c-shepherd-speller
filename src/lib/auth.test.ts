import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import type { NextAuthOptions } from 'next-auth'
import type { Adapter } from 'next-auth/adapters'

/**
 * Regression test for the auth adapter wiring (see PROGRESS.md "C1
 * auth-adapter client bug report"). The v4-line DynamoDB adapter requires
 * the v2-style DynamoDBDocument client (.put/.get/.query/.delete/.update);
 * handing it the v3-style document client breaks every adapter operation
 * at runtime while typecheck/lint/build stay green. This test round-trips
 * the REAL adapter instance from authOptions so a client/adapter mismatch
 * can never merge green again.
 *
 * Requires DynamoDB Local running with tables created:
 *   DYNAMODB_ENDPOINT=http://localhost:8000 npm run create-tables
 */
describe('auth adapter wiring', () => {
  let authOptions: NextAuthOptions
  let adapter: Adapter

  beforeAll(async () => {
    vi.stubEnv('DYNAMODB_ENDPOINT', 'http://localhost:8000')
    vi.stubEnv('AUTH_DYNAMODB_REGION', 'us-east-1')
    // DynamoDB Local accepts any credentials, but they must look like real
    // AWS keys (the SDK validates the format).
    vi.stubEnv('AUTH_DYNAMODB_ID', 'AKIAIOSFODNN7EXAMPLE')
    vi.stubEnv('AUTH_DYNAMODB_SECRET', 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')
    vi.stubEnv('AUTH_TABLE_NAME', 'next-auth')
    ;({ authOptions } = await import('./auth'))
    expect(authOptions.adapter).toBeDefined()
    adapter = authOptions.adapter!
  })

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  it('uses Google as the only provider and the custom auth pages', () => {
    expect(authOptions.providers).toHaveLength(1)
    expect(authOptions.providers[0]).toMatchObject({ id: 'google', name: 'Google' })
    expect(authOptions.pages).toMatchObject({
      signIn: '/auth/signin',
      signOut: '/auth/signout',
      error: '/auth/error',
      verifyRequest: '/auth/verify-request',
    })
    expect(authOptions.session?.strategy).toBe('jwt')
  })

  it('round-trips the full sign-in data path', async () => {
    const email = `adapter-test-${Date.now()}@example.com`

    const user = await adapter.createUser!({
      name: 'Adapter Test',
      email,
      emailVerified: null,
      image: null,
    } as never)
    expect(user.id).toBeTruthy()

    await expect(adapter.getUser!(user.id)).resolves.toMatchObject({ email })
    await expect(adapter.getUserByEmail!(email)).resolves.toMatchObject({ id: user.id })

    await adapter.linkAccount!({
      userId: user.id,
      provider: 'google',
      type: 'oauth' as const,
      providerAccountId: 'google-test-123',
      access_token: 'fake',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'Bearer' as Lowercase<string>,
      scope: 'openid email profile',
      id_token: 'fake',
    })
    await expect(
      adapter.getUserByAccount!({ provider: 'google', providerAccountId: 'google-test-123' })
    ).resolves.toMatchObject({ id: user.id })

    const sessionToken = `sess-${Date.now()}`
    const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000)
    await adapter.createSession!({ sessionToken, userId: user.id, expires })
    await expect(adapter.getSessionAndUser!(sessionToken)).resolves.toMatchObject({
      user: { id: user.id },
    })
    await adapter.deleteSession!(sessionToken)
    await expect(adapter.getSessionAndUser!(sessionToken)).resolves.toBeNull()

    await adapter.deleteUser!(user.id)
    await expect(adapter.getUser!(user.id)).resolves.toBeNull()
  }, 30000)

  it('session callback adds the user id from the token', async () => {
    const session = { user: { name: 'T', email: 't@e.c' }, expires: '2999-01-01' }
    const result = await authOptions.callbacks?.session!({
      session: session as never,
      token: { sub: 'user-123' } as never,
      user: {} as never,
    } as never)
    expect((result as { user: { id: string } }).user.id).toBe('user-123')
  })

  it('session callback leaves sessions without a user alone', async () => {
    const session = { expires: '2999-01-01' }
    const result = await authOptions.callbacks?.session!({
      session: session as never,
      token: { sub: 'user-123' } as never,
      user: {} as never,
    } as never)
    expect(result).toEqual(session)
  })

  it('jwt callback copies the user id onto the token', async () => {
    const result = await authOptions.callbacks?.jwt!({
      token: {},
      user: { id: 'user-456' },
    } as never)
    expect((result as { sub: string }).sub).toBe('user-456')
  })

  it('jwt callback leaves the token alone without a user', async () => {
    const token = { sub: 'existing' }
    const result = await authOptions.callbacks?.jwt!({ token, user: undefined } as never)
    expect(result).toEqual(token)
  })
})
