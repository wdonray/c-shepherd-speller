import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }))
vi.mock('@/lib/require-auth', () => ({ requireUser }))

const { saveClassRules } = vi.hoisted(() => ({ saveClassRules: vi.fn() }))
vi.mock('@/lib/classes-db', () => ({ saveClassRules }))

import { PUT } from './route'

const authed = { user: { id: 'u1', email: 't@example.com' }, response: null }
const params = { params: Promise.resolve({ id: 'c1' }) }

function putRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/classes/c1/rules', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

describe('PUT /api/classes/[id]/rules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not signed in', async () => {
    requireUser.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })
    const res = await PUT(putRequest({ rules: {} }), params)
    expect(res.status).toBe(401)
  })

  it('saves rules and returns the merged map', async () => {
    requireUser.mockResolvedValue(authed)
    const rules = { a_e: { rule: 'Magic e.' } }
    saveClassRules.mockResolvedValue(rules)

    const res = await PUT(putRequest({ rules }), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rules).toEqual(rules)
    expect(saveClassRules).toHaveBeenCalledWith('u1', 'c1', rules)
  })

  it('returns 400 for invalid rules data', async () => {
    requireUser.mockResolvedValue(authed)
    const res = await PUT(putRequest({ rules: { a_e: { rule: '' } } }), params)
    expect(res.status).toBe(400)
    const res2 = await PUT(putRequest({}), params)
    expect(res2.status).toBe(400)
  })

  it('returns 400 for invalid JSON', async () => {
    requireUser.mockResolvedValue(authed)
    const bad = new NextRequest('http://localhost/api/classes/c1/rules', {
      method: 'PUT',
      body: 'not json',
    })
    const res = await PUT(bad, params)
    expect(res.status).toBe(400)
  })

  it('returns 404 when the class does not exist', async () => {
    requireUser.mockResolvedValue(authed)
    saveClassRules.mockRejectedValue(new Error('Class not found: c1'))

    const res = await PUT(putRequest({ rules: { a_e: { rule: 'Magic e.' } } }), params)
    expect(res.status).toBe(404)
  })

  it('returns 500 when the database fails', async () => {
    requireUser.mockResolvedValue(authed)
    saveClassRules.mockRejectedValue(new Error('db down'))

    const res = await PUT(putRequest({ rules: { a_e: { rule: 'Magic e.' } } }), params)
    expect(res.status).toBe(500)
  })
})
