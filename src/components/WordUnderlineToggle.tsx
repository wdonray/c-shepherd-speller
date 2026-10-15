'use client'

import { UnderlineIcon } from 'lucide-react'

interface WordUnderlineToggleProps {
  /** Whether word underlines are currently shown. The parent owns this state. */
  showUnderlines: boolean
  onToggle: () => void
}

/**
 * Show/hide toggle for word underlines on the Present pattern chart
 * (issue #264): underlining the spelling-pattern letters inside each word
 * card. Default hidden; the parent owns the state and passes it to the
 * chart. Follows the app's icon-button toggle pattern (aria-pressed).
 */
export default function WordUnderlineToggle({ showUnderlines, onToggle }: WordUnderlineToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={showUnderlines}
      aria-label="Show word underlines"
      title={showUnderlines ? 'Hide word underlines' : 'Show word underlines'}
      className="cursor-pointer rounded-full p-2 text-muted-foreground outline-none hover:bg-card hover:text-foreground focus-visible:bg-card focus-visible:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/60"
    >
      <UnderlineIcon className="size-5" aria-hidden="true" />
    </button>
  )
}
