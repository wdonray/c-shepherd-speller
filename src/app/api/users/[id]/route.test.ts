import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import type { Session } from 'next-auth'

const { requireOwnership } = vi.hoisted(() => ({
  requireSession: vi.fn(),
  requireOwnership: vi.fn(),
  isSelfEmail: vi.fn(),
}))
vi.mock('@/lib/require-auth', () => ({ requireOwnership }))

const { updateUser, getUserById } = vi.hoisted(() => ({
  createUser: vi.fn(),
  getUserByEmail: vi.fn(),
  updateUser: vi.fn(),
  getUserById: vi.fn(),
  getUserSpellingData: vi.fn(),
  updateUserSpellingData: vi.fn(),
  updateUserLastActive: vi.fn(),
}))
vi.mock('@/lib/db-utils', () => ({ updateUser, getUserById }))

// Imported after the mocks so the routes bind to them.
import { PUT, GET } from './route'

const SESSION = {
  user: { email: 'teacher@example.com', name: 'Teacher' },
  expires: '2999-01-01',
} as Session

const ID = 'abc'

function owned() {
  requireOwnership.mockResolvedValue({ session: SESSION, response: null })
}

function denied(status: 401 | 403) {
  requireOwnership.mockResolvedValue({
    session: null,
    response: NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status }),
  })
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('PUT /api/users/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    owned()
  })

  it('returns 401 when the session is missing', async () => {
    denied(401)
    const req = new NextRequest(`http://localhost/api/users/${ID}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'T' }),
    })
    const res = await PUT(req, ctx(ID))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('returns 403 when the caller does not own the record', async () => {
    denied(403)
    const req = new NextRequest(`http://localhost/api/users/${ID}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'T' }),
    })
    const res = await PUT(req, ctx(ID))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden' })
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('returns 400 when the id is empty', async () => {
    const req = new NextRequest('http://localhost/api/users/', {
      method: 'PUT',
      body: JSON.stringify({ name: 'T' }),
    })
    const res = await PUT(req, ctx(''))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'User ID is required' })
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('updates only the provided fields and returns 200', async () => {
    const updated = { id: ID, name: 'New Name', gradeLevel: '3' }
    updateUser.mockResolvedValue(updated)
    const req = new NextRequest(`http://localhost/api/users/${ID}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'New Name', gradeLevel: '3' }),
    })
    const res = await PUT(req, ctx(ID))
    expect(res.status).toBe(200)
    expect(requireOwnership).toHaveBeenCalledWith(ID)
    expect(updateUser).toHaveBeenCalledWith(ID, { name: 'New Name', gradeLevel: '3' })
    const body = await res.json()
    expect(body.message).toBe('User updated successfully')
    expect(body.user).toEqual(updated)
  })

  it('updates every supported profile field', async () => {
    updateUser.mockResolvedValue({ id: ID })
    const payload = {
      name: 'T',
      gradeLevel: '3',
      subject: 'Spelling',
      schoolName: 'Shepherd',
      classroomSize: 24,
      preferredName: 'Teach',
    }
    const req = new NextRequest(`http://localhost/api/users/${ID}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    const res = await PUT(req, ctx(ID))
    expect(res.status).toBe(200)
    expect(updateUser).toHaveBeenCalledWith(ID, payload)
  })

  it('accepts a valid image data URL', async () => {
    updateUser.mockResolvedValue({ id: ID })
    const image = 'data:image/jpeg;base64,/9j/4AAQ'
    const req = new NextRequest(`http://localhost/api/users/${ID}`, {
      method: 'PUT',
      body: JSON.stringify({ image }),
    })
    const res = await PUT(req, ctx(ID))
    expect(res.status).toBe(200)
    expect(updateUser).toHaveBeenCalledWith(ID, { image })
  })

  it('accepts an empty image to clear the photo', async () => {
    updateUser.mockResolvedValue({ id: ID })
    const req = new NextRequest(`http://localhost/api/users/${ID}`, {
      method: 'PUT',
      body: JSON.stringify({ image: '' }),
    })
    const res = await PUT(req, ctx(ID))
    expect(res.status).toBe(200)
    expect(updateUser).toHaveBeenCalledWith(ID, { image: '' })
  })

  it('returns 400 for an image with a non-image data URL prefix', async () => {
    const req = new NextRequest(`http://localhost/api/users/${ID}`, {
      method: 'PUT',
      body: JSON.stringify({ image: 'data:text/plain;base64,aGVsbG8=' }),
    })
    const res = await PUT(req, ctx(ID))
    expect(res.status).toBe(400)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('returns 400 for an image that is not a string', async () => {
    const req = new NextRequest(`http://localhost/api/users/${ID}`, {
      method: 'PUT',
      body: JSON.stringify({ image: 42 }),
    })
    const res = await PUT(req, ctx(ID))
    expect(res.status).toBe(400)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('returns 400 for an image over the length limit', async () => {
    const req = new NextRequest(`http://localhost/api/users/${ID}`, {
      method: 'PUT',
      body: JSON.stringify({ image: 'data:image/jpeg;base64,' + 'a'.repeat(140_000) }),
    })
    const res = await PUT(req, ctx(ID))
    expect(res.status).toBe(400)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('sends an empty update object when no fields are provided', async () => {
    updateUser.mockResolvedValue({ id: ID })
    const req = new NextRequest(`http://localhost/api/users/${ID}`, {
      method: 'PUT',
      body: JSON.stringify({}),
    })
    const res = await PUT(req, ctx(ID))
    expect(res.status).toBe(200)
    expect(updateUser).toHaveBeenCalledWith(ID, {})
  })

  it('returns 500 when updateUser throws', async () => {
    updateUser.mockRejectedValue(new Error('db down'))
    const req = new NextRequest(`http://localhost/api/users/${ID}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'T' }),
    })
    const res = await PUT(req, ctx(ID))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to update user' })
  })

  it('returns 500 when the request body is not valid JSON', async () => {
    const req = new NextRequest(`http://localhost/api/users/${ID}`, {
      method: 'PUT',
      body: '{not-json',
    })
    const res = await PUT(req, ctx(ID))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to update user' })
  })
})

describe('GET /api/users/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    owned()
  })

  it('returns 401 when the session is missing', async () => {
    denied(401)
    const res = await GET(new NextRequest(`http://localhost/api/users/${ID}`), ctx(ID))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
    expect(getUserById).not.toHaveBeenCalled()
  })

  it('returns 403 when the caller does not own the record', async () => {
    denied(403)
    const res = await GET(new NextRequest(`http://localhost/api/users/${ID}`), ctx(ID))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden' })
    expect(getUserById).not.toHaveBeenCalled()
  })

  it('returns 400 when the id is empty', async () => {
    const res = await GET(new NextRequest('http://localhost/api/users/'), ctx(''))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'User ID is required' })
    expect(getUserById).not.toHaveBeenCalled()
  })

  it('returns 404 when the user does not exist', async () => {
    getUserById.mockResolvedValue(null)
    const res = await GET(new NextRequest(`http://localhost/api/users/${ID}`), ctx(ID))
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'User not found' })
  })

  it('returns the user on success', async () => {
    const user = { id: ID, email: 'teacher@example.com', name: 'Teacher' }
    getUserById.mockResolvedValue(user)
    const res = await GET(new NextRequest(`http://localhost/api/users/${ID}`), ctx(ID))
    expect(res.status).toBe(200)
    expect(getUserById).toHaveBeenCalledWith(ID)
    expect(await res.json()).toEqual({ user })
  })

  it('sends Cache-Control: no-store so a refresh never serves a stale user', async () => {
    const user = { id: ID, email: 'teacher@example.com', name: 'Teacher' }
    getUserById.mockResolvedValue(user)
    const res = await GET(new NextRequest(`http://localhost/api/users/${ID}`), ctx(ID))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('returns 500 when getUserById throws', async () => {
    getUserById.mockRejectedValue(new Error('db down'))
    const res = await GET(new NextRequest(`http://localhost/api/users/${ID}`), ctx(ID))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to get user' })
  })
})
