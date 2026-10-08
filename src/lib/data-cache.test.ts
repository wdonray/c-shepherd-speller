import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import {
  LISTS_CACHE_KEY,
  listCacheKey,
  userCacheKey,
  readCache,
  writeCache,
  deleteCacheKey,
  clearDataCache,
  subscribeCache,
  fetchIntoCache,
  cacheCreatedList,
  cacheUpdatedList,
  cacheDeletedList,
  useCachedData,
} from './data-cache'
import type { WordList } from '@/models/WordList'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  clearDataCache()
})

describe('cache keys', () => {
  it('builds stable key strings', () => {
    expect(LISTS_CACHE_KEY).toBe('lists')
    expect(listCacheKey('abc')).toBe('list:abc')
    expect(userCacheKey('t@e.c')).toBe('user:t@e.c')
  })
})

describe('readCache / writeCache / deleteCacheKey / clearDataCache', () => {
  it('returns undefined on a cache miss', () => {
    expect(readCache<string>('missing')).toBeUndefined()
  })

  it('round-trips a written value', () => {
    writeCache('k', { a: 1 })
    expect(readCache<{ a: number }>('k')).toEqual({ a: 1 })
  })

  it('deletes a single entry', () => {
    writeCache('gone', 'x')
    deleteCacheKey('gone')
    expect(readCache('gone')).toBeUndefined()
  })

  it('clears everything', () => {
    writeCache('a', 1)
    writeCache('b', 2)
    clearDataCache()
    expect(readCache('a')).toBeUndefined()
    expect(readCache('b')).toBeUndefined()
  })
})

describe('subscribeCache', () => {
  it('notifies subscribers on write', () => {
    const calls: string[] = []
    const unsubA = subscribeCache('sk', () => calls.push('a'))
    const unsubB = subscribeCache('sk', () => calls.push('b'))
    writeCache('sk', 1)
    expect(calls).toEqual(['a', 'b'])
    unsubA()
    writeCache('sk', 2)
    expect(calls).toEqual(['a', 'b', 'b'])
    unsubB()
    writeCache('sk', 3)
    expect(calls).toEqual(['a', 'b', 'b'])
  })

  it('does not notify other keys', () => {
    const notify = vi.fn()
    subscribeCache('other', notify)
    writeCache('sk', 1)
    expect(notify).not.toHaveBeenCalled()
  })
})

describe('list cache write-through helpers', () => {
  const listA = { id: 'a', name: 'A', patterns: [] } as WordList
  const listB = { id: 'b', name: 'B', patterns: [] } as WordList

  it('prepends a created list to the cached collection', () => {
    writeCache<WordList[]>(LISTS_CACHE_KEY, [listA])
    cacheCreatedList(listB)
    expect(readCache<WordList[]>(LISTS_CACHE_KEY)).toEqual([listB, listA])
  })

  it('does nothing when the collection is not cached', () => {
    cacheCreatedList(listB)
    expect(readCache<WordList[]>(LISTS_CACHE_KEY)).toBeUndefined()
  })

  it('updates a list in the collection and the single-list entry', () => {
    writeCache<WordList[]>(LISTS_CACHE_KEY, [listA, listB])
    const updated = { ...listA, name: 'A2' }
    cacheUpdatedList(updated)
    expect(readCache<WordList[]>(LISTS_CACHE_KEY)).toEqual([updated, listB])
    expect(readCache<WordList>(listCacheKey('a'))).toEqual(updated)
  })

  it('updates only the single-list entry when the collection is not cached', () => {
    cacheUpdatedList(listA)
    expect(readCache<WordList>(listCacheKey('a'))).toEqual(listA)
    expect(readCache<WordList[]>(LISTS_CACHE_KEY)).toBeUndefined()
  })

  it('removes a deleted list from the collection and the single-list entry', () => {
    writeCache<WordList[]>(LISTS_CACHE_KEY, [listA, listB])
    writeCache(listCacheKey('a'), listA)
    cacheDeletedList('a')
    expect(readCache<WordList[]>(LISTS_CACHE_KEY)).toEqual([listB])
    expect(readCache<WordList>(listCacheKey('a'))).toBeUndefined()
  })

  it('is a safe no-op when nothing is cached', () => {
    cacheDeletedList('nope')
    expect(readCache<WordList[]>(LISTS_CACHE_KEY)).toBeUndefined()
  })
})

