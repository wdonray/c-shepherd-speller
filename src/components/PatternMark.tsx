import { cn } from '@/lib/utils'

interface PatternMarkProps {
  className?: string
  /** Accessible label; omit for decorative use (aria-hidden). */
  label?: string
}

/**
 * PatternSpell logo mark: three friendly rounded columns of varying
 * heights, echoing the pattern-chart display (one column per spelling
 * pattern). Matches the approved design-system illustration rules.
 */
export function PatternMark({ className, label }: PatternMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('size-10', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <rect x="10" y="26" width="12" height="28" rx="6" className="fill-leaf" />
      <rect x="26" y="14" width="12" height="40" rx="6" className="fill-sun" />
      <rect x="42" y="32" width="12" height="22" rx="6" className="fill-sky" />
    </svg>
  )
}
