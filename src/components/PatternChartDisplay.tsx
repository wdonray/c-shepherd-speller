'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { WordList, SpellingPattern, PatternFrequency } from '@/models/WordList'
import WordAnalysis from './WordAnalysis'
import { Volume2Icon, LockIcon, LockOpenIcon } from 'lucide-react'
import { PowerBar, FREQUENCY_LABELS, type PowerBarLevel } from '@/components/ui/power-bar'
import { speak } from '@/lib/tts'

interface PatternChartDisplayProps {
  list: WordList
  /** When provided, each column header gets a lock/unlock toggle for progressive reveal. */
  onToggleLock?: (patternId: string) => void
}

const FREQUENCY_LEVEL: Record<PatternFrequency, PowerBarLevel> = {
  common: 3,
  'less-common': 2,
  rare: 1,
}

/** Accent colors cycle across columns; labels stay ink for contrast. */
const COLUMN_ACCENTS = [
  { border: 'border-leaf', fill: 'bg-leaf', text: 'text-leaf-ink' },
  { border: 'border-sun-deep', fill: 'bg-sun', text: 'text-sun-ink' },
  { border: 'border-sky', fill: 'bg-sky', text: 'text-sky-ink' },
  { border: 'border-plum', fill: 'bg-plum', text: 'text-plum-ink' },
] as const

/**
 * Pattern chart display mode: target sound header, one equal-width column per
 * spelling pattern ordered by frequency (most common first), a power-bar
 * gauge in each header showing how common the spelling is, and words as
 * large tappable cards. The projector-friendly replacement for the old
 * tree view. Stays light in dark mode.
 *
 * Designed for projectors: large text, high contrast, keyboard accessible,
 * every word visible at once.
 */
