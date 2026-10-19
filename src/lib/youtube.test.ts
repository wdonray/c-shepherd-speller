import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  extractYouTubeId,
  fetchVideoTitle,
  isYouTubeVideoId,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
  OEMBED_TIMEOUT_MS,
} from './youtube'

describe('isYouTubeVideoId', () => {
  it.each(['GdmcWQCbqY8', 'mxVWScxsOsc', 'QSU9Y-NYJDk', 'NK8_Tvu6bJk', 'aaaaaaaaaaa', '----------_', '___________'])(
    'accepts the valid ID %s',
    (id) => {
      expect(isYouTubeVideoId(id)).toBe(true)
    }
  )

  it.each([
    '',
    'short',
    'way-too-long-video-id',
    'GdmcWQCbqY8!',
    'GdmcWQCbqY8 ',
    ' GdmcWQCbqY8',
    'https://www.youtube.com/watch?v=GdmcWQCbqY8',
  ])('rejects %s', (id) => {
    expect(isYouTubeVideoId(id)).toBe(false)
  })
})

describe('extractYouTubeId', () => {
  it.each([
    ['GdmcWQCbqY8', 'GdmcWQCbqY8'],
    ['  GdmcWQCbqY8  ', 'GdmcWQCbqY8'],
    ['https://www.youtube.com/watch?v=GdmcWQCbqY8', 'GdmcWQCbqY8'],
    ['https://youtube.com/watch?v=GdmcWQCbqY8&t=42s', 'GdmcWQCbqY8'],
    ['https://m.youtube.com/watch?v=GdmcWQCbqY8', 'GdmcWQCbqY8'],
    ['http://www.youtube.com/watch?v=GdmcWQCbqY8', 'GdmcWQCbqY8'],
    ['www.youtube.com/watch?v=GdmcWQCbqY8', 'GdmcWQCbqY8'],
    ['https://youtu.be/GdmcWQCbqY8', 'GdmcWQCbqY8'],
    ['https://youtu.be/GdmcWQCbqY8?t=30', 'GdmcWQCbqY8'],
    ['https://www.youtube.com/embed/GdmcWQCbqY8', 'GdmcWQCbqY8'],
    ['https://www.youtube.com/shorts/GdmcWQCbqY8', 'GdmcWQCbqY8'],
    ['https://www.youtube.com/live/GdmcWQCbqY8', 'GdmcWQCbqY8'],
    ['https://www.youtube.com/v/GdmcWQCbqY8', 'GdmcWQCbqY8'],
    ['https://www.youtube-nocookie.com/embed/GdmcWQCbqY8', 'GdmcWQCbqY8'],
  ])('extracts the ID from %s', (input, expected) => {
    expect(extractYouTubeId(input)).toBe(expected)
  })

  it.each([
    '',
    '   ',
    'not a url at all',
    'https://www.youtube.com/watch',
    'https://www.youtube.com/watch?v=',
    'https://www.youtube.com/watch?v=short',
    'https://youtu.be/',
    'https://youtu.be/tooshort',
    'https://www.youtube.com/embed/',
    'https://www.youtube.com/playlist?list=PL123',
    'https://www.youtube.com/embed/tooshort',
    'https://www.youtube.com/shorts/not-an-id!!',
    'https://www.youtube.com/@somechannel',
    'https://vimeo.com/123456789',
    'https://example.com/watch?v=GdmcWQCbqY8',
    'https://music.youtube.com/watch?v=GdmcWQCbqY8',
  ])('returns null for %s', (input) => {
    expect(extractYouTubeId(input)).toBeNull()
  })
})

describe('youtubeEmbedUrl', () => {
  it('builds the privacy-enhanced embed URL with captions on and no related videos', () => {
    expect(youtubeEmbedUrl('GdmcWQCbqY8')).toBe(
      'https://www.youtube-nocookie.com/embed/GdmcWQCbqY8?rel=0&cc_load_policy=1'
    )
  })
})

describe('youtubeThumbnailUrl', () => {
  it('builds the thumbnail URL', () => {
    expect(youtubeThumbnailUrl('GdmcWQCbqY8')).toBe('https://i.ytimg.com/vi/GdmcWQCbqY8/hqdefault.jpg')
  })
})

describe('fetchVideoTitle', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('resolves the title and channel from oEmbed', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ title: 'Silent E | Phonics Song', author_name: 'Jack Hartmann' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchVideoTitle('mxVWScxsOsc')).resolves.toEqual({
      title: 'Silent E | Phonics Song',
      channel: 'Jack Hartmann',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('https://www.youtube.com/oembed?')
    expect(url).toContain(encodeURIComponent('https://www.youtube.com/watch?v=mxVWScxsOsc'))
  })

  it('omits the channel when oEmbed has no author name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ title: 'Some video' }) })
    )
    await expect(fetchVideoTitle('mxVWScxsOsc')).resolves.toEqual({ title: 'Some video' })
  })

  it('resolves undefined on a non-OK status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    await expect(fetchVideoTitle('mxVWScxsOsc')).resolves.toBeUndefined()
  })

  it('resolves undefined when the body has no title', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ title: 42 }) }))
    await expect(fetchVideoTitle('mxVWScxsOsc')).resolves.toBeUndefined()
  })

  it('resolves undefined when the body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.reject(new Error('bad json')) }))
    await expect(fetchVideoTitle('mxVWScxsOsc')).resolves.toBeUndefined()
  })

  it('resolves undefined on a network failure, with no retry', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Load failed'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchVideoTitle('mxVWScxsOsc')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('aborts the oEmbed fetch when it times out, with no retry', async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = vi.fn((_url: string, opts?: { signal: AbortSignal }) => {
        const { signal } = opts as { signal: AbortSignal }
        return new Promise<never>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Fetch aborted', 'AbortError')))
        })
      })
      vi.stubGlobal('fetch', fetchMock)
      const promise = fetchVideoTitle('mxVWScxsOsc')
      await vi.advanceTimersByTimeAsync(OEMBED_TIMEOUT_MS)
      await expect(promise).resolves.toBeUndefined()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
