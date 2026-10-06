import { cn } from '@/lib/utils'

interface OddDuckProps {
  className?: string
  /** Accessible label; omit for decorative use (aria-hidden). */
  label?: string
}

/**
 * Odd-duck illustration: the friendly duck that marks irregular spellings.
 * Body uses currentColor so callers pick the tone (usually plum); the beak
 * is always sun. Matches the approved design-system illustration rules.
 */
export function OddDuck({ className, label }: OddDuckProps) {
  return (
    <svg
      viewBox="0 0 110 100"
      className={cn('size-10', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <ellipse cx="39" cy="67" rx="31" ry="25" fill="currentColor" />
      <ellipse cx="72" cy="28" rx="20" ry="20" fill="currentColor" />
      <polygon points="86,22 108,30 86,38" className="fill-sun" />
    </svg>
  )
}
