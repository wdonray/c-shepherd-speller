'use client'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLocalStorage } from './use-local-storage'

describe('useLocalStorage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the default when nothing is stored', () => {
    const { result } = renderHook(() => useLocalStorage<string>('k', 'default'))
    expect(result.current[0]).toBe('default')
  })

  it('reads a previously stored value', () => {
    window.localStorage.setItem('k', 'stored')
    const { result } = renderHook(() => useLocalStorage<string>('k', 'default'))
    expect(result.current[0]).toBe('stored')
  })

  it('persists new values to localStorage', () => {
    const { result } = renderHook(() => useLocalStorage<string>('k', 'default'))
    act(() => {
      result.current[1]('next')
    })
    expect(result.current[0]).toBe('next')
    expect(window.localStorage.getItem('k')).toBe('next')
  })

  it('falls back to the default when reading throws', () => {
    // jsdom's Storage methods are not spyable; stub the global instead.
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {},
    })
    const { result } = renderHook(() => useLocalStorage<string>('k', 'default'))
    expect(result.current[0]).toBe('default')
  })

  it('keeps the in-memory value when writing throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('full')
      },
    })
    const { result } = renderHook(() => useLocalStorage<string>('k', 'default'))
    act(() => {
      result.current[1]('next')
    })
    expect(result.current[0]).toBe('next')
  })
})
