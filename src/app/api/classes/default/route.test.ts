import { describe, it, expect, vi, beforeEach } from 'vitest'

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }))
vi.mock('@/lib/require-auth', () => ({ requireUser }))

const { getUserById } = vi.hoisted(() => ({ getUserById: vi.fn() }))
vi.mock('@/lib/db-utils', () => ({ getUserById }))

const { getClassesByUser } = vi.hoisted(() => ({ getClassesByUser: vi.fn() }))
vi.mock('@/lib/classes-db', () => ({ getClassesByUser }))

const { resolveDefaultClassId } = vi.hoisted(() => ({ resolveDefaultClassId: vi.fn() }))
vi.mock('@/models/Class', () => ({ resolveDefaultClassId }))

import { GET } from './route'

const authed = { user: { id: 'u1', email: 't@example.com' }, response: null }

describe('GET /api/classes/default', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns 401 when not signed in', async () => {
    requireUser.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })
    const res = await GET()
    expect(res.status).toBe(401)
    expect(getClassesByUser).not.toHaveBeenCalled()
  })

  it('returns the resolved default class id', async () => {
    requireUser.mockResolvedValue(authed)
    const user = { id: 'u1', defaultClassId: 'c2' }
    const classes = [{ id: 'c1' }, { id: 'c2' }]
    getUserById.mockResolvedValue(user)
    getClassesByUser.mockResolvedValue(classes)
    resolveDefaultClassId.mockReturnValue('c2')
    const res = await GET()
    expect(res.status).toBe(200)
    expect(resolveDefaultClassId).toHaveBeenCalledWith(user, classes)
    expect(await res.json()).toEqual({ defaultClassId: 'c2' })
  })

  it('returns null when there is no default', async () => {
    requireUser.mockResolvedValue(authed)
    getUserById.mockResolvedValue({ id: 'u1' })
    getClassesByUser.mockResolvedValue([])
    resolveDefaultClassId.mockReturnValue(null)
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ defaultClassId: null })
  })

  it('returns 500 when the lookup fails', async () => {
    requireUser.mockResolvedValue(authed)
    getUserById.mockRejectedValue(new Error('db down'))
    const res = await GET()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to resolve default class' })
  })
})
