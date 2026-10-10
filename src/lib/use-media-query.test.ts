import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMediaQuery } from './use-media-query'

describe('useMediaQuery', () => {
  it('returns false when matchMedia is unavailable', () => {
    const original = window.matchMedia
    // @ts-expect-error intentionally removing matchMedia
    window.matchMedia = undefined
    try {
      const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'))
      expect(result.current).toBe(false)
    } finally {
      window.matchMedia = original
    }
  })

  it('returns the current match state and updates on change', () => {
    const listeners = new Set<(e: { matches: boolean }) => void>()
    const mql = {
      matches: false,
      media: '',
      onchange: null,
      addEventListener: vi.fn((_: string, cb: (e: { matches: boolean }) => void) => listeners.add(cb)),
      removeEventListener: vi.fn((_: string, cb: (e: { matches: boolean }) => void) => listeners.delete(cb)),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia
    try {
      const { result, unmount } = renderHook(() => useMediaQuery('(max-width: 767px)'))
      expect(result.current).toBe(false)
      act(() => {
        listeners.forEach((cb) => cb({ matches: true }))
      })
      expect(result.current).toBe(true)
      unmount()
      expect(mql.removeEventListener).toHaveBeenCalled()
    } finally {
      window.matchMedia = original
    }
  })
})
