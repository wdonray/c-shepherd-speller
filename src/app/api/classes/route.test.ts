import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }))
vi.mock('@/lib/require-auth', () => ({ requireUser }))

const { createClass, getClassesByUser } = vi.hoisted(() => ({
  createClass: vi.fn(),
  getClassesByUser: vi.fn(),
}))
vi.mock('@/lib/classes-db', () => ({ createClass, getClassesByUser }))

import { GET, POST } from './route'

const authed = { user: { id: 'u1', email: 't@example.com' }, response: null }

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/classes', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('GET /api/classes', () => {
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

  it('returns the caller classes', async () => {
    requireUser.mockResolvedValue(authed)
    getClassesByUser.mockResolvedValue([{ id: 'c1', name: 'Period 2' }])

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.classes).toHaveLength(1)
    expect(getClassesByUser).toHaveBeenCalledWith('u1')
  })

  it('sends Cache-Control: no-store', async () => {
    requireUser.mockResolvedValue(authed)
    getClassesByUser.mockResolvedValue([])

    const res = await GET()
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('returns 500 when the database fails', async () => {
    requireUser.mockResolvedValue(authed)
    getClassesByUser.mockRejectedValue(new Error('db down'))

    const res = await GET()
    expect(res.status).toBe(500)
  })
})

describe('POST /api/classes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not signed in', async () => {
    requireUser.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })
    const res = await POST(jsonRequest({ name: 'Period 2' }))
    expect(res.status).toBe(401)
  })

  it('creates a class and returns 201', async () => {
    requireUser.mockResolvedValue(authed)
    createClass.mockResolvedValue({ id: 'c1', name: 'Period 2' })

    const res = await POST(jsonRequest({ name: 'Period 2' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.class.id).toBe('c1')
    expect(createClass).toHaveBeenCalledWith('u1', { name: 'Period 2' })
  })

  it('returns 400 for an empty name', async () => {
    requireUser.mockResolvedValue(authed)
    const res = await POST(jsonRequest({ name: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON', async () => {
    requireUser.mockResolvedValue(authed)
    const bad = new NextRequest('http://localhost/api/classes', {
      method: 'POST',
      body: 'not json',
    })
    const res = await POST(bad)
    expect(res.status).toBe(400)
  })

  it('returns 500 when the database fails', async () => {
    requireUser.mockResolvedValue(authed)
    createClass.mockRejectedValue(new Error('db down'))

    const res = await POST(jsonRequest({ name: 'Period 2' }))
    expect(res.status).toBe(500)
  })
})
