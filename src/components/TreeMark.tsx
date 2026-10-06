import { cn } from '@/lib/utils'

interface TreeMarkProps {
  className?: string
  /** Accessible label; omit for decorative use (aria-hidden). */
  label?: string
}

/**
 * Shepherd Speller tree logo mark: warm trunk with a friendly two-tone
 * canopy. Matches the approved design-system illustration rules.
 */
export function TreeMark({ className, label }: TreeMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('size-10', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <rect x="28" y="34" width="8" height="24" rx="4" className="fill-trunk" />
      <ellipse cx="32" cy="24" rx="20" ry="18" className="fill-leaf" />
      <ellipse cx="22" cy="18" rx="8" ry="7" fill="#6FD13C" />
      <ellipse cx="43" cy="20" rx="8" ry="7" fill="#6FD13C" />
    </svg>
  )
}
