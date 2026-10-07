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
  onOpen: (list: WordList) => void
  /** When provided, renders a Delete button (used by the list manager). */
  onDelete?: (list: WordList) => void
  /** Show the Present link button. Defaults to true; the practice and display pickers hide it. */
  showPresent?: boolean
  /** Label for the primary action button. Defaults to "Open" (issue 19 will make this required). */
  primaryLabel?: string
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
  primaryLabel = 'Open',
}: WordListCardProps) {
  const wordCount = list.patterns.reduce((sum, p) => sum + p.words.length, 0)
  const patternCount = list.patterns.length
  const accent = ACCENTS[index % ACCENTS.length]

  return (
    <Card className="overflow-hidden">
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
        <ul className="space-y-2" aria-label="Spelling patterns">
          {list.patterns.slice(0, 3).map((pattern) => (
            <li key={pattern.id} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-sm font-semibold">{pattern.pattern}</span>
              <PowerBar level={frequencyToLevel[pattern.frequency]} filledClassName={accent.fill} />
            </li>
          ))}
        </ul>
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Button size="sm" onClick={() => onOpen(list)}>
            {primaryLabel}
          </Button>
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
    </Card>
  )
}
