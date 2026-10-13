import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }))
vi.mock('@/lib/require-auth', () => ({ requireUser }))

const { getClassById, updateClass, deleteClass } = vi.hoisted(() => ({
  getClassById: vi.fn(),
  updateClass: vi.fn(),
  deleteClass: vi.fn(),
}))
vi.mock('@/lib/classes-db', () => ({ getClassById, updateClass, deleteClass }))

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

  it('returns 401 when not signed in', async () => {
    requireUser.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })
    const res = await DELETE(new NextRequest('http://localhost/api/classes/c1'), params('c1'))
    expect(res.status).toBe(401)
  })

  it('deletes the class', async () => {
    requireUser.mockResolvedValue(authed)
    deleteClass.mockResolvedValue(undefined)

    const res = await DELETE(new NextRequest('http://localhost/api/classes/c1'), params('c1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(deleteClass).toHaveBeenCalledWith('u1', 'c1')
  })

  it('returns 500 when the database fails', async () => {
    requireUser.mockResolvedValue(authed)
    deleteClass.mockRejectedValue(new Error('db down'))

    const res = await DELETE(new NextRequest('http://localhost/api/classes/c1'), params('c1'))
    expect(res.status).toBe(500)
  })
})
