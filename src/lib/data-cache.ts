/**
 * Client-side read cache for API data shared across routes (issue #479).
 *
 * Every page that shows list data used to fetch it fresh: dashboard, /lists,
 * list detail, present chart, and worksheets each fired their own request for
 * the same documents. This module caches read results in memory so navigating
 * between routes reuses one fetch instead of refetching.
 *
 * Read-caching only: all writes still go through the existing API routes, and
 * the write functions invalidate the affected entries, so teachers never see
 * stale data after saving. Rejections are never cached.
 *
 * This module is only imported by client code; the cache lives for the tab's
 * lifetime.
 */

interface CacheEntry {
  value: unknown
  expiresAt: number
}

/**
 * How long a cached read stays fresh. All in-tab writes invalidate, so this
 * only bounds staleness from changes made in another tab.
 */
export const DATA_CACHE_TTL_MS = 5 * 60 * 1000

const cache = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<unknown>>()

/**
 * Return the cached value for `key` when fresh; otherwise run `fetcher`,
 * cache its resolved value, and return it. Simultaneous calls for the same
 * key share a single fetch. Rejections are not cached.
 */
export function cachedGet<T>(key: string, fetcher: () => Promise<T>, ttlMs: number = DATA_CACHE_TTL_MS): Promise<T> {
  const entry = cache.get(key)
  if (entry && entry.expiresAt > Date.now()) {
    return Promise.resolve(entry.value as T)
  }
  const pending = inFlight.get(key)
  if (pending) {
    return pending as Promise<T>
  }
  const promise = fetcher().then(
    (value) => {
      cache.set(key, { value, expiresAt: Date.now() + ttlMs })
      inFlight.delete(key)
      return value
    },
    (error: unknown) => {
      inFlight.delete(key)
      throw error
    }
  )
  inFlight.set(key, promise)
  return promise
}

/** Drop a single cached entry. */
export function invalidateDataCache(key: string): void {
  cache.delete(key)
}

/** Drop every cached entry whose key starts with `prefix`. */
export function invalidateDataCachePrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key)
    }
  }
}

/** Drop the whole cache. Exported for tests and future sign-out hygiene. */
export function clearDataCache(): void {
  cache.clear()
}
