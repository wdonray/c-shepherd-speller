import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import type { Session } from 'next-auth'

const { requireSession, isSelfEmail } = vi.hoisted(() => ({
  requireSession: vi.fn(),
  requireOwnership: vi.fn(),
  isSelfEmail: vi.fn(),
}))
vi.mock('@/lib/require-auth', () => ({ requireSession, requireOwnership: vi.fn(), isSelfEmail }))

const { createUser, getUserByEmail } = vi.hoisted(() => ({
  createUser: vi.fn(),
  getUserByEmail: vi.fn(),
  updateUser: vi.fn(),
  getUserById: vi.fn(),
  getUserSpellingData: vi.fn(),
  updateUserSpellingData: vi.fn(),
  updateUserLastActive: vi.fn(),
}))
vi.mock('@/lib/db-utils', () => ({
  createUser,
  getUserByEmail,
  updateUser: vi.fn(),
  getUserById: vi.fn(),
  getUserSpellingData: vi.fn(),
  updateUserSpellingData: vi.fn(),
  updateUserLastActive: vi.fn(),
}))

// Imported after the mocks so the routes bind to them.
import { POST, GET } from './route'

const SESSION = {
  user: { email: 'teacher@example.com', name: 'Teacher' },
  expires: '2999-01-01',
} as Session

function ok() {
  requireSession.mockResolvedValue({ session: SESSION, response: null })
  isSelfEmail.mockReturnValue(true)
}

function unauthorized() {
  requireSession.mockResolvedValue({
    session: null,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  })
}

describe('POST /api/users', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    ok()
  })

  it('returns 401 when there is no session', async () => {
    unauthorized()
    const res = await POST(new NextRequest('http://localhost/api/users'))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns 400 when email is missing', async () => {
    const req = new NextRequest('http://localhost/api/users', {
      method: 'POST',
      body: JSON.stringify({ name: 'Teacher' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Email and name are required' })
  })

  it('returns 400 when name is missing', async () => {
    const req = new NextRequest('http://localhost/api/users', {
      method: 'POST',
      body: JSON.stringify({ email: 'teacher@example.com' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Email and name are required' })
  })

  it('returns 403 when creating a record for another email', async () => {
    isSelfEmail.mockReturnValue(false)
    const req = new NextRequest('http://localhost/api/users', {
      method: 'POST',
      body: JSON.stringify({ email: 'other@example.com', name: 'Other' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden' })
    expect(createUser).not.toHaveBeenCalled()
  })

  it('creates the user with default empty lists and returns 201', async () => {
    const user = { id: 'u1', email: 'teacher@example.com', name: 'Teacher' }
    createUser.mockResolvedValue(user)
    const req = new NextRequest('http://localhost/api/users', {
      method: 'POST',
      body: JSON.stringify({ email: 'teacher@example.com', name: 'Teacher' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(createUser).toHaveBeenCalledWith({
      email: 'teacher@example.com',
      name: 'Teacher',
      words: [],
      sounds: [],
      spelling: [],
    })
    const body = await res.json()
    expect(body.message).toBe('User created successfully')
    expect(body.user).toEqual(user)
  })

  it('creates the user with provided spelling lists', async () => {
    createUser.mockResolvedValue({ id: 'u1' })
    const req = new NextRequest('http://localhost/api/users', {
      method: 'POST',
      body: JSON.stringify({
        email: 'teacher@example.com',
        name: 'Teacher',
        words: ['cat'],
        sounds: ['a'],
        spelling: ['cat'],
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(createUser).toHaveBeenCalledWith({
      email: 'teacher@example.com',
      name: 'Teacher',
      words: ['cat'],
      sounds: ['a'],
      spelling: ['cat'],
    })
  })

  it('returns 500 when createUser throws', async () => {
    createUser.mockRejectedValue(new Error('db down'))
    const req = new NextRequest('http://localhost/api/users', {
      method: 'POST',
      body: JSON.stringify({ email: 'teacher@example.com', name: 'Teacher' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to create user' })
  })

  it('returns 500 when the request body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/users', {
      method: 'POST',
      body: '{not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to create user' })
  })
})

describe('GET /api/users', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    ok()
  })

  it('returns 401 when there is no session', async () => {
    unauthorized()
    const res = await GET(new NextRequest('http://localhost/api/users?email=teacher@example.com'))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns 400 when the email query param is missing', async () => {
    const res = await GET(new NextRequest('http://localhost/api/users'))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Email parameter is required' })
  })

  it('returns 403 when looking up another email', async () => {
    isSelfEmail.mockReturnValue(false)
    const res = await GET(new NextRequest('http://localhost/api/users?email=other@example.com'))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden' })
    expect(getUserByEmail).not.toHaveBeenCalled()
  })

  it('returns an empty user object when no record exists', async () => {
    getUserByEmail.mockResolvedValue(null)
    const res = await GET(new NextRequest('http://localhost/api/users?email=teacher@example.com'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ user: {} })
  })

  it('returns the user when a record exists', async () => {
    const user = { id: 'u1', email: 'teacher@example.com', name: 'Teacher' }
    getUserByEmail.mockResolvedValue(user)
    const res = await GET(new NextRequest('http://localhost/api/users?email=teacher@example.com'))
    expect(res.status).toBe(200)
    expect(getUserByEmail).toHaveBeenCalledWith('teacher@example.com')
    expect(await res.json()).toEqual({ user })
  })

  it('returns 500 when getUserByEmail throws', async () => {
    getUserByEmail.mockRejectedValue(new Error('db down'))
    const res = await GET(new NextRequest('http://localhost/api/users?email=teacher@example.com'))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to get user' })
  })
})
