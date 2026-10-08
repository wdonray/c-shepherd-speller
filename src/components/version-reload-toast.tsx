'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNewVersionAvailable } from '@/hooks/useNewVersionAvailable'

/**
 * Small bottom-corner toast shown when a newer build of PatternSpell is
 * deployed. Offers a one-click reload; dismissing hides it for this page
 * session only. Mounted once in the root layout. Announced politely to
 * screen readers, never steals focus, Esc dismisses.
 */
export function VersionReloadToast() {
  const updateAvailable = useNewVersionAvailable()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!updateAvailable || dismissed) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDismissed(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [updateAvailable, dismissed])

  if (!updateAvailable || dismissed) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 shadow-lg max-sm:left-4"
    >
      <p className="text-sm text-card-foreground">A new version is available. Reload to get the latest.</p>
      <Button size="sm" onClick={() => window.location.reload()}>
        Reload
      </Button>
      <Button size="sm" variant="ghost" aria-label="Dismiss" onClick={() => setDismissed(true)} className="px-2">
        <X aria-hidden="true" />
      </Button>
    </div>
  )
}
