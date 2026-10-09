import { cn } from '@/lib/utils'

/** Frequency labels for the 3-segment power bar. */
export const FREQUENCY_LABELS = {
  3: 'Common',
  2: 'Less common',
  1: 'Rare',
} as const

export type PowerBarLevel = keyof typeof FREQUENCY_LABELS

interface PowerBarProps {
  /** 1 = rare, 2 = less common, 3 = common */
  level: PowerBarLevel
  /** Fill color for lit segments; defaults to leaf. */
  filledClassName?: string
  className?: string
}

/**
 * 3-segment power bar: how common a spelling pattern is for its sound.
 * Segments are 24x10 with a 6px gap, matching the approved design.
 */
export function PowerBar({ level, filledClassName = 'bg-leaf', className }: PowerBarProps) {
  return (
    <span
      role="img"
      aria-label={`Frequency: ${FREQUENCY_LABELS[level]}`}
      data-power-bar
      className={cn('inline-flex items-center gap-1.5', className)}
    >
      {[1, 2, 3].map((segment) => (
        <span
          key={segment}
          aria-hidden="true"
          data-power-segment
          data-filled={segment <= level}
          className={cn('h-2.5 w-6 rounded-full', segment <= level ? filledClassName : 'bg-line')}
        />
      ))}
    </span>
  )
}
