import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Session } from 'next-auth'

const { requireSession } = vi.hoisted(() => ({ requireSession: vi.fn() }))
vi.mock('@/lib/require-auth', () => ({ requireSession }))

const { getUserByEmail } = vi.hoisted(() => ({ getUserByEmail: vi.fn() }))
vi.mock('@/lib/db-utils', () => ({ getUserByEmail }))

const { getListsByUser } = vi.hoisted(() => ({ getListsByUser: vi.fn() }))
vi.mock('@/lib/lists-db', () => ({ getListsByUser }))

const { checkRateLimit, getClientIp, rateLimitedResponse } = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  rateLimitedResponse: vi.fn(),
}))
vi.mock('@/lib/antibot', () => ({ checkRateLimit, getClientIp, rateLimitedResponse }))

const { cognitoVerifyPassword, cognitoDeleteUser, CognitoAuthError } = vi.hoisted(() => ({
  cognitoVerifyPassword: vi.fn(),
  cognitoDeleteUser: vi.fn(),
  CognitoAuthError: class extends Error {
    code: string
    constructor(code: string) {
      super(code)
      this.code = code
    }
  },
}))
vi.mock('@/lib/cognito-auth', () => ({ cognitoVerifyPassword, cognitoDeleteUser, CognitoAuthError }))

const { getAccountProviders, deleteAppUser, deleteAuthRecords, deleteUserLists } = vi.hoisted(() => ({
  getAccountProviders: vi.fn(),
  deleteAppUser: vi.fn(),
  deleteAuthRecords: vi.fn(),
  deleteUserLists: vi.fn(),
}))
vi.mock('@/lib/account-deletion', () => ({
  COGNITO_PROVIDERS: ['cognito', 'email-password'],
  getAccountProviders,
  deleteAppUser,
  deleteAuthRecords,
  deleteUserLists,
}))

vi.mock('@/lib/report-error', () => ({ reportError: vi.fn() }))

// Imported after the mocks so the route binds to them.
import { GET, DELETE } from './route'

const SESSION = {
  user: { id: 'sub-1', email: 'teacher@example.com', name: 'Teacher' },
  expires: '2999-01-01',
} as Session

function authed() {
  requireSession.mockResolvedValue({ session: SESSION, response: null })
}

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest('https://example.com/api/account', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe('GET /api/account', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without a session', async () => {
    const denied = Response.json({ error: 'Unauthorized' }, { status: 401 })
    requireSession.mockResolvedValue({ session: null, response: denied })
    const response = await GET(makeRequest('GET'))
    expect(response.status).toBe(401)
  })

  it('returns providers, list count, and password requirement', async () => {
    authed()
    getAccountProviders.mockResolvedValue(['email-password'])
    getUserByEmail.mockResolvedValue({ id: 'abc-user', email: 'teacher@example.com' })
    getListsByUser.mockResolvedValue([{ id: 'l1' }, { id: 'l2' }])
    const response = await GET(makeRequest('GET'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      email: 'teacher@example.com',
      providers: ['email-password'],
      listCount: 2,
      requiresPassword: true,
    })
  })

  it('reports no password requirement for Google-only accounts', async () => {
    authed()
    getAccountProviders.mockResolvedValue(['google'])
    getUserByEmail.mockResolvedValue({ id: 'abc-user', email: 'teacher@example.com' })
    getListsByUser.mockResolvedValue([])
    const response = await GET(makeRequest('GET'))
    expect(await response.json()).toMatchObject({ listCount: 0, requiresPassword: false })
  })

  it('handles a missing app user record', async () => {
    authed()
    getAccountProviders.mockResolvedValue(['google'])
    getUserByEmail.mockResolvedValue(undefined)
    const response = await GET(makeRequest('GET'))
    expect(await response.json()).toMatchObject({ listCount: 0 })
    expect(getListsByUser).not.toHaveBeenCalled()
  })

  it('returns 500 when the lookup fails', async () => {
    authed()
    getAccountProviders.mockRejectedValue(new Error('db down'))
    const response = await GET(makeRequest('GET'))
    expect(response.status).toBe(500)
  })
})

