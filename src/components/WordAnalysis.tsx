'use client'

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
 * Word analysis view: shows the word with its spelling pattern highlighted,
 * the target sound, and a speak button. Supports orthographic mapping by
 * making the grapheme-phoneme connection visible.
 */
export default function WordAnalysis({ word, pattern, onClose, onSpeak }: WordAnalysisProps) {
  const match = findPatternInWord(word, pattern.pattern)

  const renderWord = () => {
    if (!match) return <span>{word}</span>
    const [start, end] = match
    return (
      <span>
        {word.slice(0, start)}
        <span className="text-primary font-extrabold underline decoration-2">{word.slice(start, end)}</span>
        {word.slice(end)}
      </span>
    )
  }

  // Simple sentence template. Teachers can read their own sentence aloud;
  // this gives students a starting point for meaning.
  const sentence = `The word is ${word}.`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Word analysis for ${word}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div className="bg-background rounded-lg p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h2 className="text-4xl font-bold tracking-wide">{renderWord()}</h2>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close word analysis">
            <XIcon className="size-5" />
          </Button>
        </div>

        <dl className="space-y-2 text-lg">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Sound:</dt>
            <dd className="font-semibold">{pattern.sound}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Pattern:</dt>
            <dd className="font-mono font-semibold">{pattern.pattern}</dd>
          </div>
          {pattern.isOddDuck && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Note:</dt>
              <dd className="font-semibold">Odd duck (irregular spelling)</dd>
            </div>
          )}
        </dl>

        <p className="text-muted-foreground italic">{sentence}</p>

        <div className="flex gap-2">
          <Button onClick={() => onSpeak(word)}>
            <Volume2Icon className="size-4" />
            Say it
          </Button>
          <Button variant="outline" onClick={() => onSpeak(sentence)}>
            <Volume2Icon className="size-4" />
            Say sentence
          </Button>
        </div>
      </div>
    </div>
  )
}
