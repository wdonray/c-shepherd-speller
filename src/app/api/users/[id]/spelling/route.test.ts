import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import type { Session } from 'next-auth'

const { requireOwnership } = vi.hoisted(() => ({
  requireSession: vi.fn(),
  requireOwnership: vi.fn(),
  isSelfEmail: vi.fn(),
}))
vi.mock('@/lib/require-auth', () => ({ requireOwnership }))

const { getUserSpellingData, updateUserSpellingData } = vi.hoisted(() => ({
  createUser: vi.fn(),
  getUserByEmail: vi.fn(),
  updateUser: vi.fn(),
  getUserById: vi.fn(),
  getUserSpellingData: vi.fn(),
  updateUserSpellingData: vi.fn(),
  updateUserLastActive: vi.fn(),
}))
vi.mock('@/lib/db-utils', () => ({ getUserSpellingData, updateUserSpellingData }))

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

describe('GET /api/users/[id]/spelling', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    owned()
  })

  it('returns 401 when the session is missing', async () => {
    denied(401)
    const res = await GET(new NextRequest(`http://localhost/api/users/${ID}/spelling`), ctx(ID))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
    expect(getUserSpellingData).not.toHaveBeenCalled()
  })

  it('returns 403 when the caller does not own the record', async () => {
    denied(403)
    const res = await GET(new NextRequest(`http://localhost/api/users/${ID}/spelling`), ctx(ID))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden' })
    expect(getUserSpellingData).not.toHaveBeenCalled()
  })

  it('returns 400 when the id is empty', async () => {
    const res = await GET(new NextRequest('http://localhost/api/users//spelling'), ctx(''))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'User ID is required' })
    expect(getUserSpellingData).not.toHaveBeenCalled()
  })

  it('returns 404 when the user does not exist', async () => {
    getUserSpellingData.mockResolvedValue(null)
    const res = await GET(new NextRequest(`http://localhost/api/users/${ID}/spelling`), ctx(ID))
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'User not found' })
  })

  it('returns the spelling data on success', async () => {
    const spellingData = { words: ['cat'], sounds: ['a'], spelling: ['cat'] }
    getUserSpellingData.mockResolvedValue(spellingData)
    const res = await GET(new NextRequest(`http://localhost/api/users/${ID}/spelling`), ctx(ID))
    expect(res.status).toBe(200)
    expect(getUserSpellingData).toHaveBeenCalledWith(ID)
    expect(await res.json()).toEqual({ spellingData })
  })

  it('sends Cache-Control: no-store so a refresh never serves stale spelling data', async () => {
    const spellingData = { words: ['cat'], sounds: ['a'], spelling: ['cat'] }
    getUserSpellingData.mockResolvedValue(spellingData)
    const res = await GET(new NextRequest(`http://localhost/api/users/${ID}/spelling`), ctx(ID))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('returns 500 when getUserSpellingData throws', async () => {
    getUserSpellingData.mockRejectedValue(new Error('db down'))
    const res = await GET(new NextRequest(`http://localhost/api/users/${ID}/spelling`), ctx(ID))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to get user spelling data' })
  })
})

describe('PUT /api/users/[id]/spelling', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    owned()
  })

  function put(body: unknown, id = ID) {
    const req = new NextRequest(`http://localhost/api/users/${id}/spelling`, {
      method: 'PUT',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
    return PUT(req, ctx(id))
  }

  it('returns 401 when the session is missing', async () => {
    denied(401)
    const res = await put({ words: ['cat'] })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
    expect(updateUserSpellingData).not.toHaveBeenCalled()
  })

  it('returns 403 when the caller does not own the record', async () => {
    denied(403)
    const res = await put({ words: ['cat'] })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden' })
    expect(updateUserSpellingData).not.toHaveBeenCalled()
  })

  it('returns 400 when the id is empty', async () => {
    const res = await put({ words: ['cat'] }, '')
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'User ID is required' })
    expect(updateUserSpellingData).not.toHaveBeenCalled()
  })

  it('returns 400 when no spelling fields are provided', async () => {
    const res = await put({})
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'At least one field (words, sounds, or spelling) must be provided',
    })
    expect(updateUserSpellingData).not.toHaveBeenCalled()
  })

  it('returns 404 when the user does not exist', async () => {
    updateUserSpellingData.mockResolvedValue(null)
    const res = await put({ words: ['cat'] })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'User not found' })
  })

  it('updates all spelling fields and returns 200', async () => {
    const updated = { id: ID, words: ['cat'], sounds: ['a'], spelling: ['cat'] }
    updateUserSpellingData.mockResolvedValue(updated)
    const res = await put({ words: ['cat'], sounds: ['a'], spelling: ['cat'] })
    expect(res.status).toBe(200)
    expect(updateUserSpellingData).toHaveBeenCalledWith(ID, {
      words: ['cat'],
      sounds: ['a'],
      spelling: ['cat'],
    })
    const body = await res.json()
    expect(body.message).toBe('User spelling data updated successfully')
    expect(body.user).toEqual(updated)
  })

  it('accepts a partial update with a single field', async () => {
    const updated = { id: ID, sounds: ['o'] }
    updateUserSpellingData.mockResolvedValue(updated)
    const res = await put({ sounds: ['o'] })
    expect(res.status).toBe(200)
    expect(updateUserSpellingData).toHaveBeenCalledWith(ID, {
      words: undefined,
      sounds: ['o'],
      spelling: undefined,
    })
    expect((await res.json()).user).toEqual(updated)
  })

  it('returns 500 when updateUserSpellingData throws', async () => {
    updateUserSpellingData.mockRejectedValue(new Error('db down'))
    const res = await put({ words: ['cat'] })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to update user spelling data' })
  })

  it('returns 500 when the request body is not valid JSON', async () => {
    const res = await put('{not-json')
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to update user spelling data' })
  })
})
