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

const { getClassById } = vi.hoisted(() => ({ getClassById: vi.fn() }))
vi.mock('@/lib/classes-db', () => ({ getClassById }))

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

  it('returns classroom: null when the list has no classroom', async () => {
    requireUser.mockResolvedValue(authed)
    getListById.mockResolvedValue(stored)

    const res = await GET(new NextRequest('http://localhost/api/lists/l1'), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.classroom).toBeNull()
    expect(getClassById).not.toHaveBeenCalled()
  })

  it('joins the classroom name and flattened rules when the list has one (issue #388)', async () => {
    requireUser.mockResolvedValue(authed)
    getListById.mockResolvedValue({ ...stored, classId: 'c1' })
    getClassById.mockResolvedValue({
      id: 'c1',
      userId: 'u1',
      name: 'Sunshine Second Grade Classroom',
      rules: { a_e: { rule: 'Magic e makes the vowel say its long sound.' } },
      createdAt: '2026-10-17T00:00:00.000Z',
      updatedAt: '2026-10-17T00:00:00.000Z',
    })

    const res = await GET(new NextRequest('http://localhost/api/lists/l1'), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(getClassById).toHaveBeenCalledWith('u1', 'c1')
    expect(body.classroom).toEqual({
      name: 'Sunshine Second Grade Classroom',
      rules: { a_e: 'Magic e makes the vowel say its long sound.' },
    })
  })

  it('treats a legacy class without rules as having no rules', async () => {
    requireUser.mockResolvedValue(authed)
    getListById.mockResolvedValue({ ...stored, classId: 'c1' })
    getClassById.mockResolvedValue({
      id: 'c1',
      userId: 'u1',
      name: 'Period 2',
      createdAt: '2026-10-17T00:00:00.000Z',
      updatedAt: '2026-10-17T00:00:00.000Z',
    })

    const res = await GET(new NextRequest('http://localhost/api/lists/l1'), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.classroom).toEqual({ name: 'Period 2', rules: {} })
  })

  it('degrades to classroom: null when the classroom read fails', async () => {
    requireUser.mockResolvedValue(authed)
    getListById.mockResolvedValue({ ...stored, classId: 'c1' })
    getClassById.mockRejectedValue(new Error('db down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await GET(new NextRequest('http://localhost/api/lists/l1'), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.list.id).toBe('l1')
    expect(body.classroom).toBeNull()
  })

  it('returns classroom: null when the classroom was deleted', async () => {
    requireUser.mockResolvedValue(authed)
    getListById.mockResolvedValue({ ...stored, classId: 'c-gone' })
    getClassById.mockResolvedValue(undefined)

    const res = await GET(new NextRequest('http://localhost/api/lists/l1'), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.classroom).toBeNull()
  })

  it('sends Cache-Control: no-store so a refresh never serves a stale list', async () => {
    requireUser.mockResolvedValue(authed)
    getListById.mockResolvedValue(stored)

    const res = await GET(new NextRequest('http://localhost/api/lists/l1'), params)
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
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

  it('accepts favorite and order updates', async () => {
    requireUser.mockResolvedValue(authed)
    updateList.mockResolvedValue({ ...stored, isFavorite: true, favoriteOrder: 0 })

    const res = await PUT(jsonRequest({ isFavorite: true, favoriteOrder: 0 }), params)
    expect(res.status).toBe(200)
    expect(updateList).toHaveBeenCalledWith('u1', 'l1', { isFavorite: true, favoriteOrder: 0 })
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
