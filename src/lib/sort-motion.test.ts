import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  SORT_SPRING,
  LIFT_TRANSITION,
  CROSSFADE_TRANSITION,
  PICKUP_SHADOW,
  prefersReducedMotion,
  settleTransition,
  feedbackAnimate,
} from './sort-motion'

describe('sort-motion', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defines the shared spring with the locked stiffness and damping', () => {
    expect(SORT_SPRING).toMatchObject({ type: 'spring', stiffness: 170, damping: 14 })
  })

  it('defines the pickup lift as a fast ease-out', () => {
    expect(LIFT_TRANSITION).toMatchObject({ duration: 0.05, ease: 'easeOut' })
  })

  it('defines the reduced-motion crossfade', () => {
    expect(CROSSFADE_TRANSITION).toMatchObject({ duration: 0.15, ease: 'easeOut' })
  })

  it('defines the pickup shadow', () => {
    expect(PICKUP_SHADOW).toContain('0 12px 32px')
  })

  it('detects reduced motion preference', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    expect(prefersReducedMotion()).toBe(true)
  })

  it('detects no reduced motion preference', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    expect(prefersReducedMotion()).toBe(false)
  })

  it('returns false when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(prefersReducedMotion()).toBe(false)
  })

  it('uses the crossfade when reduced motion is preferred', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    expect(settleTransition()).toBe(CROSSFADE_TRANSITION)
  })

  it('uses the spring otherwise', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    expect(settleTransition()).toBe(SORT_SPRING)
  })

  describe('feedbackAnimate', () => {
    it('returns no animation when reduced motion is preferred', () => {
      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
      expect(feedbackAnimate(true)).toEqual({})
      expect(feedbackAnimate(false)).toEqual({})
      expect(feedbackAnimate(null)).toEqual({})
    })

    it('returns no animation without a correctness state', () => {
      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
      expect(feedbackAnimate(null)).toEqual({})
    })

    it('returns a 240ms scale pulse for a correct drop', () => {
      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
      expect(feedbackAnimate(true)).toEqual({
        scale: [1, 1.18, 1],
        transition: { duration: 0.24, ease: 'easeOut' },
      })
    })

    it('returns a 400ms shake for an incorrect drop', () => {
      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
      expect(feedbackAnimate(false)).toEqual({
        rotate: [-4, 4, -2, 0],
        transition: { duration: 0.4, ease: 'easeInOut' },
      })
    })
  })
})
