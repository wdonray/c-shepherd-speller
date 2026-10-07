'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PowerBar, type PowerBarLevel } from '@/components/ui/power-bar'
import { XIcon } from 'lucide-react'
import { OddDuck } from './OddDuck'
import { WORD_SUGGESTIONS } from '@/data/word-suggestions'
import type { SpellingPattern, PatternFrequency } from '@/models/WordList'

interface PatternEditorProps {
  pattern: SpellingPattern
  onChange: (pattern: SpellingPattern) => void
  /** Called when the delete button is pressed; the parent confirms before removing. */
  onRemove: () => void
}

const FREQUENCIES: { value: PatternFrequency; label: string; meaning: string; level: PowerBarLevel }[] = [
  {
    value: 'common',
    label: 'Common',
    meaning: 'Shows up in most words with this sound. Teach this spelling first.',
    level: 3,
  },
  {
    value: 'less-common',
    label: 'Less common',
    meaning: 'Shows up sometimes. Teach it after the common spelling.',
    level: 2,
  },
  {
    value: 'rare',
    label: 'Rare',
    meaning: 'Shows up in just a few words. Teach it last, or skip it for now.',
    level: 1,
  },
]

const FREQUENCY_LABELS: Record<PatternFrequency, string> = {
  common: 'Common',
  'less-common': 'Less common',
  rare: 'Rare',
}

const FREQUENCY_MEANINGS: Record<PatternFrequency, string> = {
  common: 'Shows up in most words with this sound. Teach this spelling first.',
  'less-common': 'Shows up sometimes. Teach it after the common spelling.',
  rare: 'Shows up in just a few words. Teach it last, or skip it for now.',
}

const FREQUENCY_HELPER =
  'How often this spelling shows up for the sound. Common spellings get the widest column on the chart.'

