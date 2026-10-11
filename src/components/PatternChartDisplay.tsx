'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { WordList, SpellingPattern, PatternFrequency } from '@/models/WordList'
import WordAnalysis from './WordAnalysis'
import { OddDuck } from './OddDuck'
import { Volume2Icon, LockIcon, LockOpenIcon } from 'lucide-react'
import { PowerBar, FREQUENCY_LABELS, type PowerBarLevel } from '@/components/ui/power-bar'
import { speak } from '@/lib/tts'
import { getSoundType, SOUND_TYPE_BORDER } from '@/lib/sound-type'

interface PatternChartDisplayProps {
  list: WordList
  /** When provided, each column header gets a lock/unlock toggle for progressive reveal. */
  onToggleLock?: (patternId: string) => void
  /**
   * 'present' is the interactive projector chart. 'print' renders a
   * non-interactive poster: locked patterns are excluded entirely, words are
   * plain text, and all buttons and the caption are hidden.
   */
  variant?: 'present' | 'print'
}

const FREQUENCY_LEVEL: Record<PatternFrequency, PowerBarLevel> = {
  common: 3,
  'less-common': 2,
  rare: 1,
}

/**
 * Column border color comes from the pattern's sound type (vowels green,
 * consonants red, bossy R blue). Frequency is shown by the power-bar length
 * only, never by color, so the bar and its label stay neutral.
 */

/**
 * Pattern chart display mode: target sound header, one equal-width column per
 * spelling pattern ordered by frequency (most common first), a power-bar
 * gauge in each header showing how common the spelling is, and words as
 * large tappable cards. The projector-friendly replacement for the old
 * tree view. Stays light in dark mode.
 *
 * Designed for projectors: large text, high contrast, keyboard accessible,
 * every word visible at once.
 *
 * variant="print" renders the same chart as a non-interactive poster for
 * printing: locked patterns are excluded entirely, words are plain text,
 * and all buttons and the caption are hidden.
 */
