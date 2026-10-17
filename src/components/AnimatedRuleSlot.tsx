import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * How long the rule slot takes to expand/collapse, in milliseconds. The
 * unmount timeout matches it so the exit transition finishes before the
 * node leaves the DOM.
 */
export const RULE_SLOT_TRANSITION_MS = 250

interface AnimatedRuleSlotProps {
  /**
   * When false the slot collapses and is removed from the DOM after the
   * exit transition, so hidden rules stay out of the accessibility tree.
   */
  show: boolean
  children: ReactNode
}

/**
 * Smoothly animates the rule slot (rule card or "No rule yet" placeholder)
 * in and out when the rules eye-toggle flips (issue #374).
 *
 * The wrapper is a single grid row transitioning between 0fr and 1fr with
 * an opacity fade; the inner content is clipped by overflow-hidden. Pure
 * CSS, so no JS measurement is needed. When hiding, the node stays mounted
 * for one transition duration and is then removed: the exit animation stays
 * visible while "hidden means absent from the DOM" is preserved.
 * prefers-reduced-motion disables the transition (instant toggle).
 */
export default function AnimatedRuleSlot({ show, children }: AnimatedRuleSlotProps) {
  const [mounted, setMounted] = useState(show)
  const [expanded, setExpanded] = useState(show)

  useEffect(() => {
    if (show) {
      setMounted(true)
      // Expand on a later tick so the browser paints the collapsed frame
      // first and the grid-rows transition actually runs.
      const expandId = window.setTimeout(() => setExpanded(true), 30)
      return () => window.clearTimeout(expandId)
    }
    setExpanded(false)
    const unmountId = window.setTimeout(() => setMounted(false), RULE_SLOT_TRANSITION_MS)
    return () => window.clearTimeout(unmountId)
  }, [show])

  if (!mounted) return null

  return (
    <div
      data-testid="animated-rule-slot"
      className={cn(
        'grid transition-[grid-template-rows,opacity] ease-in-out motion-reduce:transition-none',
        expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      )}
      style={{ transitionDuration: `${RULE_SLOT_TRANSITION_MS}ms` }}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}
