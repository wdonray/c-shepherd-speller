import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import AnalyticsTracker from './analytics-tracker'

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }))

const mockIsHeadless = vi.fn().mockReturnValue(false)
const mockStart = vi.fn()
const mockStop = vi.fn()
vi.mock('@wdonray/analytics-core/client', () => ({
  isHeadlessBrowser: (...args: unknown[]) => mockIsHeadless(...args),
  createEngagementTracker: vi.fn(() => ({ start: mockStart, stop: mockStop })),
}))

const usePathnameMock = vi.mocked(usePathname)

describe('AnalyticsTracker', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let sendBeaconMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    usePathnameMock.mockReturnValue('/display')
    mockIsHeadless.mockReturnValue(false)
    mockStart.mockClear()
    mockStop.mockClear()
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

  it('sends one page-view beacon per page per session via sendBeacon', () => {
    render(<AnalyticsTracker />)
    expect(sendBeaconMock).toHaveBeenCalledTimes(1)
    const [url, blob] = sendBeaconMock.mock.calls[0]
    expect(url).toBe('/api/track')
    expect(blob).toBeInstanceOf(Blob)
    expect(sessionStorage.getItem('ss:/display')).toBe('1')
  })

  it('starts the engagement tracker after the page view', () => {
    render(<AnalyticsTracker />)
    expect(mockStart).toHaveBeenCalledTimes(1)
  })

  it('sends nothing when the browser is headless', () => {
    mockIsHeadless.mockReturnValue(true)
    render(<AnalyticsTracker />)
    expect(sendBeaconMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockStart).not.toHaveBeenCalled()
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
      expect(JSON.parse(init.body)).toEqual({ path: '/display', engaged: false })
    } finally {
      nav.sendBeacon = original
    }
  })

  it('falls back to fetch when sendBeacon returns false', () => {
    sendBeaconMock.mockReturnValue(false)
    render(<AnalyticsTracker />)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sends the engagement hit when the tracker fires', async () => {
    const { createEngagementTracker } = await import('@wdonray/analytics-core/client')
    render(<AnalyticsTracker />)
    const onEngaged = (
      vi.mocked(createEngagementTracker).mock.calls[0][0] as {
        onEngaged: () => void
      }
    ).onEngaged
    sendBeaconMock.mockClear()
    onEngaged()
    expect(sendBeaconMock).toHaveBeenCalledTimes(1)
    const [, blob] = sendBeaconMock.mock.calls[0] as [string, Blob]
    const text = await blob.text()
    expect(JSON.parse(text)).toEqual({ path: '/display', engaged: true })
  })

  it('reports fetch failures without crashing', async () => {
    const nav = window.navigator as unknown as Record<string, unknown>
    const original = nav.sendBeacon
    delete nav.sendBeacon
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    try {
      render(<AnalyticsTracker />)
      // Wait for the rejected promise's .catch() to run.
      await vi.waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1)
      })
      await new Promise((r) => setTimeout(r, 10))
    } finally {
      nav.sendBeacon = original
    }
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

  it('does nothing when the pathname is not available', () => {
    usePathnameMock.mockReturnValue(null as unknown as string)
    render(<AnalyticsTracker />)
    expect(sendBeaconMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
