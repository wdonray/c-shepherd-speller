import { cn } from '@/lib/utils'

/**
 * Invisible-copy placeholder (issue #349). Renders the real copy in
 * transparent text over a per-line highlight span. Because the copy, font,
 * size, and available width are identical to the loaded element, it wraps at
 * exactly the same points at every viewport width, so the skeleton occupies
 * exactly the loaded element's space and nothing shifts on load.
 */
export function GhostText({
  text,
  highlightClassName,
  className,
}: {
  text: string
  highlightClassName: string
  /** Extra classes for the outer span, e.g. font-bold to match bold copy. */
  className?: string
}) {
  return (
    <span aria-hidden="true" className={cn('select-none text-transparent', className)}>
      <span className={`box-decoration-clone animate-pulse rounded-sm ${highlightClassName}`}>{text}</span>
    </span>
  )
}
