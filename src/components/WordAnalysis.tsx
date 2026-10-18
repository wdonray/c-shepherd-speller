'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Volume2Icon, XIcon } from 'lucide-react'
import type { SpellingPattern } from '@/models/WordList'

interface WordAnalysisProps {
  word: string
  pattern: SpellingPattern
  onClose: () => void
  onSpeak: (text: string) => void
}

/**
 * Find the character indices of a spelling pattern within a word.
 * Handles split patterns like "a_e" (matches "a" + any char + "e").
 * Returns [start, end] indices, or null if not found.
 */
export function findPatternInWord(word: string, pattern: string): [number, number] | null {
  const lowerWord = word.toLowerCase()
  const lowerPattern = pattern.toLowerCase()

  if (lowerPattern.includes('_')) {
    // Split pattern: e.g. "a_e" -> find "a", then "e" two positions later.
    const parts = lowerPattern.split('_')
    if (parts.length !== 2) return null
    const [first, second] = parts
    const start = lowerWord.indexOf(first)
    if (start === -1) return null
    const secondPos = start + first.length + 1
    if (lowerWord.slice(secondPos, secondPos + second.length) !== second) return null
    return [start, secondPos + second.length]
  }

  const start = lowerWord.indexOf(lowerPattern)
  if (start === -1) return null
  return [start, start + lowerPattern.length]
}

/**
 * Build the auto-generated mapping note for a word, from its pattern data.
 * Only single letters get a note (which letter spells the target sound in
 * that position). Multi-letter patterns get no note; the "letters work
 * together" sentence was removed (issue #371).
 */
export function buildMappingNote(pattern: string, sound: string): string | null {
  const letterCount = pattern.replace(/_/g, '').length
  if (letterCount > 1) return null
  return `The letter ${pattern} spells ${sound} here.`
}

interface WordParts {
  base: string
  affix: string
  kind: 'prefix' | 'suffix'
}

/**
 * Conservative affix detection: strip exactly ONE common affix, and only
 * when the remaining base is at least 2 characters. Suffixes are checked
 * first (longest first), then prefixes. Returns null when no clean split
 * applies, in which case the "Word parts" line is omitted rather than
 * guessed. Mechanical split only: spelling changes (doubled letters, y to
 * i) are not undone, so such words simply yield no split.
 */
export function splitWordParts(word: string): WordParts | null {
  const lower = word.toLowerCase()
  const suffixes = ['ing', 'est', 'ed', 'es', 'ly', 'er', 's']
  for (const affix of suffixes) {
    if (lower.endsWith(affix) && lower.length - affix.length >= 2) {
      return { base: word.slice(0, word.length - affix.length), affix, kind: 'suffix' }
    }
  }
  const prefixes = ['pre', 'dis', 'un', 're']
  for (const affix of prefixes) {
    if (lower.startsWith(affix) && lower.length - affix.length >= 2) {
      return { base: word.slice(affix.length), affix, kind: 'prefix' }
    }
  }
  return null
}

/**
 * Word analysis card: shows the word with its spelling pattern highlighted,
 * the target sound, and speak buttons. Display-only; generated from the
 * list's pattern data. (Phoneme chips deferred to v2: require a
 * pronunciation dictionary source; not hand-authored.)
 */
export default function WordAnalysis({ word, pattern, onClose, onSpeak }: WordAnalysisProps) {
  // Hand-rolled dialog, not Radix: add the Escape handling Radix dialogs get for free.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const match = findPatternInWord(word, pattern.pattern)
  const mappingNote = buildMappingNote(pattern.pattern, pattern.sound)
  const wordParts = splitWordParts(word)

  const renderWord = () => {
    if (!match) return <span>{word}</span>
    const [start, end] = match
    return (
      <span>
        {word.slice(0, start)}
        <span className="font-extrabold text-sun-ink underline decoration-sun decoration-[8px] underline-offset-8">
          {word.slice(start, end)}
        </span>
        {word.slice(end)}
      </span>
    )
  }

  // Teacher-picked example sentence for the word when one is available;
  // otherwise the simple template gives students a starting point for meaning.
  const sentence = pattern.sentences?.[word] ?? `The word is ${word}.`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Word analysis for ${word}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl space-y-6 rounded-[20px] border-2 border-line bg-card p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-5xl font-bold tracking-wide text-ink">{renderWord()}</h2>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close word analysis">
            <XIcon className="size-5" />
          </Button>
        </div>

        <div className="space-y-1 text-xl">
          <p>
            <span className="text-muted-foreground">Sound: </span>
            <span className="font-semibold text-ink">{pattern.sound}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Pattern: </span>
            <span className="font-semibold text-ink">{pattern.pattern}</span>
          </p>
        </div>

        {mappingNote && <p className="text-[15px] text-ink">{mappingNote}</p>}

        {wordParts && (
          <p className="text-[15px] text-ink">
            <span className="font-semibold">Word parts: </span>
            base word &lsquo;{wordParts.base}&rsquo; plus the {wordParts.kind} &lsquo;{wordParts.affix}&rsquo;.
          </p>
        )}

        <figure className="rounded-[14px] border-2 border-line bg-card p-5">
          <blockquote className="text-lg text-ink">&ldquo;{sentence}&rdquo;</blockquote>
        </figure>

        <div className="flex flex-wrap gap-3">
          <Button variant="sky" onClick={() => onSpeak(word)}>
            <Volume2Icon className="size-4" aria-hidden="true" />
            Say it
          </Button>
          <Button variant="secondary" onClick={() => onSpeak(sentence)}>
            <Volume2Icon className="size-4" aria-hidden="true" />
            Read the sentence
          </Button>
        </div>
      </div>
    </div>
  )
}
