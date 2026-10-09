import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }))
vi.mock('@/lib/require-auth', () => ({ requireUser }))

const { getListById, updateList, deleteList } = vi.hoisted(() => ({
  getListById: vi.fn(),
  updateList: vi.fn(),
  deleteList: vi.fn(),
}))
vi.mock('@/lib/lists-db', () => ({ getListById, updateList, deleteList }))

import { GET, PUT, DELETE } from './route'

const authed = { user: { id: 'u1', email: 't@example.com' }, response: null }
const params = { params: Promise.resolve({ id: 'l1' }) }
const stored = { id: 'l1', userId: 'u1', name: 'Week 5', patterns: [] }

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/lists/l1', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

describe('GET /api/lists/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not signed in', async () => {
    requireUser.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })
    const res = await GET(new NextRequest('http://localhost/api/lists/l1'), params)
    expect(res.status).toBe(401)
  })

  it('returns the list', async () => {
    requireUser.mockResolvedValue(authed)
    getListById.mockResolvedValue(stored)

    const res = await GET(new NextRequest('http://localhost/api/lists/l1'), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.list.id).toBe('l1')
    expect(getListById).toHaveBeenCalledWith('u1', 'l1')
  })

  it('returns 404 when the list does not exist', async () => {
    requireUser.mockResolvedValue(authed)
    getListById.mockResolvedValue(undefined)

    const res = await GET(new NextRequest('http://localhost/api/lists/l1'), params)
    expect(res.status).toBe(404)
  })

  it('returns 500 when the database fails', async () => {
    requireUser.mockResolvedValue(authed)
    getListById.mockRejectedValue(new Error('db down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await GET(new NextRequest('http://localhost/api/lists/l1'), params)
    expect(res.status).toBe(500)
  })
})

describe('PUT /api/lists/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not signed in', async () => {
    requireUser.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })
    const res = await PUT(jsonRequest({ name: 'x' }), params)
    expect(res.status).toBe(401)
    expect(updateList).not.toHaveBeenCalled()
  })

  it('updates the list', async () => {
    requireUser.mockResolvedValue(authed)
    updateList.mockResolvedValue({ ...stored, name: 'Renamed' })

    const res = await PUT(jsonRequest({ name: 'Renamed' }), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.list.name).toBe('Renamed')
    expect(updateList).toHaveBeenCalledWith('u1', 'l1', { name: 'Renamed' })
  })

  it('returns 404 when the list does not exist', async () => {
    requireUser.mockResolvedValue(authed)
    updateList.mockRejectedValue(new Error('List not found'))

    const res = await PUT(jsonRequest({ name: 'Renamed' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid input', async () => {
    requireUser.mockResolvedValue(authed)
    const res = await PUT(jsonRequest({ name: '' }), params)
    expect(res.status).toBe(400)
    expect(updateList).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed JSON', async () => {
    requireUser.mockResolvedValue(authed)
    const req = new NextRequest('http://localhost/api/lists/l1', {
      method: 'PUT',
      body: 'not json',
    })
    const res = await PUT(req, params)
    expect(res.status).toBe(400)
  })

  it('returns 500 on unexpected errors', async () => {
    requireUser.mockResolvedValue(authed)
    updateList.mockRejectedValue(new Error('db down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await PUT(jsonRequest({ name: 'Renamed' }), params)
    expect(res.status).toBe(500)
  })

  it('persists keywordEmoji on a pattern (no route change needed)', async () => {
    requireUser.mockResolvedValue(authed)
    const patterns = [
      {
        id: 'p1',
        sound: 'long e',
        pattern: 'ee',
        frequency: 'common',
        words: ['bee'],
        keywordEmoji: '🐝',
      },
    ]
    updateList.mockResolvedValue({ ...stored, patterns })

    const res = await PUT(jsonRequest({ patterns }), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.list.patterns[0].keywordEmoji).toBe('🐝')
    expect(updateList).toHaveBeenCalledWith('u1', 'l1', { patterns })
  })

  it('rejects an invalid keywordEmoji on a pattern', async () => {
    requireUser.mockResolvedValue(authed)
    const patterns = [
      {
        id: 'p1',
        sound: 'long e',
        pattern: 'ee',
        frequency: 'common',
        words: ['bee'],
        keywordEmoji: '',
      },
    ]

    const res = await PUT(jsonRequest({ patterns }), params)
    expect(res.status).toBe(400)
    expect(updateList).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/lists/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not signed in', async () => {
    requireUser.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })
    const res = await DELETE(new NextRequest('http://localhost/api/lists/l1'), params)
    expect(res.status).toBe(401)
    expect(deleteList).not.toHaveBeenCalled()
  })

  it('deletes the list', async () => {
    requireUser.mockResolvedValue(authed)
    deleteList.mockResolvedValue(undefined)

    const res = await DELETE(new NextRequest('http://localhost/api/lists/l1'), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(deleteList).toHaveBeenCalledWith('u1', 'l1')
  })

  it('returns 500 when deletion fails', async () => {
    requireUser.mockResolvedValue(authed)
    deleteList.mockRejectedValue(new Error('db down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await DELETE(new NextRequest('http://localhost/api/lists/l1'), params)
    expect(res.status).toBe(500)
  })
})
