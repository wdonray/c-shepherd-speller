'use client'

import { useEffect, useState } from 'react'

/**
 * Tracks whether a CSS media query matches. Returns false on the server and
 * in environments without matchMedia (e.g. older jsdom), so callers should
 * treat false as "assume the desktop layout".
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(query)
    setMatches(mql.matches)
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}
