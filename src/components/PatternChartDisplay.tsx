'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Volume2Icon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WordList, SpellingPattern, PatternFrequency } from '@/models/WordList'
import WordAnalysis from './WordAnalysis'
import { OddDuck } from './OddDuck'
import { PowerBar, FREQUENCY_LABELS, type PowerBarLevel } from '@/components/ui/power-bar'
import { speak } from '@/lib/tts'

interface PatternChartDisplayProps {
  list: WordList
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
 * Pattern chart display mode: target sound header, one column per spelling
 * pattern (width follows frequency), words as large tappable cards, odd
 * ducks in their own plum band below. The projector-friendly replacement
 * for the old tree view. Stays light in dark mode.
 *
 * Designed for projectors: large text, high contrast, keyboard accessible,
 * every word visible at once.
 */
export default function PatternChartDisplay({ list }: PatternChartDisplayProps) {
  const [selected, setSelected] = useState<{ word: string; pattern: SpellingPattern } | null>(null)

  const { columns, oddDucks, targetSound } = useMemo(() => {
    const regular = list.patterns.filter((p) => !p.isOddDuck)
    const oddDucks = list.patterns.filter((p) => p.isOddDuck)

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

    // Widest column first.
    const columns = [...regular].sort((a, b) => FREQUENCY_LEVEL[b.frequency] - FREQUENCY_LEVEL[a.frequency])
    return { columns, oddDucks, targetSound }
  }, [list])

  const openAnalysis = (word: string, pattern: SpellingPattern) => {
    speak(word)
    setSelected({ word, pattern })
  }

  const renderWordCard = (word: string, pattern: SpellingPattern, key: string) => (
    <li key={key}>
      <button
        type="button"
        onClick={() => openAnalysis(word, pattern)}
        aria-label={`Hear and analyze the word ${word}`}
        className="flex min-h-[58px] w-full cursor-pointer items-center justify-center rounded-[14px] border-2 border-line bg-card px-4 py-3 text-[22px] font-bold text-ink transition-colors hover:border-sky"
      >
        {word}
      </button>
    </li>
  )

  return (
    <div className="force-light w-full rounded-[20px] bg-background p-6 sm:p-10">
      <div className="mb-8 text-center">
        <p className="text-[30px] font-extrabold text-ink">{targetSound}</p>
        <Button
          variant="sky"
          size="sm"
          className="mt-3"
          onClick={() => speak(targetSound)}
          aria-label={`Hear the sound ${targetSound}`}
        >
          <Volume2Icon className="size-4" aria-hidden="true" />
          Hear sound
        </Button>
      </div>

      {columns.length === 0 && oddDucks.length === 0 ? (
        <p className="py-12 text-center text-xl text-muted-foreground">
          No patterns in this list yet. Add patterns from My Spelling Lists first.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
            {columns.map((pattern, i) => {
              const accent = COLUMN_ACCENTS[i % COLUMN_ACCENTS.length]
              const level = FREQUENCY_LEVEL[pattern.frequency]
              return (
                <section
                  key={pattern.id}
                  aria-label={`Pattern ${pattern.pattern}`}
                  className={cn('rounded-2xl border-[3px] bg-card p-5', accent.border)}
                  style={{ flexGrow: level, flexBasis: 0, minWidth: 220 }}
                >
                  <div className="mb-4 text-center">
                    <h2 className="text-2xl font-extrabold text-ink">{pattern.pattern}</h2>
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
            })}
          </div>

          {oddDucks.length > 0 && (
            <section aria-label="Odd ducks" className="mt-6 rounded-2xl border-2 border-plum bg-plum-soft p-5">
              <div className="mb-4 flex items-center gap-3">
                <OddDuck className="size-11 text-plum" label="Odd duck" />
                <h2 className="text-lg font-bold text-plum-ink">Odd ducks</h2>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {oddDucks.flatMap((pattern) =>
                  pattern.words.map((word) => renderWordCard(word, pattern, `${pattern.id}-${word}`))
                )}
              </ul>
            </section>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Tap a word to hear it and see its analysis. Wider columns are more common spellings.
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
