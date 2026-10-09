'use client'

import { reportError } from './report-error'

/**
 * Fire one app-usage event (list-created, practice-session, words-practiced).
 * Best effort: analytics must never break the app, so failures stay silent
 * for the user, but they are reported to Sentry.
 */
export function trackEvent(event: string, count = 1): void {
  const payload = JSON.stringify({ event, count })
  try {
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
      reportError(error, { location: 'track-event.fetch' })
    })
  } catch (error) {
    reportError(error, { location: 'track-event' })
  }
}
