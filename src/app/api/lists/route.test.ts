import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }))
vi.mock('@/lib/require-auth', () => ({ requireUser }))

const { createList, getListsByUser } = vi.hoisted(() => ({
  createList: vi.fn(),
  getListsByUser: vi.fn(),
}))
vi.mock('@/lib/lists-db', () => ({ createList, getListsByUser }))

import { GET, POST } from './route'

const authed = { user: { id: 'u1', email: 't@example.com' }, response: null }

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/lists', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('GET /api/lists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not signed in', async () => {
    requireUser.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns the caller lists', async () => {
    requireUser.mockResolvedValue(authed)
    getListsByUser.mockResolvedValue([{ id: 'l1', name: 'Week 5' }])

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.lists).toHaveLength(1)
    expect(getListsByUser).toHaveBeenCalledWith('u1')
  })

  it('returns 500 when the database fails', async () => {
    requireUser.mockResolvedValue(authed)
    getListsByUser.mockRejectedValue(new Error('db down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await GET()
    expect(res.status).toBe(500)
  })
})

describe('POST /api/lists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not signed in', async () => {
    requireUser.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })
    const res = await POST(jsonRequest({ name: 'x' }))
    expect(res.status).toBe(401)
    expect(createList).not.toHaveBeenCalled()
  })

  it('creates a list and returns 201', async () => {
    requireUser.mockResolvedValue(authed)
    createList.mockResolvedValue({ id: 'l1', name: 'Week 5', userId: 'u1', patterns: [] })

    const res = await POST(jsonRequest({ name: 'Week 5' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.list.id).toBe('l1')
    expect(createList).toHaveBeenCalledWith('u1', { name: 'Week 5', patterns: [] })
  })

  it('returns 400 for invalid input', async () => {
    requireUser.mockResolvedValue(authed)
    const res = await POST(jsonRequest({ name: '' }))
    expect(res.status).toBe(400)
    expect(createList).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed JSON', async () => {
    requireUser.mockResolvedValue(authed)
    const req = new NextRequest('http://localhost/api/lists', {
      method: 'POST',
      body: 'not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 500 when creation fails', async () => {
    requireUser.mockResolvedValue(authed)
    createList.mockRejectedValue(new Error('db down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(jsonRequest({ name: 'Week 5' }))
    expect(res.status).toBe(500)
  })
})
