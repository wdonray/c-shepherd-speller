/**
 * Tiny in-memory cache with stale-while-revalidate semantics.
 *
 * First visit: the fetcher runs, callers see `loading`, and the result
 * populates the cache. Subsequent visits: cached data renders immediately
 * (no loading flash) while a background revalidation refreshes it.
 *
 * The cache lives for the page session. It is intentionally not persisted:
 * word lists change often (edits, imports) and a persisted copy would need
 * the same invalidation machinery for little benefit inside a single-page app.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

/** Cache key for the full word-list collection. */
export const LISTS_CACHE_KEY = 'lists'

/** Cache key for a single word list. */
export function listCacheKey(id: string): string {
  return `list:${id}`
}

/** Cache key for a user profile looked up by email. */
export function userCacheKey(email: string): string {
  return `user:${email}`
}

const cache = new Map<string, unknown>()
const inFlight = new Map<string, Promise<unknown>>()
const subscribers = new Map<string, Set<() => void>>()

/** Reads a cached value. Returns undefined on a cache miss. */
export function readCache<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined
}

/** Writes a value and notifies subscribers of the key. */
export function writeCache<T>(key: string, data: T): void {
  cache.set(key, data)
  subscribers.get(key)?.forEach((notify) => notify())
}

/** Removes one entry (and any in-flight request for it) without notifying. */
export function deleteCacheKey(key: string): void {
  cache.delete(key)
  inFlight.delete(key)
}

/** Clears every entry, in-flight request, and subscriber. Primarily for tests. */
export function clearDataCache(): void {
  cache.clear()
  inFlight.clear()
  subscribers.clear()
}

/** Subscribes to writes for a key. Returns an unsubscribe function. */
export function subscribeCache(key: string, notify: () => void): () => void {
  let set = subscribers.get(key)
  if (!set) {
    set = new Set()
    subscribers.set(key, set)
  }
  set.add(notify)
  return () => {
    set.delete(notify)
  }
}

/**
 * Fetches through the cache, de-duplicating concurrent requests for the same
 * key. On success the cache is written (notifying subscribers); on failure the
 * error is rethrown and nothing is cached.
 */
export function fetchIntoCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key)
  if (existing) return existing as Promise<T>
  const promise = fetcher().then(
    (data) => {
      inFlight.delete(key)
      writeCache(key, data)
      return data
    },
    (error) => {
      inFlight.delete(key)
      throw error
    }
  )
  inFlight.set(key, promise)
  return promise
}

export interface CachedData<T> {
  data: T | undefined
  loading: boolean
  error: boolean
  refresh: () => void
}

/**
 * Stale-while-revalidate data hook.
 *
 * Pass `null` as the key when there is nothing to fetch (e.g. no signed-in
 * user); the hook then stays idle. `loading` is true only while there is no
 * cached data yet, so revisits render instantly and `refresh()` updates the
 * data in the background without a loading flash.
 */
export function useCachedData<T>(key: string | null, fetcher: () => Promise<T>): CachedData<T> {
  const [, forceRender] = useReducer((x: number) => x + 1, 0)
  const [error, setError] = useState(false)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (key === null) return
    return subscribeCache(key, forceRender)
  }, [key])

  useEffect(() => {
    if (key === null) return
    let cancelled = false
    setError(false)
    fetchIntoCache(key, () => fetcherRef.current()).catch(() => {
      if (!cancelled) setError(true)
    })
    return () => {
      cancelled = true
    }
  }, [key])

  const refresh = useCallback(() => {
    if (key === null) return
    setError(false)
    fetchIntoCache(key, () => fetcherRef.current()).catch(() => {
      if (mountedRef.current) setError(true)
    })
  }, [key])

  const data = key === null ? undefined : readCache<T>(key)
  return { data, loading: data === undefined && !error, error, refresh }
}
