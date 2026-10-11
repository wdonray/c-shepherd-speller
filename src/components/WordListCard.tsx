'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PowerBar, type PowerBarLevel } from '@/components/ui/power-bar'
import { cn } from '@/lib/utils'
import type { WordList, PatternFrequency } from '@/models/WordList'

interface WordListCardProps {
  list: WordList
  /** Position in the grid; picks the card's accent color. */
  index?: number
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
}

const ACCENTS = [
  { bar: 'bg-leaf', fill: 'bg-leaf', soft: 'bg-leaf-soft', text: 'text-leaf-ink' },
  { bar: 'bg-sky', fill: 'bg-sky', soft: 'bg-sky-soft', text: 'text-sky-ink' },
  { bar: 'bg-plum', fill: 'bg-plum', soft: 'bg-plum-soft', text: 'text-plum-ink' },
] as const

const frequencyToLevel: Record<PatternFrequency, PowerBarLevel> = {
  common: 3,
  'less-common': 2,
  rare: 1,
}

/** Summary card for a pattern-based word list. */
export default function WordListCard({
  list,
  index = 0,
  onOpen,
  onDelete,
  showPresent = true,
  primaryLabel,
  showPreview = true,
  href,
}: WordListCardProps) {
  const wordCount = list.patterns.reduce((sum, p) => sum + p.words.length, 0)
  const patternCount = list.patterns.length
  const accent = ACCENTS[index % ACCENTS.length]

  return (
    <Card className="relative overflow-hidden">
      <div className={cn('h-2 w-full', accent.bar)} aria-hidden="true" />
      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-bold">{list.name}</h3>
          {list.gradeLevel && (
            <span className={cn('rounded-full px-3 py-1 text-xs font-bold', accent.soft, accent.text)}>
              Grade {list.gradeLevel}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {patternCount} {patternCount === 1 ? 'pattern' : 'patterns'}, {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </p>
        {showPreview && (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" aria-label="Spelling patterns">
            {list.patterns.map((pattern) => (
              <li key={pattern.id} className={cn('flex flex-col gap-1.5 rounded-xl px-3 py-2', accent.soft)}>
                <span className={cn('truncate text-sm font-bold', accent.text)}>{pattern.pattern}</span>
                <PowerBar level={frequencyToLevel[pattern.frequency]} filledClassName={accent.fill} />
              </li>
            ))}
          </ul>
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
