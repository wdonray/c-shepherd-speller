import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }))
vi.mock('@/lib/require-auth', () => ({ requireUser }))

const { getUserVideoLibrary, addVideoToUserLibrary } = vi.hoisted(() => ({
  getUserVideoLibrary: vi.fn(),
  addVideoToUserLibrary: vi.fn(),
}))
vi.mock('@/lib/db-utils', () => ({ getUserVideoLibrary, addVideoToUserLibrary }))

import { GET, POST } from './route'

const authed = { user: { id: 'u1', email: 't@example.com' }, response: null }
const video = { videoId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', source: 'custom' }

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/video-library', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('GET /api/video-library', () => {
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

  it('returns the caller video library', async () => {
    requireUser.mockResolvedValue(authed)
    getUserVideoLibrary.mockResolvedValue([video])
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ videos: [video] })
    expect(getUserVideoLibrary).toHaveBeenCalledWith('u1')
  })

  it('returns 500 when the read fails', async () => {
    requireUser.mockResolvedValue(authed)
    getUserVideoLibrary.mockRejectedValue(new Error('boom'))
    const res = await GET()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to get video library' })
  })
})

describe('POST /api/video-library', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not signed in', async () => {
    requireUser.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })
    const res = await POST(jsonRequest({ video }))
    expect(res.status).toBe(401)
  })

  it('appends the video and returns the updated library', async () => {
    requireUser.mockResolvedValue(authed)
    addVideoToUserLibrary.mockResolvedValue([video])
    const res = await POST(jsonRequest({ video }))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ videos: [video] })
    expect(addVideoToUserLibrary).toHaveBeenCalledWith('u1', video)
  })

  it('returns 400 for invalid video data', async () => {
    requireUser.mockResolvedValue(authed)
    const res = await POST(jsonRequest({ video: { videoId: 'nope', title: '' } }))
    expect(res.status).toBe(400)
    expect(addVideoToUserLibrary).not.toHaveBeenCalled()
  })

  it('returns 400 when the body has no video', async () => {
    requireUser.mockResolvedValue(authed)
    const res = await POST(jsonRequest(null))
    expect(res.status).toBe(400)
    expect(addVideoToUserLibrary).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid JSON', async () => {
    requireUser.mockResolvedValue(authed)
    const res = await POST(new NextRequest('http://localhost/api/video-library', { method: 'POST', body: '{oops' }))
    expect(res.status).toBe(400)
  })

  it('returns 500 when the write fails', async () => {
    requireUser.mockResolvedValue(authed)
    addVideoToUserLibrary.mockRejectedValue(new Error('boom'))
    const res = await POST(jsonRequest({ video }))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to add video to library' })
  })
})
