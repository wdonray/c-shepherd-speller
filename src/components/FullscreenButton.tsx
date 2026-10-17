'use client'

import { MaximizeIcon, MinimizeIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFullscreen } from '@/hooks/use-fullscreen'

/**
 * Full screen toggle for present mode. Lives in the top right corner of the
 * chart header so teachers can push the pattern chart to the big screen.
 * Renders nothing when the Fullscreen API is unavailable. Full screen state
 * comes from useFullscreen, which tracks reality via the fullscreenchange
 * event (so an Escape key exit updates the button too) and handles Escape
 * explicitly while full screen is active.
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
  const { isFullscreen, isSupported, toggleFullscreen } = useFullscreen()

  if (!isSupported) return null

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