export default function PatternChartDisplay({ list, onToggleLock, variant = 'present' }: PatternChartDisplayProps) {
  const [selected, setSelected] = useState<{ word: string; pattern: SpellingPattern } | null>(null)
  const isPrint = variant === 'print'

  const { columns, targetSound, allLocked, oddDuckWords } = useMemo(() => {
    // The printed poster matches what is currently taught: locked patterns
    // are excluded entirely.
    const teachable = isPrint ? list.patterns.filter((p) => !p.isLocked) : list.patterns
    // Target sound: most common sound among patterns, fallback to list name.
    const soundCounts = new Map<string, number>()
    for (const p of teachable) {
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
    const columns = [...teachable].sort((a, b) => FREQUENCY_LEVEL[b.frequency] - FREQUENCY_LEVEL[a.frequency])
    const allLocked = columns.length > 0 && columns.every((p) => p.isLocked)
    const oddDuckWords: string[] = []
    for (const pattern of teachable) {
      const odd = new Set(pattern.oddDucks ?? [])
      for (const word of pattern.words) {
        if (odd.has(word)) oddDuckWords.push(word)
      }
    }
    return { columns, targetSound, allLocked, oddDuckWords }
  }, [list, isPrint])

  const openAnalysis = (word: string, pattern: SpellingPattern) => {
    setSelected({ word, pattern })
  }

  // Print keeps the old side-by-side flex row sizing; present-mode columns
  // are grid items, so no inline flex sizing applies.
  const columnStyle = isPrint ? { flex: '1 1 0', minWidth: 220 } : undefined

  /** Lock toggle for an unlocked column header (locked columns render a placeholder instead). */
  const renderLockToggle = (pattern: SpellingPattern) => {
    if (!onToggleLock || isPrint) return null
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

  const renderColumn = (pattern: SpellingPattern) => {
    const border = SOUND_TYPE_BORDER[getSoundType(pattern.pattern)]
    const level = FREQUENCY_LEVEL[pattern.frequency]
    // A locked pattern keeps its equal-width column footprint (no layout
    // reflow when toggling) but hides its name and words behind a placeholder.
    if (pattern.isLocked) {
      return (
        <section
          key={pattern.id}
          aria-label="Locked pattern"
          className={cn('min-w-0 rounded-2xl border-[3px] bg-card p-5', border)}
          style={columnStyle}
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
        className={cn('min-w-0 rounded-2xl border-[3px] bg-card p-5', border)}
        style={columnStyle}
      >
        <div className="mb-4 text-center">
          {pattern.keywordImage ? (
            <img
              src={pattern.keywordImage}
              alt={`Keyword image for pattern ${pattern.pattern}`}
              className="mx-auto mb-2 block size-12 rounded-xl object-cover"
            />
          ) : (
            pattern.keywordEmoji && (
              <span
                role="img"
                aria-label={`Keyword image for pattern ${pattern.pattern}`}
                className="mb-2 block text-5xl leading-none"
              >
                {pattern.keywordEmoji}
              </span>
            )
          )}
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-2xl font-extrabold text-ink">{pattern.pattern}</h2>
            {renderLockToggle(pattern)}
          </div>
          <div className="mt-2 flex items-center justify-center gap-2">
            <PowerBar level={level} filledClassName="bg-ink" />
            <span className="text-sm font-bold text-muted-foreground">{FREQUENCY_LABELS[level]}</span>
          </div>
        </div>
        <ul className="space-y-3">
          {pattern.words.map((word) => renderWordCard(word, pattern, `${pattern.id}-${word}`))}
        </ul>
      </section>
    )
  }

  const renderWordCard = (word: string, pattern: SpellingPattern, key: string) => {
    const isOddDuck = pattern.oddDucks?.includes(word) ?? false
    // The printed poster is not interactive: words are plain text, no analysis
    // tap target and no speaker button.
    if (isPrint) {
      return (
        <li
          key={key}
          className={cn(
            'flex min-h-[58px] items-center justify-center rounded-[14px] border-2 px-4 py-2 text-center text-[22px] font-bold',
            isOddDuck ? 'border-plum bg-plum-soft text-plum-ink' : 'border-line bg-card text-ink'
          )}
        >
          {word}
        </li>
      )
    }
    return (
      <li
        key={key}
        className={cn(
          'flex min-h-[58px] w-full items-stretch gap-1 rounded-[14px] border-2 bg-card p-1.5 transition-colors hover:border-sky-deep focus-within:border-sky-deep',
          isOddDuck ? 'border-plum bg-plum-soft' : 'border-line'
        )}
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
  }

  return (
    <div className={cn('force-light w-full rounded-[20px] bg-background p-6 sm:p-10', isPrint && 'print-chart')}>
      <div className="mb-8 text-center">
        <p className="text-[30px] font-extrabold text-ink">{targetSound}</p>
      </div>

      {columns.length === 0 ? (
        isPrint && list.patterns.length > 0 ? (
          <p className="py-12 text-center text-xl text-muted-foreground">
            All patterns are locked, so there is nothing to print. Unlock a pattern in present mode first.
          </p>
        ) : (
          <p className="py-12 text-center text-xl text-muted-foreground">
            No patterns in this list yet. Add patterns from My Spelling Lists first.
          </p>
        )
      ) : (
        <>
          {allLocked && (
            <p className="mb-6 text-center text-xl font-bold text-ink">
              All patterns are locked. Unlock a pattern to begin.
            </p>
          )}
          <div
            className={cn(
              'gap-6',
              // Present: max 3 equal-width columns per row, wrapping to the next
              // row. Print keeps the old flex row so the poster layout is
              // unchanged (the print stylesheet forces side-by-side columns).
              isPrint ? 'flex flex-col lg:flex-row lg:items-stretch' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            )}
            data-chart-columns
          >
            {columns.map((pattern) => renderColumn(pattern))}
          </div>

          {oddDuckWords.length > 0 && (
            <section aria-label="Odd ducks" className="mt-6 rounded-2xl border-2 border-plum bg-plum-soft p-5">
              <div className="mb-2 flex items-center gap-3">
                <OddDuck className="size-11 text-plum" label="Odd duck" />
                <h2 className="text-lg font-bold text-plum-ink">Odd ducks</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {oddDuckWords.join(', ')}: these spellings do not follow the patterns, so memorize the whole word.
              </p>
            </section>
          )}

          {!isPrint && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Tap a word to see its analysis, or press the speaker icon to hear it. Patterns are ordered by how common
              the spelling is; longer bars mean more common.
            </p>
          )}
        </>
      )}

      {!isPrint && selected && (
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
