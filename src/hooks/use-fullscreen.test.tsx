import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useFullscreen } from './use-fullscreen'

const requestFullscreen = vi.fn()
const exitFullscreen = vi.fn()

function Probe() {
  const { isFullscreen, isSupported, toggleFullscreen } = useFullscreen()
  return (
    <div>
      <p data-testid="supported">{String(isSupported)}</p>
      <p data-testid="fullscreen">{String(isFullscreen)}</p>
      <button type="button" onClick={() => void toggleFullscreen()}>
        toggle
      </button>
    </div>
  )
}

function setFullscreenApi(available: boolean) {
  Object.defineProperty(document.documentElement, 'requestFullscreen', {
    configurable: true,
    writable: true,
    value: available ? requestFullscreen : undefined,
  })
}

function setFullscreenElement(element: Element | null) {
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, writable: true, value: element })
}

describe('useFullscreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setFullscreenApi(true)
    requestFullscreen.mockResolvedValue(undefined)
    exitFullscreen.mockResolvedValue(undefined)
    setFullscreenElement(null)
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, writable: true, value: exitFullscreen })
  })

  afterEach(() => {
    // Restore the real (absent in jsdom) state between tests.
    setFullscreenApi(false)
    setFullscreenElement(null)
  })

  it('reports support when the Fullscreen API exists', () => {
    render(<Probe />)
    expect(screen.getByTestId('supported')).toHaveTextContent('true')
    expect(screen.getByTestId('fullscreen')).toHaveTextContent('false')
  })

  it('reports no support when the Fullscreen API is missing', () => {
    setFullscreenApi(false)
    render(<Probe />)
    expect(screen.getByTestId('supported')).toHaveTextContent('false')
  })

  it('syncs the initial state when mounting while already in full screen', () => {
    setFullscreenElement(document.documentElement)
    render(<Probe />)
    expect(screen.getByTestId('fullscreen')).toHaveTextContent('true')
  })

  it('tracks full screen entry and exit through fullscreenchange', () => {
    render(<Probe />)
    act(() => {
      setFullscreenElement(document.documentElement)
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    expect(screen.getByTestId('fullscreen')).toHaveTextContent('true')
    act(() => {
      setFullscreenElement(null)
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    expect(screen.getByTestId('fullscreen')).toHaveTextContent('false')
  })

  it('requests full screen on toggle when not in full screen', async () => {
    render(<Probe />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'toggle' }))
    })
    expect(requestFullscreen).toHaveBeenCalledTimes(1)
    expect(exitFullscreen).not.toHaveBeenCalled()
  })

  it('exits full screen on toggle when already in full screen', async () => {
    setFullscreenElement(document.documentElement)
    render(<Probe />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'toggle' }))
    })
    expect(exitFullscreen).toHaveBeenCalledTimes(1)
    expect(requestFullscreen).not.toHaveBeenCalled()
  })

  it('stays usable when the full screen request rejects', async () => {
    requestFullscreen.mockRejectedValue(new Error('not allowed'))
    render(<Probe />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'toggle' }))
    })
    // Still mounted and still offering the toggle; state keeps reflecting
    // reality through fullscreenchange.
    expect(screen.getByTestId('fullscreen')).toHaveTextContent('false')
  })

  it('exits full screen on Escape while in full screen (issue #380)', () => {
    render(<Probe />)
    act(() => {
      setFullscreenElement(document.documentElement)
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    expect(screen.getByTestId('fullscreen')).toHaveTextContent('true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(exitFullscreen).toHaveBeenCalledTimes(1)
  })

  it('does nothing on Escape when not in full screen', () => {
    render(<Probe />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(exitFullscreen).not.toHaveBeenCalled()
  })

  it('tolerates a rejected exit on Escape (already exited between check and call)', async () => {
    exitFullscreen.mockRejectedValueOnce(new Error('already exited'))
    render(<Probe />)
    act(() => {
      setFullscreenElement(document.documentElement)
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    fireEvent.keyDown(document, { key: 'Escape' })
    // Flush the rejection through the handler's catch so the suite sees no
    // unhandled rejection.
    await act(async () => {})
    expect(exitFullscreen).toHaveBeenCalledTimes(1)
  })

  it('ignores non-Escape keys', () => {
    setFullscreenElement(document.documentElement)
    render(<Probe />)
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(exitFullscreen).not.toHaveBeenCalled()
  })
})
