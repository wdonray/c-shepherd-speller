import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import FullscreenButton from './FullscreenButton'

const requestFullscreen = vi.fn()
const exitFullscreen = vi.fn()

function setFullscreenApi(available: boolean) {
  if (available) {
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      writable: true,
      value: requestFullscreen,
    })
  } else {
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      writable: true,
      value: undefined,
    })
  }
}

describe('FullscreenButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setFullscreenApi(true)
    requestFullscreen.mockResolvedValue(undefined)
    exitFullscreen.mockResolvedValue(undefined)
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, writable: true, value: null })
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, writable: true, value: exitFullscreen })
  })

  afterEach(() => {
    // Restore the real (absent in jsdom) state between tests.
    setFullscreenApi(false)
  })

  it('renders an enter full screen button when supported', () => {
    render(<FullscreenButton />)
    const button = screen.getByRole('button', { name: 'Enter full screen' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('requests full screen on click', async () => {
    render(<FullscreenButton />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enter full screen' }))
    })
    expect(requestFullscreen).toHaveBeenCalledTimes(1)
    expect(exitFullscreen).not.toHaveBeenCalled()
  })

  it('exits full screen on click when already in full screen', async () => {
    render(<FullscreenButton />)
    act(() => {
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, writable: true, value: document.body })
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    const button = screen.getByRole('button', { name: 'Exit full screen' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    await act(async () => {
      fireEvent.click(button)
    })
    expect(exitFullscreen).toHaveBeenCalledTimes(1)
    expect(requestFullscreen).not.toHaveBeenCalled()
  })

  it('updates the label when full screen is left outside the button', () => {
    render(<FullscreenButton />)
    act(() => {
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, writable: true, value: document.body })
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    expect(screen.getByRole('button', { name: 'Exit full screen' })).toBeInTheDocument()
    act(() => {
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, writable: true, value: null })
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    expect(screen.getByRole('button', { name: 'Enter full screen' })).toBeInTheDocument()
  })

  it('syncs the initial state when mounting while already in full screen', () => {
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, writable: true, value: document.body })
    render(<FullscreenButton />)
    const button = screen.getByRole('button', { name: 'Exit full screen' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('treats an undefined fullscreenElement as not fullscreen on mount', () => {
    // jsdom has no Fullscreen API: fullscreenElement is undefined, not null.
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, writable: true, value: undefined })
    render(<FullscreenButton />)
    expect(screen.getByRole('button', { name: 'Enter full screen' })).toBeInTheDocument()
  })

  it('renders nothing when the Fullscreen API is unavailable', () => {
    setFullscreenApi(false)
    const { container } = render(<FullscreenButton />)
    expect(container).toBeEmptyDOMElement()
  })

  it('stays usable when the full screen request rejects', async () => {
    requestFullscreen.mockRejectedValue(new Error('not allowed'))
    render(<FullscreenButton />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enter full screen' }))
    })
    // The button is still there and still offers to enter full screen.
    expect(screen.getByRole('button', { name: 'Enter full screen' })).toBeInTheDocument()
  })

  it('shows a visible text label with alwaysShowLabel instead of an icon-only button', () => {
    render(<FullscreenButton alwaysShowLabel />)
    const button = screen.getByRole('button', { name: 'Full screen' })
    expect(button).toHaveTextContent('Full screen')
    expect(button).not.toHaveAttribute('aria-label')
  })

  it('merges an extra className onto the button', () => {
    render(<FullscreenButton className="w-full" />)
    expect(screen.getByRole('button', { name: 'Enter full screen' })).toHaveClass('w-full')
  })
})
