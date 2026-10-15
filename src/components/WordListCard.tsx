'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PowerBar, type PowerBarLevel } from '@/components/ui/power-bar'
import { cn } from '@/lib/utils'
import { resolveListColor, LIST_ACCENT_CLASSES, type WordList, type PatternFrequency } from '@/models/WordList'
import { StarIcon } from 'lucide-react'
import HighlightedText from './HighlightedText'

interface WordListCardProps {
  list: WordList
  /** Primary action handler. Not needed when `href` makes the whole card a link. */
  onOpen?: (list: WordList) => void
  /** When provided, renders a Delete button (used by the list manager). */
  onDelete?: (list: WordList) => void
  /** Show the Present link button. Defaults to true; the practice and display pickers hide it. */
  showPresent?: boolean
  /** Label for the primary action button. Required; each surface names its own action. */
  primaryLabel: string
  /** Show the pattern preview rows with power bars. Defaults to true. */
  showPreview?: boolean
  /**
   * When provided, the whole card becomes a link to this URL (stretched-link
   * pattern) and the primary action button is omitted. Other buttons (Present,
   * Delete) stay interactive above the link overlay.
   */
  href?: string
  /**
   * Adds the hover lift animation (card slightly grows and casts a shadow) to
   * the card, with a hover outline in the list's own accent color (issue #290).
   * Used by the display-mode and practice-mode list pickers (issue #268) so
   * teachers can see which list they are about to present or practice. Off
   * everywhere else: the design system keeps cards flat, and motion-reduce
   * disables the lift.
   */
  hoverLift?: boolean
  /**
   * When true, shows a star toggle for favoriting the list. Used by the
   * lists overview page (issue #275); off everywhere else.
   */
  isFavorite?: boolean
  /** Called when the teacher toggles the favorite star. */
  onToggleFavorite?: (list: WordList) => void
  /**
   * Search query for bolding matched substrings in the name and badges.
   * Used by the lists overview search (issue #275); empty elsewhere.
   */
  highlightQuery?: string
  /**
   * Optional control rendered at the start of the card header row, inside
   * the card (issue #289): the lists overview passes its reorder drag
   * handle here so it reads as part of the card instead of floating
   * detached beside it.
   */
  leadingAction?: React.ReactNode
}

const frequencyToLevel: Record<PatternFrequency, PowerBarLevel> = {
  common: 3,
  'less-common': 2,
  rare: 1,
}

/** Max patterns shown in the card preview; a "+N more" indicator covers the rest. */
const MAX_PREVIEW_PATTERNS = 4

/** Summary card for a pattern-based word list. */
export default function WordListCard({
  list,
  onOpen,
  onDelete,
  showPresent = true,
  primaryLabel,
  showPreview = true,
  href,
  hoverLift = false,
  isFavorite = false,
  onToggleFavorite,
  highlightQuery = '',
  leadingAction,
}: WordListCardProps) {
  const wordCount = list.patterns.reduce((sum, p) => sum + p.words.length, 0)
  const patternCount = list.patterns.length
  const visiblePatterns = list.patterns.slice(0, MAX_PREVIEW_PATTERNS)
  const hiddenPatternCount = patternCount - visiblePatterns.length
  const accent = LIST_ACCENT_CLASSES[resolveListColor(list)]

  return (
    <Card
      className={cn(
        'relative overflow-hidden',
        hoverLift &&
          // Hover lift (issues #268, #290): moved here from present-mode word
          // cards so the list to present or practice is unmistakable on hover.
          // The outline color matches the list's own accent color (issue
          // #290) instead of one fixed color. motion-reduce keeps the flat
          // card for users who asked for no motion.
          'transition duration-200 ease-out hover:z-10 hover:scale-[1.05] hover:shadow-xl motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:hover:shadow-none',
        hoverLift && accent.hoverBorder
      )}
    >
      <div className={cn('h-2 w-full', accent.bar)} aria-hidden="true" />
      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex flex-wrap items-center gap-2">
          {leadingAction}
          <h3 className="text-xl font-bold">
            <HighlightedText text={list.name} query={highlightQuery} />
          </h3>
          {list.week?.trim() && (
            <span className={cn('rounded-full px-3 py-1 text-xs font-bold', accent.soft, accent.text)}>
              <HighlightedText text={list.week.trim()} query={highlightQuery} />
            </span>
          )}
          {list.gradeLevel && (
            <span className={cn('rounded-full px-3 py-1 text-xs font-bold', accent.soft, accent.text)}>
              <HighlightedText text={`Grade ${list.gradeLevel}`} query={highlightQuery} />
            </span>
          )}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={() => onToggleFavorite(list)}
              aria-pressed={isFavorite}
              aria-label={isFavorite ? `Remove ${list.name} from favorites` : `Add ${list.name} to favorites`}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              className={cn(
                'ml-auto flex size-11 shrink-0 items-center justify-center rounded-full outline-none transition-colors',
                'hover:bg-sun-soft focus-visible:ring-[3px] focus-visible:ring-ring/60 active:bg-sun-soft',
                isFavorite ? 'text-sun-deep' : 'text-muted-foreground'
              )}
            >
              <StarIcon className={cn('size-6', isFavorite && 'fill-sun')} aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {patternCount} {patternCount === 1 ? 'pattern' : 'patterns'}, {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </p>
        {showPreview && (
          <>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" aria-label="Spelling patterns">
              {visiblePatterns.length > 0 ? (
                visiblePatterns.map((pattern) => (
                  <li key={pattern.id} className={cn('flex flex-col gap-1.5 rounded-xl px-3 py-2', accent.soft)}>
                    <span className={cn('truncate text-sm font-bold', accent.text)}>{pattern.pattern}</span>
                    <PowerBar level={frequencyToLevel[pattern.frequency]} filledClassName={accent.fill} />
                  </li>
                ))
              ) : (
                // Empty-pattern placeholder (issue #283): an invisible copy of a
                // pattern tile, so a list with no patterns renders the same card
                // height as a list with patterns. aria-hidden because the
                // "0 patterns" count above already conveys the empty state.
                <li
                  aria-hidden="true"
                  data-testid="pattern-preview-placeholder"
                  className={cn('invisible flex flex-col gap-1.5 rounded-xl px-3 py-2', accent.soft)}
                >
                  <span className={cn('truncate text-sm font-bold', accent.text)}>placeholder</span>
                  <PowerBar level={3} filledClassName={accent.fill} />
                </li>
              )}
            </ul>
            {hiddenPatternCount > 0 && (
              <p className="text-xs font-medium text-muted-foreground">+{hiddenPatternCount} more</p>
            )}
          </>
        )}
        <div className="relative z-10 mt-auto flex flex-wrap gap-2 pt-2">
          {!href && (
            <Button size="sm" onClick={() => onOpen?.(list)}>
              {primaryLabel}
            </Button>
          )}
          {showPresent && (
            <Button size="sm" variant="secondary" asChild>
              <Link href={`/display?list=${encodeURIComponent(list.id)}`}>Present</Link>
            </Button>
          )}
          {onDelete && (
            <Button size="sm" variant="destructive" onClick={() => onDelete(list)}>
              Delete
            </Button>
          )}
        </div>
      </div>
      {href && (
        <Link
          href={href}
          aria-label={`${primaryLabel}: ${list.name}`}
          className="absolute inset-0 rounded-[20px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
      )}
    </Card>
  )
}
