import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'

const { requireUser, getUserSpellingData, createList } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getUserSpellingData: vi.fn(),
  createList: vi.fn(),
}))

vi.mock('@/lib/require-auth', () => ({ requireUser }))
vi.mock('@/lib/db-utils', () => ({ getUserSpellingData }))
vi.mock('@/lib/lists-db', () => ({ createList }))

describe('POST /api/migrate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    requireUser.mockResolvedValue({ user: null })
    const res = await POST({} as never)
    expect(res.status).toBe(401)
  })

  it('returns 404 when the user is not found', async () => {
    requireUser.mockResolvedValue({ user: { id: 'u1', email: 'a@b.c' } })
    getUserSpellingData.mockResolvedValue(null)
    const res = await POST({} as never)
    expect(res.status).toBe(404)
  })

  it('returns 400 when there is no data to migrate', async () => {
    requireUser.mockResolvedValue({ user: { id: 'u1', email: 'a@b.c' } })
    getUserSpellingData.mockResolvedValue({ words: [], sounds: [], spelling: [] })
    const res = await POST({} as never)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('No data to migrate')
  })

  it('migrates flat data to a pattern-based list', async () => {
    requireUser.mockResolvedValue({ user: { id: 'u1', email: 'a@b.c' } })
    getUserSpellingData.mockResolvedValue({
      words: ['cat'],
      sounds: ['short a'],
      spelling: ['a'],
    })
    const newList = { id: 'l1', name: 'Migrated list' }
    createList.mockResolvedValue(newList)

    const res = await POST({} as never)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.list).toEqual(newList)
    expect(createList).toHaveBeenCalledWith('u1', expect.objectContaining({ userId: 'u1', name: 'Migrated list' }))
  })

  it('returns 500 on unexpected errors', async () => {
    requireUser.mockRejectedValue(new Error('db down'))
    const res = await POST({} as never)
    expect(res.status).toBe(500)
  })
})
