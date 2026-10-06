import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import AnalyticsTracker from './analytics-tracker'

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }))

const usePathnameMock = vi.mocked(usePathname)

describe('AnalyticsTracker', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let sendBeaconMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    usePathnameMock.mockReturnValue('/display')
    sessionStorage.clear()
    fetchMock = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('fetch', fetchMock)
    sendBeaconMock = vi.fn().mockReturnValue(true)
    Object.defineProperty(window.navigator, 'sendBeacon', {
      value: sendBeaconMock,
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends one beacon per page per session via sendBeacon', () => {
    render(<AnalyticsTracker />)
    expect(sendBeaconMock).toHaveBeenCalledTimes(1)
    const [url, blob] = sendBeaconMock.mock.calls[0]
    expect(url).toBe('/api/track')
    expect(blob).toBeInstanceOf(Blob)
    expect(sessionStorage.getItem('ss:/display')).toBe('1')
  })

  it('does not resend when the page was already tracked this session', () => {
    sessionStorage.setItem('ss:/display', '1')
    render(<AnalyticsTracker />)
    expect(sendBeaconMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to fetch with keepalive when sendBeacon is unavailable', async () => {
    // Remove the property entirely so `"sendBeacon" in navigator` is false.
    const nav = window.navigator as unknown as Record<string, unknown>
    const original = nav.sendBeacon
    delete nav.sendBeacon
    try {
      render(<AnalyticsTracker />)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('/api/track')
      expect(init.method).toBe('POST')
      expect(init.keepalive).toBe(true)
      expect(JSON.parse(init.body)).toEqual({ path: '/display' })
    } finally {
      nav.sendBeacon = original
    }
  })

  it('falls back to fetch when sendBeacon returns false', () => {
    sendBeaconMock.mockReturnValue(false)
    render(<AnalyticsTracker />)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('renders nothing visible', () => {
    const { container } = render(<AnalyticsTracker />)
    expect(container).toBeEmptyDOMElement()
  })

  it('does nothing when sessionStorage is unavailable', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    try {
      render(<AnalyticsTracker />)
      expect(sendBeaconMock).not.toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      setItem.mockRestore()
    }
  })
})
