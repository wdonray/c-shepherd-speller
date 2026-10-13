import { describe, it, expect, vi, afterEach } from 'vitest'
import confetti from 'canvas-confetti'
import { fireWinConfetti } from './confetti'

vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

const mockedConfetti = vi.mocked(confetti)
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
  afterEach(() => {
    window.matchMedia = originalMatchMedia
    vi.clearAllMocks()
  })

  it('fires a restrained burst in brand colors from the top of the win overlay', () => {
    mockReducedMotion(false)
    fireWinConfetti()
    expect(mockedConfetti).toHaveBeenCalledTimes(1)
    const options = mockedConfetti.mock.calls[0]![0]!
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
    expect(mockedConfetti).not.toHaveBeenCalled()
  })
})
