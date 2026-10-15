'use client'

import { EyeIcon, EyeOffIcon } from 'lucide-react'

interface RulesVisibilityToggleProps {
  /** Whether the rule display is currently shown. The parent owns this state. */
  showRules: boolean
  onToggle: () => void
}

/**
 * Show/hide toggle for the rule display: the rule cards under the Sort page
 * column headers and the rule badges on the Present chart (issue #310).
 * Default shown; the parent owns the state and passes it down to the display
 * it controls. Follows the app's icon-button toggle pattern (aria-pressed).
 */
export default function RulesVisibilityToggle({ showRules, onToggle }: RulesVisibilityToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={showRules}
      aria-label={showRules ? 'Hide rules' : 'Show rules'}
      title={showRules ? 'Hide rules' : 'Show rules'}
      className="cursor-pointer rounded-full p-2 text-muted-foreground outline-none hover:bg-card hover:text-foreground focus-visible:bg-card focus-visible:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/60"
    >
      {showRules ? (
        <EyeIcon className="size-5" aria-hidden="true" />
      ) : (
        <EyeOffIcon className="size-5" aria-hidden="true" />
      )}
    </button>
  )
}
