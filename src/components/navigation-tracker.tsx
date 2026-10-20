'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { noteNavigation } from '@/lib/navigation-history'

/**
 * Records every in-app navigation so back controls can name the page the
 * teacher actually came from (issue #504). Rendered once in the root
 * layout; invisible.
 *
 * Keyed on pathname plus the search string, so same-route search-param
 * steps (DisplayMode picker -> chart) count as navigation and the chart's
 * back control names the picker, not wherever the teacher was before it.
 */
function TrackerInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname) return
    const search = searchParams?.toString()
    noteNavigation(search ? `${pathname}?${search}` : pathname, pathname)
  }, [pathname, searchParams])

  return null
}

export default function NavigationTracker() {
  return (
    <Suspense fallback={null}>
      <TrackerInner />
    </Suspense>
  )
}
