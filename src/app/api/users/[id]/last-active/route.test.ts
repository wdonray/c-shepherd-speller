import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import type { Session } from 'next-auth'

const { requireOwnership } = vi.hoisted(() => ({
  requireSession: vi.fn(),
  requireOwnership: vi.fn(),
  isSelfEmail: vi.fn(),
}))
vi.mock('@/lib/require-auth', () => ({ requireOwnership }))

const { updateUserLastActive } = vi.hoisted(() => ({
  createUser: vi.fn(),
  getUserByEmail: vi.fn(),
  updateUser: vi.fn(),
  getUserById: vi.fn(),
  getUserSpellingData: vi.fn(),
  updateUserSpellingData: vi.fn(),
  updateUserLastActive: vi.fn(),
}))
vi.mock('@/lib/db-utils', () => ({ updateUserLastActive }))

// Imported after the mocks so the route binds to them.
import { PUT } from './route'

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

function put(id = ID) {
  const req = new NextRequest(`http://localhost/api/users/${id}/last-active`, { method: 'PUT' })
  return PUT(req, { params: Promise.resolve({ id }) })
}

describe('PUT /api/users/[id]/last-active', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    owned()
  })

  it('returns 401 when the session is missing', async () => {
    denied(401)
    const res = await put()
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
    expect(updateUserLastActive).not.toHaveBeenCalled()
  })

  it('returns 403 when the caller does not own the record', async () => {
    denied(403)
    const res = await put()
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden' })
    expect(updateUserLastActive).not.toHaveBeenCalled()
  })

  it('returns 400 when the id is empty', async () => {
    const res = await put('')
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'User ID is required' })
    expect(updateUserLastActive).not.toHaveBeenCalled()
  })

  it('returns 404 when the user does not exist', async () => {
    updateUserLastActive.mockResolvedValue(null)
    const res = await put()
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'User not found' })
  })

  it('updates the timestamp and returns 200', async () => {
    const updated = { id: ID, lastActive: '2026-10-05T00:00:00.000Z' }
    updateUserLastActive.mockResolvedValue(updated)
    const res = await put()
    expect(res.status).toBe(200)
    expect(requireOwnership).toHaveBeenCalledWith(ID)
    expect(updateUserLastActive).toHaveBeenCalledWith(ID)
    const body = await res.json()
    expect(body.message).toBe('User last active timestamp updated successfully')
    expect(body.user).toEqual(updated)
  })

  it('returns 500 when updateUserLastActive throws', async () => {
    updateUserLastActive.mockRejectedValue(new Error('db down'))
    const res = await put()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to update user last active' })
  })
})
