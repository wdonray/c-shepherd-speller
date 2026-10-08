import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MIN_REFOCUS_POLL_GAP_MS, POLL_INTERVAL_MS, useNewVersionAvailable } from './useNewVersionAvailable'

function Probe() {
  const updateAvailable = useNewVersionAvailable()
  return <p data-testid="update">{String(updateAvailable)}</p>
}

function versionResponse(version: unknown, ok = true): Response {
  return { ok, json: async () => ({ version }) } as unknown as Response
}

const fetchMock = vi.fn()

function setVisibilityState(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  setVisibilityState('visible')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useNewVersionAvailable', () => {
  it('captures the loaded version on mount and stays quiet while it matches', async () => {
    fetchMock.mockResolvedValue(versionResponse('1.0.0'))
    render(<Probe />)
    await act(async () => {})
    expect(screen.getByTestId('update')).toHaveTextContent('false')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('update')).toHaveTextContent('false')
    expect(fetchMock).toHaveBeenCalledWith('/api/version', expect.objectContaining({ cache: 'no-store' }))
  })

  it('reports an update when a later poll returns a different version', async () => {
    fetchMock.mockResolvedValueOnce(versionResponse('1.0.0')).mockResolvedValue(versionResponse('1.0.1'))
    render(<Probe />)
    await act(async () => {})
    expect(screen.getByTestId('update')).toHaveTextContent('false')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    })
    expect(screen.getByTestId('update')).toHaveTextContent('true')
  })

  it('skips malformed or failed responses silently and keeps the original baseline', async () => {
    fetchMock
      .mockResolvedValueOnce(versionResponse('1.0.0'))
      .mockResolvedValueOnce(versionResponse({ nope: true }))
      .mockResolvedValueOnce(versionResponse('1.0.0', false))
      .mockResolvedValueOnce({ ok: true, json: async () => null } as unknown as Response)
      .mockResolvedValueOnce(versionResponse('2.0.0'))
    render(<Probe />)
    await act(async () => {})

    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
      })
      expect(screen.getByTestId('update')).toHaveTextContent('false')
    }
    expect(fetchMock).toHaveBeenCalledTimes(4)

    // The baseline survived the bad polls, so a real change still reports.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    })
    expect(screen.getByTestId('update')).toHaveTextContent('true')
  })

  it('stays silent when the network fails, then baselines on the next success', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(versionResponse('1.0.0'))
    render(<Probe />)
    await act(async () => {})
    expect(screen.getByTestId('update')).toHaveTextContent('false')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('update')).toHaveTextContent('false')

    // A mid-session failure is skipped the same way.
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    })
    expect(screen.getByTestId('update')).toHaveTextContent('false')
  })

  it('re-polls on visibilitychange only when the last poll was over a minute ago', async () => {
    fetchMock.mockResolvedValue(versionResponse('1.0.0'))
    render(<Probe />)
    await act(async () => {})
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MIN_REFOCUS_POLL_GAP_MS + 1)
    })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('ignores visibilitychange while the tab is hidden', async () => {
    fetchMock.mockResolvedValue(versionResponse('1.0.0'))
    render(<Probe />)
    await act(async () => {})

    setVisibilityState('hidden')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(MIN_REFOCUS_POLL_GAP_MS + 1)
    })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('re-polls on window focus only when the last poll was over a minute ago', async () => {
    fetchMock.mockResolvedValue(versionResponse('1.0.0'))
    render(<Probe />)
    await act(async () => {})

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MIN_REFOCUS_POLL_GAP_MS + 1)
    })
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('stops polling after unmount', async () => {
    fetchMock.mockResolvedValue(versionResponse('1.0.0'))
    const { unmount } = render(<Probe />)
    await act(async () => {})
    unmount()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('ignores a poll that resolves after unmount', async () => {
    let resolveFetch!: (res: Response) => void
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve
      })
    )
    const { unmount } = render(<Probe />)
    await act(async () => {})
    unmount()

    await act(async () => {
      resolveFetch(versionResponse('9.9.9'))
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
