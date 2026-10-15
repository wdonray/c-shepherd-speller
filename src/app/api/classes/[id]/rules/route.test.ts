import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }))
vi.mock('@/lib/require-auth', () => ({ requireUser }))

const { saveClassRules, deleteClassRule } = vi.hoisted(() => ({ saveClassRules: vi.fn(), deleteClassRule: vi.fn() }))
vi.mock('@/lib/classes-db', () => ({ saveClassRules, deleteClassRule }))

import { PUT, DELETE } from './route'

const authed = { user: { id: 'u1', email: 't@example.com' }, response: null }
const params = { params: Promise.resolve({ id: 'c1' }) }

function putRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/classes/c1/rules', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

function deleteRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/classes/c1/rules', {
    method: 'DELETE',
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

describe('DELETE /api/classes/[id]/rules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not signed in', async () => {
    requireUser.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })
    const res = await DELETE(deleteRequest({ patternText: 'a_e' }), params)
    expect(res.status).toBe(401)
  })

  it('deletes the rule and returns the remaining rules', async () => {
    requireUser.mockResolvedValue(authed)
    const remaining = { ai: { rule: 'ai never ends a word.' } }
    deleteClassRule.mockResolvedValue(remaining)

    const res = await DELETE(deleteRequest({ patternText: 'a_e' }), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rules).toEqual(remaining)
    expect(deleteClassRule).toHaveBeenCalledWith('u1', 'c1', 'a_e')
  })

  it('returns 400 for invalid delete data', async () => {
    requireUser.mockResolvedValue(authed)
    const res = await DELETE(deleteRequest({}), params)
    expect(res.status).toBe(400)
    const res2 = await DELETE(deleteRequest({ patternText: '' }), params)
    expect(res2.status).toBe(400)
  })

  it('returns 400 for invalid JSON', async () => {
    requireUser.mockResolvedValue(authed)
    const bad = new NextRequest('http://localhost/api/classes/c1/rules', {
      method: 'DELETE',
      body: 'not json',
    })
    const res = await DELETE(bad, params)
    expect(res.status).toBe(400)
  })

  it('returns 404 when the class does not exist', async () => {
    requireUser.mockResolvedValue(authed)
    deleteClassRule.mockRejectedValue(new Error('Class not found: c1'))

    const res = await DELETE(deleteRequest({ patternText: 'a_e' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 500 when the database fails', async () => {
    requireUser.mockResolvedValue(authed)
    deleteClassRule.mockRejectedValue(new Error('db down'))

    const res = await DELETE(deleteRequest({ patternText: 'a_e' }), params)
    expect(res.status).toBe(500)
  })
})
