'use client'

import { useCallback, useEffect, useRef } from 'react'

/** Where the user is trying to go when the guard stops them. */
export type LeaveTarget = { kind: 'url'; url: string } | { kind: 'back' }

/** Marker for the same-URL history entry the guard uses to catch the back button. */
const SENTINEL_KEY = '__patternspellUnsavedGuard'

/**
 * Guards against losing unsaved changes when leaving a page.
 *
 * Three layers, all driven by `isDirty`:
 * - `beforeunload` covers tab close, refresh, and typed-URL navigation.
 * - A capture-phase click listener intercepts in-app link clicks and reports
 *   them via `onRequestLeave({ kind: 'url', url })` instead of navigating.
 * - A same-URL history sentinel covers the browser back button: while dirty,
 *   popping the sentinel re-arms it and reports `{ kind: 'back' }` instead
 *   of leaving. The URL never changes during this flow, so the Next.js
 *   router never starts a competing navigation.
 *
 * The returned `depart` wraps the confirmed navigation: it quietly removes
 * the sentinel first so the guard cannot re-fire mid-departure.
 */
export function useUnsavedChangesGuard(
  isDirty: boolean,
  onRequestLeave: (target: LeaveTarget) => void
): { depart: (navigate: () => void) => void } {
  const requestLeaveRef = useRef(onRequestLeave)
  requestLeaveRef.current = onRequestLeave
  const dirtyRef = useRef(isDirty)
  dirtyRef.current = isDirty
  const sentinelArmed = useRef(false)

  const removeSentinelQuietly = useCallback(() => {
    if (!sentinelArmed.current) return
    sentinelArmed.current = false
    // Callers remove the popstate listener before invoking this (via the
    // effect cleanup), so popping our own same-URL entry is silent.
    window.history.back()
  }, [])

  const depart = useCallback(
    (navigate: () => void) => {
      removeSentinelQuietly()
      navigate()
    },
    [removeSentinelQuietly]
  )

  // Tab close / refresh / typed-URL navigation.
  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Required by legacy browsers for the prompt to appear.
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  // In-app link clicks. Attached once; reads current dirtiness from a ref.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!dirtyRef.current || event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const rawHref = anchor.getAttribute('href')
      if (!rawHref || rawHref.startsWith('#')) return
      let url: URL
      try {
        url = new URL(rawHref, window.location.href)
      } catch {
        return
      }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return
      // Cross-origin links keep their default behavior; beforeunload still prompts.
      if (url.origin !== window.location.origin) return
      // Same-page anchors are not navigation.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      event.preventDefault()
      requestLeaveRef.current({ kind: 'url', url: rawHref })
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  // Browser back button via a same-URL history sentinel.
  useEffect(() => {
    if (!isDirty) return
    window.history.pushState({ [SENTINEL_KEY]: true }, '', window.location.href)
    sentinelArmed.current = true
    const onPopState = () => {
      if (!sentinelArmed.current) return
      // Stay on the page: re-arm on top, then ask the user.
      window.history.pushState({ [SENTINEL_KEY]: true }, '', window.location.href)
      requestLeaveRef.current({ kind: 'back' })
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      removeSentinelQuietly()
    }
  }, [isDirty, removeSentinelQuietly])

  return { depart }
}
