import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getVideoLibrary, addVideoToLibrary } from './video-library-api'
import { HttpError } from '@/lib/error-toast'

describe('video-library-api (issue #458)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const mockFetch = () => vi.mocked(fetch)
  const video = { videoId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', source: 'custom' as const }

  it('getVideoLibrary returns the videos array', async () => {
    mockFetch().mockResolvedValueOnce({ ok: true, json: async () => ({ videos: [video] }) } as Response)
    expect(await getVideoLibrary()).toEqual([video])
    expect(fetch).toHaveBeenCalledWith('/api/video-library')
  })

  it('getVideoLibrary throws HttpError on failure', async () => {
    mockFetch().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Failed to get video library' }),
    } as Response)
    const error = await getVideoLibrary().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(HttpError)
    expect((error as HttpError).status).toBe(500)
  })

  it('getVideoLibrary falls back to a generic message without an error body', async () => {
    mockFetch().mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) } as Response)
    const error = await getVideoLibrary().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(HttpError)
    expect((error as Error).message).toBe('Request failed with status 502')
  })

  it('getVideoLibrary returns an empty collection for a malformed success body', async () => {
    mockFetch().mockResolvedValueOnce({ ok: true, json: async () => ({ user: { id: 'u1' } }) } as Response)
    expect(await getVideoLibrary()).toEqual([])
  })

  it('getVideoLibrary throws a generic HttpError when the error body is unreadable', async () => {
    mockFetch().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('bad json')),
    } as Response)
    const error = await getVideoLibrary().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(HttpError)
    expect((error as Error).message).toBe('Request failed with status 500')
  })

  it('addVideoToLibrary posts the video and returns the updated collection', async () => {
    mockFetch().mockResolvedValueOnce({ ok: true, json: async () => ({ videos: [video] }) } as Response)
    expect(await addVideoToLibrary(video)).toEqual([video])
    expect(fetch).toHaveBeenCalledWith('/api/video-library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video }),
    })
  })

  it('addVideoToLibrary throws HttpError on failure', async () => {
    mockFetch().mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Forbidden' }),
    } as Response)
    const error = await addVideoToLibrary(video).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(HttpError)
    expect((error as HttpError).status).toBe(403)
  })
})
