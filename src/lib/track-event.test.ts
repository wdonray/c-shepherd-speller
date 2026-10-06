import { describe, it, expect, vi, afterEach } from 'vitest'
import { trackEvent } from './track-event'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('trackEvent', () => {
  it('sends the event via sendBeacon when available', () => {
    const sendBeacon = vi.fn().mockReturnValue(true)
    vi.stubGlobal('navigator', { sendBeacon })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    trackEvent('list-created')

    expect(sendBeacon).toHaveBeenCalledTimes(1)
    const [url, blob] = sendBeacon.mock.calls[0] as [string, Blob]
    expect(url).toBe('/api/track')
    expect(blob.type).toBe('application/json')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to fetch with keepalive when sendBeacon is unavailable', async () => {
    vi.stubGlobal('navigator', {})
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    trackEvent('words-practiced', 7)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/track')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ event: 'words-practiced', count: 7 }))
    expect(init.keepalive).toBe(true)
  })

  it('falls back to fetch when sendBeacon returns false', () => {
    const sendBeacon = vi.fn().mockReturnValue(false)
    vi.stubGlobal('navigator', { sendBeacon })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    trackEvent('practice-session')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('never throws when the network fails', () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(() => trackEvent('list-created')).not.toThrow()
  })
})