/** Editor card for a single spelling pattern (one column of the pattern chart). */
export default function PatternEditor({ pattern, onChange, onRemove }: PatternEditorProps) {
  const [newWord, setNewWord] = useState('')
  const isOddDuck = pattern.isOddDuck ?? false

  const accent = isOddDuck
    ? { bar: 'bg-plum', text: 'text-plum-ink', fill: 'bg-plum', soft: 'bg-plum-soft' }
    : { bar: 'bg-leaf', text: 'text-leaf-ink', fill: 'bg-leaf', soft: 'bg-leaf-soft' }

  const update = (updates: Partial<SpellingPattern>) => {
    onChange({ ...pattern, ...updates })
  }

  const addWord = () => {
    const word = newWord.trim().toLowerCase()
    if (!word || pattern.words.includes(word)) return
    update({ words: [...pattern.words, word] })
    setNewWord('')
  }

  const removeWord = (word: string) => {
    update({ words: pattern.words.filter((w) => w !== word) })
  }

  const addSuggestedWord = (word: string) => {
    // The suggestion list already filters out words in the pattern, so this
    // always adds. Uses the same dedupe-safe update shape as addWord.
    update({ words: [...pattern.words, word] })
  }

  // Suggest words only on exact sound+pattern match (case-insensitive, trimmed).
  // Words already in the list are filtered out.
  const suggestions = (
    WORD_SUGGESTIONS[pattern.sound.trim().toLowerCase()]?.[pattern.pattern.trim().toLowerCase()] ?? []
  )
    .filter((word) => !pattern.words.includes(word))
    .slice(0, 3)

  return (
    <section
      aria-label={pattern.pattern ? `Pattern ${pattern.pattern}` : 'Untitled pattern'}
      className="relative overflow-hidden rounded-[20px] border-2 border-line bg-card p-6"
    >
      <div className={cn('absolute inset-x-0 top-0 h-2', accent.bar)} aria-hidden="true" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Input
            value={pattern.pattern}
            onChange={(e) => update({ pattern: e.target.value })}
            placeholder="e.g. a_e"
            maxLength={20}
            aria-label="Pattern spelling"
            className={cn(
              'h-auto border-2 border-line bg-card px-2 text-[22px] font-bold',
              'placeholder:text-muted-foreground',
              'focus-visible:border-sky-deep focus-visible:ring-[3px]',
              accent.text
            )}
          />
          <div className="mt-1 flex items-center gap-2">
            <span className="shrink-0 text-[15px] text-muted-foreground">Sound:</span>
            <Input
              value={pattern.sound}
              onChange={(e) => update({ sound: e.target.value })}
              placeholder="e.g. long a"
              maxLength={50}
              aria-label="Target sound"
              className="h-9 border-2 border-line bg-card px-2 text-[15px] text-muted-foreground placeholder:text-muted-foreground focus-visible:border-sky-deep focus-visible:ring-[3px]"
            />
          </div>
          <button
            type="button"
            aria-pressed={isOddDuck}
            onClick={() => update({ isOddDuck: !isOddDuck })}
            title={isOddDuck ? 'Remove the odd-duck mark' : 'Mark as an odd duck (irregular spelling)'}
            className={cn(
              'mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full border-2 px-4 py-1.5 text-[13px] font-bold transition outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60',
              isOddDuck
                ? 'border-plum bg-plum-soft text-plum-ink hover:brightness-95 focus-visible:brightness-95'
                : 'border-line bg-transparent text-muted-foreground hover:border-plum hover:text-plum-ink focus-visible:border-plum focus-visible:text-plum-ink'
            )}
          >
            <OddDuck className="size-5 text-plum" />
            {isOddDuck ? 'Odd duck' : 'Mark as odd duck'}
          </button>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <span id={`frequency-${pattern.id}`} className="text-[13px] font-medium text-muted-foreground">
            Frequency
          </span>
          <p id={`frequency-help-${pattern.id}`} className="max-w-[220px] text-right text-[13px] text-muted-foreground">
            {FREQUENCY_HELPER}
          </p>
          <div
            role="radiogroup"
            aria-labelledby={`frequency-${pattern.id}`}
            aria-describedby={`frequency-help-${pattern.id}`}
            className="flex gap-1.5"
          >
            {FREQUENCIES.map((f) => {
              const selected = pattern.frequency === f.value
              return (
                <button
                  key={f.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={f.label}
                  title={f.meaning}
                  onClick={() => update({ frequency: f.value })}
                  className={cn(
                    'cursor-pointer rounded-xl border-2 p-2 transition outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60',
                    selected
                      ? cn('border-current hover:brightness-95 focus-visible:brightness-95', accent.text, accent.soft)
                      : 'border-line opacity-50 hover:opacity-100 focus-visible:opacity-100'
                  )}
                >
                  <PowerBar level={f.level} filledClassName={accent.fill} />
                </button>
              )
            })}
          </div>
          <span className="text-[13px] font-semibold">{FREQUENCY_LABELS[pattern.frequency]}</span>
          <p className="max-w-[220px] text-right text-[13px] text-muted-foreground">
            {FREQUENCY_MEANINGS[pattern.frequency]}
          </p>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={onRemove}
          aria-label={pattern.pattern ? `Delete pattern ${pattern.pattern}` : 'Delete this pattern'}
          className="shrink-0 text-muted-foreground hover:text-destructive focus-visible:text-destructive"
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="mt-5">
        <h4 className="text-[15px] font-bold">Words ({pattern.words.length})</h4>
        {suggestions.length > 0 && (
          <div
            role="group"
            aria-labelledby={`suggestions-${pattern.id}`}
            className="mt-2 flex flex-wrap items-center gap-2"
          >
            <span id={`suggestions-${pattern.id}`} className="text-[13px] font-semibold text-muted-foreground">
              Try:
            </span>
            {suggestions.map((word) => (
              <button
                key={word}
                type="button"
                onClick={() => addSuggestedWord(word)}
                className="min-h-[44px] cursor-pointer rounded-full border-2 border-sky bg-sky-soft px-4 py-2 text-[15px] font-bold text-sky-ink outline-none transition hover:brightness-95 focus-visible:brightness-95 focus-visible:ring-[3px] focus-visible:ring-ring/60"
              >
                {word}
              </button>
            ))}
          </div>
        )}
        {pattern.words.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {pattern.words.map((word) => (
              <span
                key={word}
                className="inline-flex items-center gap-1.5 rounded-full bg-leaf-soft py-2 pr-2 pl-4 text-[15px] font-semibold"
              >
                {word}
                <button
                  type="button"
                  onClick={() => removeWord(word)}
                  aria-label={`Remove ${word}`}
                  className="cursor-pointer rounded-full p-1 font-bold text-muted-foreground outline-none hover:bg-card hover:text-destructive focus-visible:bg-card focus-visible:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/60"
                >
                  <XIcon className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex max-w-md gap-2">
          <Input
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addWord()
              }
            }}
            placeholder="Add a word"
            maxLength={50}
            aria-label="New word"
          />
          <Button onClick={addWord} disabled={!newWord.trim()}>
            Add
          </Button>
        </div>
      </div>
    </section>
  )
}
