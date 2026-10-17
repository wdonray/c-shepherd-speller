'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Shared full screen state (issue #380). Tracks the Fullscreen API reality
 * via the fullscreenchange event, so exits the browser handles on its own
 * stay in sync with the UI.
 *
 * Escape is also handled explicitly: pressing it while full screen is
 * active calls exitFullscreen. Native Esc-to-exit varies across the
 * browsers and smartboards teachers present from, and once full screen
 * hides the chart header the button is gone, so Escape is the way out.
 * The handler never prevents default or stops propagation, so dialogs,
 * popovers, and toasts keep their own Escape behavior.
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  // Support is detected after mount: the server has no document, so a
  // render-time check would hydrate as unsupported and never recover.
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    setIsSupported(typeof document.documentElement.requestFullscreen === 'function')
    // A remount (for example, reopening the mobile chart menu) must not reset
    // the state while full screen is already active. Loose null check: the
    // spec says Element | null, but environments without the Fullscreen API
    // report undefined, which must also read as "not full screen".
    setIsFullscreen(document.fullscreenElement != null)
    ensureEscapeExitsFullscreen()
  }, [])

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement != null)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      // Full screen request failed (for example, no user gesture). State
      // keeps reflecting reality through the fullscreenchange listener.
    }
  }, [])

  return { isFullscreen, isSupported, toggleFullscreen }
}

// Registered once per page load, no matter how many components use the
// hook: one Escape press exits full screen exactly once.
let escapeHandlerRegistered = false

function ensureEscapeExitsFullscreen() {
  if (escapeHandlerRegistered) return
  escapeHandlerRegistered = true
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.fullscreenElement != null) {
      // The rejection path (the element exited between the check and the
      // call) is not worth reporting; the fullscreenchange listener keeps
      // state honest either way.
      document.exitFullscreen().catch(() => {})
    }
  })
}