export default function PatternChartDisplay({ list, onToggleLock }: PatternChartDisplayProps) {
  const [selected, setSelected] = useState<{ word: string; pattern: SpellingPattern } | null>(null)

  const { columns, targetSound, allLocked } = useMemo(() => {
    // Target sound: most common sound among patterns, fallback to list name.
    const soundCounts = new Map<string, number>()
    for (const p of list.patterns) {
      soundCounts.set(p.sound, (soundCounts.get(p.sound) ?? 0) + 1)
    }
    let targetSound = list.name
    let maxCount = 0
    for (const [sound, count] of soundCounts) {
      if (count > maxCount) {
        maxCount = count
        targetSound = sound
      }
    }

    // Most common spelling first.
    const columns = [...list.patterns].sort((a, b) => FREQUENCY_LEVEL[b.frequency] - FREQUENCY_LEVEL[a.frequency])
    const allLocked = columns.length > 0 && columns.every((p) => p.isLocked)
    return { columns, targetSound, allLocked }
  }, [list])

  const openAnalysis = (word: string, pattern: SpellingPattern) => {
    setSelected({ word, pattern })
  }

  /** Lock toggle for an unlocked column header (locked columns render a placeholder instead). */
  const renderLockToggle = (pattern: SpellingPattern) => {
    if (!onToggleLock) return null
    return (
      <button
        type="button"
        onClick={() => onToggleLock(pattern.id)}
        aria-pressed={false}
        aria-label={`Lock pattern ${pattern.pattern}`}
        title={`Lock pattern ${pattern.pattern}`}
        className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none transition hover:bg-line/50 hover:text-ink focus-visible:bg-line/50 focus-visible:text-ink focus-visible:ring-[3px] focus-visible:ring-ring/60"
      >
        <LockIcon className="size-6" aria-hidden="true" />
      </button>
    )
  }

  const renderColumn = (pattern: SpellingPattern, i: number) => {
    const accent = COLUMN_ACCENTS[i % COLUMN_ACCENTS.length]
    const level = FREQUENCY_LEVEL[pattern.frequency]
    // A locked pattern keeps its equal-width column footprint (no layout
    // reflow when toggling) but hides its name and words behind a placeholder.
    if (pattern.isLocked) {
      return (
        <section
          key={pattern.id}
          aria-label="Locked pattern"
          className={cn('rounded-2xl border-[3px] bg-card p-5', accent.border)}
          style={{ flex: '1 1 0', minWidth: 220 }}
        >
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
            <LockIcon className="size-10 text-muted-foreground" aria-hidden="true" />
            <p className="text-2xl font-extrabold text-muted-foreground">Locked</p>
            {onToggleLock && (
              <button
                type="button"
                onClick={() => onToggleLock(pattern.id)}
                aria-pressed={true}
                aria-label={`Unlock pattern ${pattern.pattern}`}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-2 border-line px-4 py-1.5 text-[15px] font-bold text-muted-foreground outline-none transition hover:border-sky-deep hover:text-sky-ink focus-visible:border-sky-deep focus-visible:text-sky-ink focus-visible:ring-[3px] focus-visible:ring-ring/60"
              >
                <LockOpenIcon className="size-5" aria-hidden="true" />
                Unlock
              </button>
            )}
          </div>
        </section>
      )
    }
    return (
      <section
        key={pattern.id}
        aria-label={`Pattern ${pattern.pattern}`}
        className={cn('rounded-2xl border-[3px] bg-card p-5', accent.border)}
        style={{ flex: '1 1 0', minWidth: 220 }}
      >
        <div className="mb-4 text-center">
          {pattern.keywordEmoji && (
            <span
              role="img"
              aria-label={`Keyword image for pattern ${pattern.pattern}`}
              className="mb-2 block text-5xl leading-none"
            >
              {pattern.keywordEmoji}
            </span>
          )}
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-2xl font-extrabold text-ink">{pattern.pattern}</h2>
            {renderLockToggle(pattern)}
          </div>
          <div className="mt-2 flex items-center justify-center gap-2">
            <PowerBar level={level} filledClassName={accent.fill} />
            <span className={cn('text-sm font-bold', accent.text)}>{FREQUENCY_LABELS[level]}</span>
          </div>
        </div>
        <ul className="space-y-3">
          {pattern.words.map((word) => renderWordCard(word, pattern, `${pattern.id}-${word}`))}
        </ul>
      </section>
    )
  }

  const renderWordCard = (word: string, pattern: SpellingPattern, key: string) => (
    <li
      key={key}
      className="flex min-h-[58px] w-full items-stretch gap-1 rounded-[14px] border-2 border-line bg-card p-1.5 transition-colors hover:border-sky-deep focus-within:border-sky-deep"
    >
      <button
        type="button"
        onClick={() => openAnalysis(word, pattern)}
        aria-label={`Analyze the word ${word}`}
        className="flex min-h-[44px] flex-1 cursor-pointer items-center justify-center rounded-[10px] px-4 py-2 text-[22px] font-bold text-ink outline-none transition-colors hover:bg-sky-soft focus-visible:bg-sky-soft focus-visible:ring-[3px] focus-visible:ring-ring/60"
      >
        {word}
      </button>
      <button
        type="button"
        onClick={() => speak(word)}
        aria-label={`Hear the word ${word}`}
        className="flex min-h-[44px] min-w-[52px] cursor-pointer items-center justify-center rounded-[10px] text-sky-deep outline-none transition-colors hover:bg-sky-soft focus-visible:bg-sky-soft focus-visible:ring-[3px] focus-visible:ring-ring/60"
      >
        <Volume2Icon className="size-7" aria-hidden="true" />
      </button>
    </li>
  )

  return (
    <div className="force-light w-full rounded-[20px] bg-background p-6 sm:p-10">
      <div className="mb-8 text-center">
        <p className="text-[30px] font-extrabold text-ink">{targetSound}</p>
      </div>

      {columns.length === 0 ? (
        <p className="py-12 text-center text-xl text-muted-foreground">
          No patterns in this list yet. Add patterns from My Spelling Lists first.
        </p>
      ) : (
        <>
          {allLocked && (
            <p className="mb-6 text-center text-xl font-bold text-ink">
              All patterns are locked. Unlock a pattern to begin.
            </p>
          )}
          <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
            {columns.map((pattern, i) => renderColumn(pattern, i))}
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Tap a word to see its analysis, or press the speaker icon to hear it. Patterns are ordered by how common the
            spelling is; longer bars mean more common.
          </p>
        </>
      )}

      {selected && (
        <WordAnalysis
          word={selected.word}
          pattern={selected.pattern}
          onClose={() => setSelected(null)}
          onSpeak={speak}
        />
      )}
    </div>
  )
}
