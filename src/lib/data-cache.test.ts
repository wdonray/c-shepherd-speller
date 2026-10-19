import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  cachedGet,
  invalidateDataCache,
  invalidateDataCachePrefix,
  clearDataCache,
  DATA_CACHE_TTL_MS,
} from './data-cache'

describe('data-cache', () => {
  beforeEach(() => {
    clearDataCache()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('exposes a positive TTL', () => {
    expect(DATA_CACHE_TTL_MS).toBeGreaterThan(0)
  })

  it('fetches on a cold cache and returns the value', async () => {
    const fetcher = vi.fn().mockResolvedValue('fresh')
    await expect(cachedGet('k', fetcher)).resolves.toBe('fresh')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('serves repeat calls from the cache without refetching', async () => {
    const fetcher = vi.fn().mockResolvedValue({ lists: [1] })
    const first = await cachedGet('lists', fetcher)
    const second = await cachedGet('lists', fetcher)
    expect(second).toBe(first)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('caches different keys independently', async () => {
    const fetcherA = vi.fn().mockResolvedValue('a')
    const fetcherB = vi.fn().mockResolvedValue('b')
    await expect(cachedGet('a', fetcherA)).resolves.toBe('a')
    await expect(cachedGet('b', fetcherB)).resolves.toBe('b')
    expect(fetcherA).toHaveBeenCalledTimes(1)
    expect(fetcherB).toHaveBeenCalledTimes(1)
  })

  it('refetches after the TTL expires', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2')
    await expect(cachedGet('k', fetcher, 1000)).resolves.toBe('v1')
    vi.advanceTimersByTime(999)
    await expect(cachedGet('k', fetcher, 1000)).resolves.toBe('v1')
    expect(fetcher).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    await expect(cachedGet('k', fetcher, 1000)).resolves.toBe('v2')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('shares one fetch between simultaneous calls for the same key', async () => {
    let resolveFetch!: (value: string) => void
    const fetcher = vi.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveFetch = resolve
        })
    )
    const first = cachedGet('k', fetcher)
    const second = cachedGet('k', fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
    resolveFetch('shared')
    await expect(first).resolves.toBe('shared')
    await expect(second).resolves.toBe('shared')
    // The shared result is now cached too.
    await expect(cachedGet('k', fetcher)).resolves.toBe('shared')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('does not cache rejections and retries on the next call', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('recovered')
    await expect(cachedGet('k', fetcher)).rejects.toThrow('boom')
    await expect(cachedGet('k', fetcher)).resolves.toBe('recovered')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('clears the in-flight entry after a rejection so a retry fetches again', async () => {
    let calls = 0
    const fetcher = vi.fn().mockImplementation(async () => {
      calls += 1
      if (calls === 1) throw new Error('first fails')
      return 'second wins'
    })
    const first = cachedGet('k', fetcher)
    const second = cachedGet('k', fetcher)
    await expect(first).rejects.toThrow('first fails')
    await expect(second).rejects.toThrow('first fails')
    expect(fetcher).toHaveBeenCalledTimes(1)
    await expect(cachedGet('k', fetcher)).resolves.toBe('second wins')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('invalidateDataCache drops a single entry', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2')
    await expect(cachedGet('k', fetcher)).resolves.toBe('v1')
    invalidateDataCache('k')
    await expect(cachedGet('k', fetcher)).resolves.toBe('v2')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('invalidateDataCache is a no-op for unknown keys', () => {
    expect(() => invalidateDataCache('missing')).not.toThrow()
  })

  it('invalidateDataCachePrefix drops only matching entries', async () => {
    const fetcher = vi.fn().mockResolvedValue('v')
    await cachedGet('lists:all', fetcher)
    await cachedGet('lists:abc', fetcher)
    await cachedGet('user:a@b.c', fetcher)
    invalidateDataCachePrefix('lists:')
    const refetcher = vi.fn().mockResolvedValue('fresh')
    await cachedGet('lists:all', refetcher)
    await cachedGet('lists:abc', refetcher)
    await cachedGet('user:a@b.c', refetcher)
    expect(refetcher).toHaveBeenCalledTimes(2)
  })

  it('clearDataCache drops every entry', async () => {
    const fetcher = vi.fn().mockResolvedValue('v')
    await cachedGet('lists:all', fetcher)
    await cachedGet('user:a@b.c', fetcher)
    clearDataCache()
    const refetcher = vi.fn().mockResolvedValue('fresh')
    await cachedGet('lists:all', refetcher)
    await cachedGet('user:a@b.c', refetcher)
    expect(refetcher).toHaveBeenCalledTimes(2)
  })

  it('uses the default TTL when none is given', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2')
    await expect(cachedGet('k', fetcher)).resolves.toBe('v1')
    vi.advanceTimersByTime(DATA_CACHE_TTL_MS - 1)
    await expect(cachedGet('k', fetcher)).resolves.toBe('v1')
    vi.advanceTimersByTime(1)
    await expect(cachedGet('k', fetcher)).resolves.toBe('v2')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
