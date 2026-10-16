'use client'

import { useCallback, useEffect, useState } from 'react'
import { MaximizeIcon, MinimizeIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Full screen toggle for present mode. Lives in the top right corner of the
 * chart header so teachers can push the pattern chart to the big screen.
 * Renders nothing when the Fullscreen API is unavailable. Tracks reality via
 * the fullscreenchange event, so an Escape key exit updates the button too.
 */
interface FullscreenButtonProps {
  /** Extra classes merged onto the button (e.g. a full-width row in a menu sheet). */
  className?: string
  /**
   * Show the text label at every breakpoint. Default follows the header
   * pattern: icon-only below sm, labeled at sm and up.
   */
  alwaysShowLabel?: boolean
}

export default function FullscreenButton({ className, alwaysShowLabel = false }: FullscreenButtonProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  // Support is detected after mount: the server has no document, so a
  // render-time check would hydrate as unsupported and never recover.
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    setSupported(typeof document.documentElement.requestFullscreen === 'function')
  }, [])

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement !== null)
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

  if (!supported) return null

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={toggleFullscreen}
      // A visible label names the button; the icon-only form needs the label.
      aria-label={alwaysShowLabel ? undefined : isFullscreen ? 'Exit full screen' : 'Enter full screen'}
      aria-pressed={isFullscreen}
      className={className}
    >
      {isFullscreen ? (
        <MinimizeIcon className="size-4" aria-hidden="true" />
      ) : (
        <MaximizeIcon className="size-4" aria-hidden="true" />
      )}
      <span className={alwaysShowLabel ? undefined : 'hidden sm:inline-block'}>
        {isFullscreen ? 'Exit full screen' : 'Full screen'}
      </span>
    </Button>
  )
}
