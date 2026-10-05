import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Session } from 'next-auth'

const getServerSession = vi.fn()
const getUserByEmail = vi.fn()

vi.mock('next-auth/next', () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}))

vi.mock('@/lib/db-utils', () => ({
  getUserByEmail: (...args: unknown[]) => getUserByEmail(...args),
}))

// Imported after the mocks so the module under test binds to them.
import { requireSession, requireOwnership, isSelfEmail } from './require-auth'

function session(email = 'teacher@example.com'): Session {
  return { user: { email, name: 'Teacher' }, expires: '2999-01-01' } as Session
}

describe('require-auth', () => {
  beforeEach(() => {
    getServerSession.mockReset()
    getUserByEmail.mockReset()
  })

  describe('requireSession', () => {
    it('returns 401 when there is no session', async () => {
      getServerSession.mockResolvedValue(null)
      const result = await requireSession()
      expect(result.session).toBeNull()
      expect(result.response?.status).toBe(401)
    })

    it('returns 401 when the session has no email', async () => {
      getServerSession.mockResolvedValue({ user: { name: 'No Email' }, expires: '2999-01-01' })
      const result = await requireSession()
      expect(result.session).toBeNull()
      expect(result.response?.status).toBe(401)
    })

    it('returns the session when signed in', async () => {
      const s = session()
      getServerSession.mockResolvedValue(s)
      const result = await requireSession()
      expect(result.session).toBe(s)
      expect(result.response).toBeNull()
    })
  })

  describe('isSelfEmail', () => {
    it('compares emails case-insensitively', () => {
      expect(isSelfEmail(session('Teacher@Example.com'), 'teacher@example.com')).toBe(true)
      expect(isSelfEmail(session(), 'other@example.com')).toBe(false)
    })
  })

  describe('requireOwnership', () => {
    it('returns 401 when there is no session', async () => {
      getServerSession.mockResolvedValue(null)
      const result = await requireOwnership('abc-user')
      expect(result.session).toBeNull()
      expect(result.response?.status).toBe(401)
      expect(getUserByEmail).not.toHaveBeenCalled()
    })

    it('returns 403 when the caller has no user record', async () => {
      getServerSession.mockResolvedValue(session())
      getUserByEmail.mockResolvedValue(undefined)
      const result = await requireOwnership('abc-user')
      expect(result.session).toBeNull()
      expect(result.response?.status).toBe(403)
    })

    it('returns 403 when the id belongs to someone else', async () => {
      getServerSession.mockResolvedValue(session())
      getUserByEmail.mockResolvedValue({ id: 'other-user', email: 'teacher@example.com' })
      const result = await requireOwnership('abc-user')
      expect(result.session).toBeNull()
      expect(result.response?.status).toBe(403)
    })

    it('returns the session when the id matches the caller', async () => {
      const s = session()
      getServerSession.mockResolvedValue(s)
      getUserByEmail.mockResolvedValue({ id: 'abc-user', email: 'teacher@example.com' })
      const result = await requireOwnership('abc-user')
      expect(result.session).toBe(s)
      expect(result.response).toBeNull()
    })
  })
})
