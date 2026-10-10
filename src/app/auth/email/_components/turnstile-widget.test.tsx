import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { createRef } from 'react'
import TurnstileWidget, { type TurnstileHandle, resetTurnstileScript } from './turnstile-widget'

interface RenderOptions {
  sitekey: string
  size: string
  callback: (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
}

describe('TurnstileWidget', () => {
  let renderMock: ReturnType<typeof vi.fn>
  let executeMock: ReturnType<typeof vi.fn>
  let removeMock: ReturnType<typeof vi.fn>
  let capturedOptions: RenderOptions | null

  beforeEach(() => {
    capturedOptions = null
    resetTurnstileScript()
    renderMock = vi.fn((_el: HTMLElement, options: RenderOptions) => {
      capturedOptions = options
      return 'widget-1'
    })
    executeMock = vi.fn()
    removeMock = vi.fn()
    ;(window as unknown as { turnstile: unknown }).turnstile = {
      render: renderMock,
      execute: executeMock,
      remove: removeMock,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    delete (window as unknown as { turnstile?: unknown }).turnstile
  })

  it('renders the invisible widget with the site key', async () => {
    render(<TurnstileWidget siteKey="site-key-123" onToken={() => {}} />)
    await waitFor(() => expect(renderMock).toHaveBeenCalled())
    expect(capturedOptions?.sitekey).toBe('site-key-123')
    expect(capturedOptions?.size).toBe('invisible')
  })

  it('pre-warms the challenge after rendering', async () => {
    render(<TurnstileWidget siteKey="site-key-123" onToken={() => {}} />)
    await waitFor(() => expect(executeMock).toHaveBeenCalledWith('widget-1'))
  })

  it('delivers the token to onToken when the challenge succeeds', async () => {
    const onToken = vi.fn()
    render(<TurnstileWidget siteKey="site-key-123" onToken={onToken} />)
    await waitFor(() => expect(renderMock).toHaveBeenCalled())
    act(() => {
      capturedOptions?.callback('fresh-token')
    })
    expect(onToken).toHaveBeenCalledWith('fresh-token')
  })

  it('execute() returns the cached token without re-running the challenge', async () => {
    const ref = createRef<TurnstileHandle>()
    render(<TurnstileWidget ref={ref} siteKey="site-key-123" onToken={() => {}} />)
    await waitFor(() => expect(renderMock).toHaveBeenCalled())
    act(() => {
      capturedOptions?.callback('cached-token')
    })
    executeMock.mockClear()
    await expect(ref.current?.execute()).resolves.toBe('cached-token')
    expect(executeMock).not.toHaveBeenCalled()
  })

  it('execute() runs the challenge and resolves with the new token', async () => {
    const ref = createRef<TurnstileHandle>()
    render(<TurnstileWidget ref={ref} siteKey="site-key-123" onToken={() => {}} />)
    await waitFor(() => expect(renderMock).toHaveBeenCalled())
    executeMock.mockClear()
    const pending = ref.current?.execute()
    expect(executeMock).toHaveBeenCalledWith('widget-1')
    act(() => {
      capturedOptions?.callback('new-token')
    })
    await expect(pending).resolves.toBe('new-token')
  })

  it('clears the token when it expires', async () => {
    const onToken = vi.fn()
    const ref = createRef<TurnstileHandle>()
    render(<TurnstileWidget ref={ref} siteKey="site-key-123" onToken={onToken} />)
    await waitFor(() => expect(renderMock).toHaveBeenCalled())
    act(() => {
      capturedOptions?.callback('old-token')
    })
    act(() => {
      capturedOptions?.['expired-callback']()
    })
    expect(onToken).toHaveBeenLastCalledWith(null)
    // After expiry, execute() must re-run the challenge instead of reusing it.
    executeMock.mockClear()
    const pending = ref.current?.execute()
    expect(executeMock).toHaveBeenCalledWith('widget-1')
    act(() => {
      capturedOptions?.callback('refreshed-token')
    })
    await expect(pending).resolves.toBe('refreshed-token')
  })

  it('execute() resolves null when the challenge errors', async () => {
    const ref = createRef<TurnstileHandle>()
    render(<TurnstileWidget ref={ref} siteKey="site-key-123" onToken={() => {}} />)
    await waitFor(() => expect(renderMock).toHaveBeenCalled())
    const pending = ref.current?.execute()
    act(() => {
      capturedOptions?.['error-callback']()
    })
    await expect(pending).resolves.toBeNull()
  })

  it('execute() times out and resolves null when the challenge never answers', async () => {
    const ref = createRef<TurnstileHandle>()
    render(<TurnstileWidget ref={ref} siteKey="site-key-123" onToken={() => {}} />)
    await waitFor(() => expect(renderMock).toHaveBeenCalled())
    vi.useFakeTimers()
    try {
      const pending = ref.current?.execute()
      expect(executeMock).toHaveBeenCalledWith('widget-1')
      vi.advanceTimersByTime(15_000)
      await expect(pending).resolves.toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('execute() resolves null when the widget failed to initialize', async () => {
    const ref = createRef<TurnstileHandle>()
    // No window.turnstile and no network: the script can never load in jsdom.
    delete (window as unknown as { turnstile?: unknown }).turnstile
    const appendSpy = vi.spyOn(document.head, 'appendChild')
    const onUnavailable = vi.fn()
    render(<TurnstileWidget ref={ref} siteKey="site-key-123" onToken={() => {}} onUnavailable={onUnavailable} />)
    // The script element is appended but never loads; simulate the error.
    await waitFor(() => expect(appendSpy).toHaveBeenCalled())
    const script = appendSpy.mock.calls[0][0] as HTMLScriptElement
    act(() => {
      script.dispatchEvent(new Event('error'))
    })
    await waitFor(() => expect(onUnavailable).toHaveBeenCalled())
    await expect(ref.current?.execute()).resolves.toBeNull()
  })

  it('removes the widget on unmount', async () => {
    const { unmount } = render(<TurnstileWidget siteKey="site-key-123" onToken={() => {}} />)
    await waitFor(() => expect(renderMock).toHaveBeenCalled())
    unmount()
    expect(removeMock).toHaveBeenCalledWith('widget-1')
  })

  it('shares one script load across concurrent mounts', async () => {
    delete (window as unknown as { turnstile?: unknown }).turnstile
    const appendSpy = vi.spyOn(document.head, 'appendChild')
    const onToken = vi.fn()
    render(<TurnstileWidget siteKey="k1" onToken={onToken} />)
    render(<TurnstileWidget siteKey="k2" onToken={onToken} />)

    await waitFor(() => expect(appendSpy).toHaveBeenCalled())
    expect(appendSpy).toHaveBeenCalledTimes(1)

    // The script loads and installs the API; both widgets render.
    const script = appendSpy.mock.calls[0][0] as HTMLScriptElement
    ;(window as unknown as { turnstile: unknown }).turnstile = {
      render: renderMock,
      execute: executeMock,
      remove: removeMock,
    }
    await act(async () => {
      script.dispatchEvent(new Event('load'))
    })
    await waitFor(() => expect(renderMock).toHaveBeenCalledTimes(2))
  })

  it('stays silent when unmounted before the script loads', async () => {
    delete (window as unknown as { turnstile?: unknown }).turnstile
    const appendSpy = vi.spyOn(document.head, 'appendChild')
    const onUnavailable = vi.fn()
    const { unmount } = render(
      <TurnstileWidget siteKey="site-key-123" onToken={() => {}} onUnavailable={onUnavailable} />
    )

    await waitFor(() => expect(appendSpy).toHaveBeenCalled())
    unmount()
    const script = appendSpy.mock.calls[0][0] as HTMLScriptElement
    ;(window as unknown as { turnstile: unknown }).turnstile = {
      render: renderMock,
      execute: executeMock,
      remove: removeMock,
    }
    await act(async () => {
      script.dispatchEvent(new Event('load'))
    })
    expect(onUnavailable).not.toHaveBeenCalled()
    expect(renderMock).not.toHaveBeenCalled()
  })

  it('handles a script load with no API installed and no onUnavailable handler', async () => {
    delete (window as unknown as { turnstile?: unknown }).turnstile
    const appendSpy = vi.spyOn(document.head, 'appendChild')
    render(<TurnstileWidget siteKey="site-key-123" />)

    await waitFor(() => expect(appendSpy).toHaveBeenCalled())
    const script = appendSpy.mock.calls[0][0] as HTMLScriptElement
    // window.turnstile stays unset: the load resolves to null.
    await act(async () => {
      script.dispatchEvent(new Event('load'))
    })
    expect(renderMock).not.toHaveBeenCalled()
  })

  it('clears a stale token when the challenge errors without a pending execute', async () => {
    const onToken = vi.fn()
    render(<TurnstileWidget siteKey="site-key-123" onToken={onToken} />)
    await waitFor(() => expect(renderMock).toHaveBeenCalled())
    act(() => {
      capturedOptions?.callback('stale-token')
    })
    act(() => {
      capturedOptions?.['error-callback']()
    })
    expect(onToken).toHaveBeenLastCalledWith(null)
  })

  it('ignores the execute timeout once the token already arrived', async () => {
    const ref = createRef<TurnstileHandle>()
    render(<TurnstileWidget ref={ref} siteKey="site-key-123" onToken={() => {}} />)
    await waitFor(() => expect(renderMock).toHaveBeenCalled())
    vi.useFakeTimers()
    try {
      const pending = ref.current?.execute()
      act(() => {
        capturedOptions?.callback('early-token')
      })
      await expect(pending).resolves.toBe('early-token')
      // The timeout still fires, but the pending resolver is gone: a no-op.
      vi.advanceTimersByTime(15_000)
      await expect(ref.current?.execute()).resolves.toBe('early-token')
    } finally {
      vi.useRealTimers()
    }
  })
})
