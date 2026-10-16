import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }))
vi.mock('@/lib/require-auth', () => ({ requireUser }))

const { getClassById, updateClass, deleteClass, getClassDeletionInfo } = vi.hoisted(() => ({
  getClassById: vi.fn(),
  updateClass: vi.fn(),
  deleteClass: vi.fn(),
  getClassDeletionInfo: vi.fn(),
}))
vi.mock('@/lib/classes-db', () => ({ getClassById, updateClass, deleteClass, getClassDeletionInfo }))

const { getUserById, updateUserDefaultClassId } = vi.hoisted(() => ({
  getUserById: vi.fn(),
  updateUserDefaultClassId: vi.fn(),
}))
vi.mock('@/lib/db-utils', () => ({ getUserById, updateUserDefaultClassId }))

import { GET, PUT, DELETE } from './route'

const authed = { user: { id: 'u1', email: 't@example.com' }, response: null }
const params = (id: string) => ({ params: Promise.resolve({ id }) })

function putRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/classes/c1', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

describe('GET /api/classes/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not signed in', async () => {
    requireUser.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })
    const res = await GET(new NextRequest('http://localhost/api/classes/c1'), params('c1'))
    expect(res.status).toBe(401)
  })

  it('returns the class', async () => {
    requireUser.mockResolvedValue(authed)
    getClassById.mockResolvedValue({ id: 'c1', name: 'Period 2' })

    const res = await GET(new NextRequest('http://localhost/api/classes/c1'), params('c1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.class.id).toBe('c1')
    expect(getClassById).toHaveBeenCalledWith('u1', 'c1')
  })

  it('returns 404 when the class does not exist', async () => {
    requireUser.mockResolvedValue(authed)
    getClassById.mockResolvedValue(undefined)

    const res = await GET(new NextRequest('http://localhost/api/classes/c1'), params('c1'))
    expect(res.status).toBe(404)
  })

  it('returns 500 when the database fails', async () => {
    requireUser.mockResolvedValue(authed)
    getClassById.mockRejectedValue(new Error('db down'))

    const res = await GET(new NextRequest('http://localhost/api/classes/c1'), params('c1'))
    expect(res.status).toBe(500)
  })
})

