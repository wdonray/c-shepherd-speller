import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { timeoutSignal } from './timeout-signal'

const originalTimeout = AbortSignal.timeout

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  Object.defineProperty(AbortSignal, 'timeout', { value: originalTimeout, configurable: true })
  vi.useRealTimers()
})

function removeAbortSignalTimeout() {
  Object.defineProperty(AbortSignal, 'timeout', { value: undefined, configurable: true })
}

describe('timeoutSignal', () => {
  it('uses the native AbortSignal.timeout when available', async () => {
    // The native signal runs on a real timer Vitest's fake timers cannot
    // advance, so this case runs on real timers with a short timeout.
    vi.useRealTimers()
    const nativeSpy = vi.spyOn(AbortSignal, 'timeout')
    const signal = timeoutSignal(10)
    expect(nativeSpy).toHaveBeenCalledWith(10)
    expect(signal.aborted).toBe(false)

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(signal.aborted).toBe(true)
    // Name only, not instanceof: the native reason comes from Node's
    // DOMException realm, which jsdom's instanceof does not recognize.
    expect((signal.reason as DOMException).name).toBe('TimeoutError')
  })

  it('falls back to a manual timeout when AbortSignal.timeout is missing', () => {
    removeAbortSignalTimeout()
    const signal = timeoutSignal(1000)
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(signal.aborted).toBe(false)

    vi.advanceTimersByTime(999)
    expect(signal.aborted).toBe(false)

    vi.advanceTimersByTime(1)
    expect(signal.aborted).toBe(true)
    expect(signal.reason).toBeInstanceOf(DOMException)
    expect((signal.reason as DOMException).name).toBe('TimeoutError')
  })
})
