import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { getToken } = vi.hoisted(() => ({
  getToken: vi.fn(),
}))
vi.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => getToken(...args),
}))

// Imported after the mock so the middleware binds to it.
import { middleware, config } from './middleware'

function request(url: string) {
  return new NextRequest(url)
}

describe('middleware', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns 401 JSON for API routes when there is no token', async () => {
    getToken.mockResolvedValue(null)
    const res = await middleware(request('http://localhost/api/users'))
    expect(getToken).toHaveBeenCalled()
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns 401 JSON for nested API routes (including api/auth) when there is no token', async () => {
    getToken.mockResolvedValue(null)
    const res = await middleware(request('http://localhost/api/auth/session'))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('redirects page requests to the signin page when there is no token', async () => {
    getToken.mockResolvedValue(null)
    const res = await middleware(request('http://localhost/'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/auth/signin')
  })

  it('passes the request through when a token is present', async () => {
    getToken.mockResolvedValue({ sub: 'user-1', email: 'teacher@example.com' })
    const res = await middleware(request('http://localhost/api/users'))
    expect(res.status).toBe(200)
  })

  it('passes page requests through when a token is present', async () => {
    getToken.mockResolvedValue({ sub: 'user-1' })
    const res = await middleware(request('http://localhost/'))
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })
})

describe('middleware config', () => {
  it('has a non-empty matcher array', () => {
    expect(Array.isArray(config.matcher)).toBe(true)
    expect(config.matcher.length).toBeGreaterThan(0)
  })
})
