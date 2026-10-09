'use client'

import { Suspense, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createEngagementTracker, isHeadlessBrowser } from '@wdonray/analytics-core/client'
import { reportError } from '@/lib/report-error'

/**
 * Fires one page-view hit per page per browsing session, plus one
 * engagement hit when the visitor scrolls (human signal). Rendered once
 * in the root layout; invisible.
 *
 * Headless browsers send nothing at all. Unique visitors are only
 * counted for engaged (scrolled) sessions, so the uniques set contains
 * humans rather than bots.
 */
function TrackerInner() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return

    // Layer 2: never track headless browsers or automation.
    if (isHeadlessBrowser()) return

    const key = `ss:${pathname}`
    try {
      if (sessionStorage.getItem(key)) return
      // Set the flag before sending so StrictMode double-effects don't
      // double-count in development.
      sessionStorage.setItem(key, '1')
    } catch (error) {
      reportError(error, { location: 'AnalyticsTracker.sessionStorage' })
      return
    }

    const send = (engaged: boolean) => {
      const payload = JSON.stringify({ path: pathname, engaged })
      // sendBeacon is the most reliable way to get the hit out; fall back
      // to fetch with keepalive.
      if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
        const blob = new Blob([payload], { type: 'application/json' })
        if (navigator.sendBeacon('/api/track', blob)) return
      }
      void fetch('/api/track', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch((error: unknown) => {
        reportError(error, { location: 'AnalyticsTracker.track' })
      })
    }

    // Page view fires immediately; the engagement hit fires on first scroll.
    send(false)
    const tracker = createEngagementTracker({
      onEngaged: () => send(true),
    })
    tracker.start()
    return () => tracker.stop()
  }, [pathname])

  return null
}

export default function AnalyticsTracker() {
  return (
    <Suspense fallback={null}>
      <TrackerInner />
    </Suspense>
  )
}