describe('DELETE /api/account', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimit.mockReturnValue({ allowed: true })
    getClientIp.mockReturnValue('1.2.3.4')
  })

  it('returns 429 when rate limited', async () => {
    checkRateLimit.mockReturnValue({ allowed: false })
    rateLimitedResponse.mockReturnValue(Response.json({ error: 'slow down' }, { status: 429 }))
    const response = await DELETE(makeRequest('DELETE', { email: 'teacher@example.com' }))
    expect(response.status).toBe(429)
    expect(requireSession).not.toHaveBeenCalled()
  })

  it('returns 401 without a session', async () => {
    const denied = Response.json({ error: 'Unauthorized' }, { status: 401 })
    requireSession.mockResolvedValue({ session: null, response: denied })
    const response = await DELETE(makeRequest('DELETE', { email: 'teacher@example.com' }))
    expect(response.status).toBe(401)
  })

  it('rejects a mistyped confirmation email', async () => {
    authed()
    const response = await DELETE(makeRequest('DELETE', { email: 'someone@else.com' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'email-mismatch' })
    expect(deleteAppUser).not.toHaveBeenCalled()
  })

  it('rejects when the confirmation email is missing or not a string', async () => {
    authed()
    const response = await DELETE(makeRequest('DELETE', {}))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'email-mismatch' })
    expect(deleteAppUser).not.toHaveBeenCalled()
  })

  it('deletes everything for a Google account without a password', async () => {
    authed()
    getAccountProviders.mockResolvedValue(['google'])
    getUserByEmail.mockResolvedValue({ id: 'abc-user', email: 'teacher@example.com' })
    const response = await DELETE(makeRequest('DELETE', { email: 'TEACHER@example.com' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(deleteUserLists).toHaveBeenCalledWith('abc-user')
    expect(deleteAppUser).toHaveBeenCalledWith('abc-user')
    expect(deleteAuthRecords).toHaveBeenCalledWith('sub-1')
    expect(cognitoVerifyPassword).not.toHaveBeenCalled()
    expect(cognitoDeleteUser).not.toHaveBeenCalled()
  })

  it('requires a password for Cognito accounts', async () => {
    authed()
    getAccountProviders.mockResolvedValue(['email-password'])
    const response = await DELETE(makeRequest('DELETE', { email: 'teacher@example.com' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'password-required' })
    expect(deleteAppUser).not.toHaveBeenCalled()
  })

  it('returns 401 for a wrong password and deletes nothing', async () => {
    authed()
    getAccountProviders.mockResolvedValue(['email-password'])
    cognitoVerifyPassword.mockRejectedValue(new CognitoAuthError('invalid-credentials'))
    const response = await DELETE(makeRequest('DELETE', { email: 'teacher@example.com', password: 'wrong' }))
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ code: 'invalid-credentials' })
    expect(deleteAppUser).not.toHaveBeenCalled()
    expect(deleteAuthRecords).not.toHaveBeenCalled()
  })

  it('deletes the Cognito user after app data for email accounts', async () => {
    authed()
    getAccountProviders.mockResolvedValue(['cognito'])
    getUserByEmail.mockResolvedValue({ id: 'abc-user', email: 'teacher@example.com' })
    cognitoVerifyPassword.mockResolvedValue('access-token')
    cognitoDeleteUser.mockResolvedValue(undefined)
    const response = await DELETE(makeRequest('DELETE', { email: 'teacher@example.com', password: 'S3cure!pass' }))
    expect(response.status).toBe(200)
    expect(cognitoVerifyPassword).toHaveBeenCalledWith('teacher@example.com', 'S3cure!pass')
    // Cognito deletion happens after the app data is gone.
    const appDeleteOrder = deleteAppUser.mock.invocationCallOrder[0]
    const cognitoDeleteOrder = cognitoDeleteUser.mock.invocationCallOrder[0]
    expect(appDeleteOrder).toBeLessThan(cognitoDeleteOrder)
    expect(cognitoDeleteUser).toHaveBeenCalledWith('access-token')
  })

  it('still deletes adapter records when there is no app user record', async () => {
    authed()
    getAccountProviders.mockResolvedValue(['google'])
    getUserByEmail.mockResolvedValue(undefined)
    const response = await DELETE(makeRequest('DELETE', { email: 'teacher@example.com' }))
    expect(response.status).toBe(200)
    expect(deleteUserLists).not.toHaveBeenCalled()
    expect(deleteAuthRecords).toHaveBeenCalledWith('sub-1')
  })

  it('returns 500 when password verification fails unexpectedly', async () => {
    authed()
    getAccountProviders.mockResolvedValue(['email-password'])
    cognitoVerifyPassword.mockRejectedValue(new Error('network down'))
    const response = await DELETE(makeRequest('DELETE', { email: 'teacher@example.com', password: 'S3cure!pass' }))
    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ code: 'server-error' })
    expect(deleteAppUser).not.toHaveBeenCalled()
  })

  it('returns 500 when deletion fails midway', async () => {
    authed()
    getAccountProviders.mockResolvedValue(['google'])
    getUserByEmail.mockResolvedValue({ id: 'abc-user', email: 'teacher@example.com' })
    deleteUserLists.mockRejectedValue(new Error('db down'))
    const response = await DELETE(makeRequest('DELETE', { email: 'teacher@example.com' }))
    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ code: 'server-error' })
  })
})