describe('fetchIntoCache', () => {
  it('fetches, caches, and resolves with the data', async () => {
    const data = await fetchIntoCache('fk', () => Promise.resolve('fresh'))
    expect(data).toBe('fresh')
    expect(readCache('fk')).toBe('fresh')
  })

  it('de-duplicates concurrent requests for the same key', async () => {
    const d = deferred<string>()
    let calls = 0
    const p1 = fetchIntoCache('dk', () => {
      calls += 1
      return d.promise
    })
    const p2 = fetchIntoCache('dk', () => {
      calls += 1
      return d.promise
    })
    expect(calls).toBe(1)
    d.resolve('v')
    await expect(p1).resolves.toBe('v')
    await expect(p2).resolves.toBe('v')
    expect(readCache('dk')).toBe('v')
  })

  it('rethrows failures, caches nothing, and allows a retry', async () => {
    const d = deferred<string>()
    const failed = fetchIntoCache('ek', () => d.promise)
    d.reject(new Error('bad'))
    await expect(failed).rejects.toThrow('bad')
    expect(readCache('ek')).toBeUndefined()
    // The failed attempt cleared the in-flight slot, so a retry fetches again.
    await expect(fetchIntoCache('ek', () => Promise.resolve('retry-ok'))).resolves.toBe('retry-ok')
  })
})

describe('useCachedData', () => {
  it('shows loading on a cold load, then the fetched data', async () => {
    const d = deferred<string>()
    const { result } = renderHook(() => useCachedData('cold', () => d.promise))
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeUndefined()
    expect(result.current.error).toBe(false)
    d.resolve('hello')
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBe('hello')
  })

  it('renders cached data instantly and revalidates in the background', async () => {
    writeCache('warm', 'stale')
    const fetcher = vi.fn(() => Promise.resolve('fresh'))
    const { result } = renderHook(() => useCachedData('warm', fetcher))
    // No loading flash: cached data renders on the first pass.
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBe('stale')
    expect(fetcher).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(result.current.data).toBe('fresh'))
  })

  it('sets error on a cold-load failure', async () => {
    const { result } = renderHook(() => useCachedData('cold-err', () => Promise.reject(new Error('nope'))))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeUndefined()
  })

  it('keeps stale data visible when a background revalidation fails', async () => {
    writeCache('stale-ok', 'stale')
    const { result } = renderHook(() => useCachedData('stale-ok', () => Promise.reject(new Error('x'))))
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.data).toBe('stale')
    expect(result.current.loading).toBe(false)
  })

  it('stays idle for a null key', () => {
    const fetcher = vi.fn(() => Promise.resolve('x'))
    const { result } = renderHook(() => useCachedData<string>(null, fetcher))
    expect(result.current.data).toBeUndefined()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
    // Refresh is a safe no-op for a null key.
    result.current.refresh()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('refresh revalidates in the background without a loading flash', async () => {
    writeCache('rk', 'v1')
    let value = 'v2'
    const { result } = renderHook(() => useCachedData('rk', () => Promise.resolve(value)))
    expect(result.current.data).toBe('v1')
    await waitFor(() => expect(result.current.data).toBe('v2'))
    value = 'v3'
    result.current.refresh()
    await waitFor(() => expect(result.current.data).toBe('v3'))
    expect(result.current.loading).toBe(false)
  })

  it('refresh surfaces errors without losing cached data', async () => {
    writeCache('re', 'kept')
    const { result } = renderHook(() => useCachedData('re', () => Promise.resolve('ok')))
    await waitFor(() => expect(result.current.data).toBe('ok'))
    // Swap in a failing fetcher via rerender.
    const { result: result2 } = renderHook(() => useCachedData('re', () => Promise.reject(new Error('down'))))
    result2.current.refresh()
    await waitFor(() => expect(result2.current.error).toBe(true))
    expect(result2.current.data).toBe('ok')
  })

  it('does not set error state after unmount', async () => {
    const d = deferred<string>()
    const { result, unmount } = renderHook(() => useCachedData('un', () => d.promise))
    result.current.refresh()
    unmount()
    d.reject(new Error('late'))
    await d.promise.catch(() => {})
    // No crash and no state update after unmount; the rejection was swallowed.
  })

  it('does not set error when unmounted before the initial fetch settles', async () => {
    const d = deferred<string>()
    const { unmount } = renderHook(() => useCachedData('un2', () => d.promise))
    unmount()
    d.reject(new Error('late'))
    await d.promise.catch(() => {})
  })

  it('switches to the new key when the key changes', async () => {
    writeCache('ka', 'A')
    const { result, rerender } = renderHook(({ key }) => useCachedData<string>(key, () => Promise.resolve('B-fresh')), {
      initialProps: { key: 'ka' },
    })
    expect(result.current.data).toBe('A')
    rerender({ key: 'kb' })
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.data).toBe('B-fresh'))
  })

  it('shares one in-flight request between two mounted hooks', async () => {
    const d = deferred<string>()
    let calls = 0
    const fetcher = () => {
      calls += 1
      return d.promise
    }
    const { result: r1 } = renderHook(() => useCachedData('shared', fetcher))
    const { result: r2 } = renderHook(() => useCachedData('shared', fetcher))
    expect(calls).toBe(1)
    d.resolve('one')
    await waitFor(() => expect(r1.current.data).toBe('one'))
    await waitFor(() => expect(r2.current.data).toBe('one'))
  })
})
