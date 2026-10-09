'use client'

import { useEffect, useRef, useState } from 'react'
import { reportError } from '@/lib/report-error'

/** How often the deployed version is re-checked while the page is open. */
export const POLL_INTERVAL_MS = 15 * 60 * 1000
/** Minimum gap between polls triggered by tabbing back or refocusing. */
export const MIN_REFOCUS_POLL_GAP_MS = 60 * 1000
/** A poll that takes longer than this is abandoned, silently. */
export const FETCH_TIMEOUT_MS = 5_000

/**
 * Fetches the currently deployed version. Returns null on any failure
 * (network error, non-200, malformed body): a failed poll is skipped,
 * never surfaced to the user.
 */
async function fetchDeployedVersion(): Promise<string | null> {
  try {
    const res = await fetch('/api/version', {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const data: unknown = await res.json()
    if (typeof data !== 'object' || data === null) return null
    const version = (data as { version?: unknown }).version
    return typeof version === 'string' ? version : null
  } catch (error) {
    reportError(error, { location: 'useNewVersionAvailable.fetchDeployedVersion' })
    return null
  }
}

/**
 * True once the deployed version differs from the version captured when
 * this page loaded, meaning a newer build is live and a reload picks it
 * up. Dependency-free: plain fetch on a 15-minute interval, plus a
 * refocus/visibility poll throttled to at most one per minute.
 */
export function useNewVersionAvailable(): boolean {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const loadedVersionRef = useRef<string | null>(null)
  const lastPollRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    lastPollRef.current = Date.now()

    async function poll() {
      lastPollRef.current = Date.now()
      const version = await fetchDeployedVersion()
      if (cancelled || version === null) return
      if (loadedVersionRef.current === null) {
        // First successful poll in this page load: this is the version
        // the user's page was built from, the baseline for comparison.
        loadedVersionRef.current = version
        return
      }
      if (version !== loadedVersionRef.current) setUpdateAvailable(true)
    }

    function pollIfStale() {
      if (Date.now() - lastPollRef.current > MIN_REFOCUS_POLL_GAP_MS) {
        void poll()
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') pollIfStale()
    }

    void poll()
    const intervalId = setInterval(poll, POLL_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', pollIfStale)
    return () => {
      cancelled = true
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', pollIfStale)
    }
  }, [])

  return updateAvailable
}