describe('PUT /api/classes/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not signed in', async () => {
    requireUser.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })
    const res = await PUT(putRequest({ name: 'Period 3' }), params('c1'))
    expect(res.status).toBe(401)
  })

  it('updates the class', async () => {
    requireUser.mockResolvedValue(authed)
    updateClass.mockResolvedValue({ id: 'c1', name: 'Period 3' })

    const res = await PUT(putRequest({ name: 'Period 3' }), params('c1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.class.name).toBe('Period 3')
    expect(updateClass).toHaveBeenCalledWith('u1', 'c1', { name: 'Period 3' })
  })

  it('returns 400 for invalid JSON', async () => {
    requireUser.mockResolvedValue(authed)
    const bad = new NextRequest('http://localhost/api/classes/c1', {
      method: 'PUT',
      body: 'not json',
    })
    const res = await PUT(bad, params('c1'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid data', async () => {
    requireUser.mockResolvedValue(authed)
    const res = await PUT(putRequest({ name: '' }), params('c1'))
    expect(res.status).toBe(400)
  })

  it('returns 404 when the class does not exist', async () => {
    requireUser.mockResolvedValue(authed)
    updateClass.mockRejectedValue(new Error('Class not found'))

    const res = await PUT(putRequest({ name: 'Period 3' }), params('c1'))
    expect(res.status).toBe(404)
  })

  it('returns 500 when the database fails', async () => {
    requireUser.mockResolvedValue(authed)
    updateClass.mockRejectedValue(new Error('db down'))

    const res = await PUT(putRequest({ name: 'Period 3' }), params('c1'))
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/classes/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const emptyDeletion = { ruleCount: 0, assignedListCount: 0, studentCount: 0, canDelete: true }

  it('returns 401 when not signed in', async () => {
    requireUser.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })
    const res = await DELETE(new NextRequest('http://localhost/api/classes/c1'), params('c1'))
    expect(res.status).toBe(401)
  })

  it('deletes an empty classroom', async () => {
    requireUser.mockResolvedValue(authed)
    getClassDeletionInfo.mockResolvedValue(emptyDeletion)
    getUserById.mockResolvedValue({ id: 'u1', defaultClassId: null })
    deleteClass.mockResolvedValue(undefined)

    const res = await DELETE(new NextRequest('http://localhost/api/classes/c1'), params('c1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.defaultCleared).toBe(false)
    expect(deleteClass).toHaveBeenCalledWith('u1', 'c1')
    expect(updateUserDefaultClassId).not.toHaveBeenCalled()
  })

  it('clears the default when deleting the default classroom', async () => {
    requireUser.mockResolvedValue(authed)
    getClassDeletionInfo.mockResolvedValue(emptyDeletion)
    getUserById.mockResolvedValue({ id: 'u1', defaultClassId: 'c1' })
    deleteClass.mockResolvedValue(undefined)

    const res = await DELETE(new NextRequest('http://localhost/api/classes/c1'), params('c1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.defaultCleared).toBe(true)
    expect(updateUserDefaultClassId).toHaveBeenCalledWith('u1', null)
    expect(deleteClass).toHaveBeenCalledWith('u1', 'c1')
  })

  it('deletes when the user record cannot be read', async () => {
    requireUser.mockResolvedValue(authed)
    getClassDeletionInfo.mockResolvedValue(emptyDeletion)
    getUserById.mockResolvedValue(undefined)
    deleteClass.mockResolvedValue(undefined)

    const res = await DELETE(new NextRequest('http://localhost/api/classes/c1'), params('c1'))
    expect(res.status).toBe(200)
    expect(updateUserDefaultClassId).not.toHaveBeenCalled()
    expect(deleteClass).toHaveBeenCalledWith('u1', 'c1')
  })

  it('returns 404 when the class does not exist', async () => {
    requireUser.mockResolvedValue(authed)
    getClassDeletionInfo.mockRejectedValue(new Error('Class not found: c1'))

    const res = await DELETE(new NextRequest('http://localhost/api/classes/c1'), params('c1'))
    expect(res.status).toBe(404)
    expect(deleteClass).not.toHaveBeenCalled()
  })

  it('returns 409 when the classroom has attachments', async () => {
    requireUser.mockResolvedValue(authed)
    const deletion = { ruleCount: 2, assignedListCount: 1, studentCount: 0, canDelete: false }
    getClassDeletionInfo.mockResolvedValue(deletion)

    const res = await DELETE(new NextRequest('http://localhost/api/classes/c1'), params('c1'))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.blocked).toBe(true)
    expect(body.deletion).toEqual(deletion)
    expect(deleteClass).not.toHaveBeenCalled()
  })

  it('returns 500 when the deletion check fails', async () => {
    requireUser.mockResolvedValue(authed)
    getClassDeletionInfo.mockRejectedValue(new Error('db down'))

    const res = await DELETE(new NextRequest('http://localhost/api/classes/c1'), params('c1'))
    expect(res.status).toBe(500)
    expect(deleteClass).not.toHaveBeenCalled()
  })

  it('returns 500 when the deletion check throws a non-error', async () => {
    requireUser.mockResolvedValue(authed)
    getClassDeletionInfo.mockRejectedValue('weird failure')

    const res = await DELETE(new NextRequest('http://localhost/api/classes/c1'), params('c1'))
    expect(res.status).toBe(500)
  })

  it('returns 500 when the database fails', async () => {
    requireUser.mockResolvedValue(authed)
    getClassDeletionInfo.mockResolvedValue(emptyDeletion)
    getUserById.mockResolvedValue({ id: 'u1', defaultClassId: null })
    deleteClass.mockRejectedValue(new Error('db down'))

    const res = await DELETE(new NextRequest('http://localhost/api/classes/c1'), params('c1'))
    expect(res.status).toBe(500)
  })
})
