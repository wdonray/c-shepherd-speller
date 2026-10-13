import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

const { fireMock, createMock } = vi.hoisted(() => {
  const fireMock = vi.fn()
  const createMock = vi.fn(() => fireMock)
  return { fireMock, createMock }
})

vi.mock('canvas-confetti', () => ({ default: { create: createMock } }))

const originalMatchMedia = window.matchMedia

function mockReducedMotion(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' ? matches : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })
}

describe('fireWinConfetti', () => {
  let fireWinConfetti: () => void

  beforeEach(async () => {
    // Fresh module state per test so the lazy cannon singleton does not
    // leak across tests.
    vi.resetModules()
    ;({ fireWinConfetti } = await import('./confetti'))
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    vi.clearAllMocks()
  })

  it('renders on the main thread: the app CSP blocks the blob worker', () => {
    // Regression: canvas-confetti defaults to a Web Worker, but the app's
    // Content-Security-Policy has no worker-src directive, so the worker is
    // blocked and confetti silently never renders.
    mockReducedMotion(false)
    fireWinConfetti()
    expect(createMock).toHaveBeenCalledWith(undefined, { useWorker: false, resize: true })
  })

  it('reuses the cannon across wins', () => {
    mockReducedMotion(false)
    fireWinConfetti()
    fireWinConfetti()
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(fireMock).toHaveBeenCalledTimes(2)
  })

  it('fires a restrained burst in brand colors from the top of the win overlay', () => {
    mockReducedMotion(false)
    fireWinConfetti()
    expect(fireMock).toHaveBeenCalledTimes(1)
    const options = fireMock.mock.calls[0]![0]!
    // Restrained: 24-32 pieces per the design spec.
    expect(options.particleCount).toBeGreaterThanOrEqual(24)
    expect(options.particleCount).toBeLessThanOrEqual(32)
    // Brand colors: leaf, sun, sky, coral.
    expect(options.colors).toEqual(['#367b17', '#ffc42e', '#2fa8de', '#b43c1c'])
    // Falls from the top of the overlay card area, ~1.8s of flight.
    expect(options.origin).toEqual({ x: 0.5, y: 0.3 })
    expect(options.ticks).toBeLessThanOrEqual(120)
    expect(options.disableForReducedMotion).toBe(true)
  })

  it('does not fire under prefers-reduced-motion', () => {
    mockReducedMotion(true)
    fireWinConfetti()
    expect(fireMock).not.toHaveBeenCalled()
    expect(createMock).not.toHaveBeenCalled()
  })
})
