'use client'

import { useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Volume2Icon, CheckIcon, XIcon } from 'lucide-react'
import type { WordList } from '@/models/WordList'
import { speak } from '@/lib/tts'

interface PracticeModeProps {
  list: WordList
  onExit: () => void
}

interface WordItem {
  word: string
  pattern: string
}

/**
 * Practice mode: TTS speaks the word, student types the spelling.
 * Missed words go into a review queue; a word must be spelled correctly
 * twice to clear from the queue (error review loop).
 */
export default function PracticeMode({ list, onExit }: PracticeModeProps) {
  // Flatten all words from all patterns.
  const allWords: WordItem[] = useMemo(() => {
    const words: WordItem[] = []
    for (const pattern of list.patterns) {
      for (const word of pattern.words) {
        words.push({ word, pattern: pattern.pattern })
      }
    }
    return words
  }, [list])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [reviewQueue, setReviewQueue] = useState<Map<string, number>>(new Map())
  const [correctCount, setCorrectCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [streak, setStreak] = useState(0)

  const current = allWords[currentIndex]

  const speakWord = useCallback(() => {
    speak(current!.word)
  }, [current])

  const speakSentence = useCallback(() => {
    speak(`The word is ${current!.word}.`)
  }, [current])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!current || feedback) return

    const isCorrect = input.trim().toLowerCase() === current.word.toLowerCase()
    setTotalCount((c) => c + 1)

    if (isCorrect) {
      setFeedback('correct')
      setCorrectCount((c) => c + 1)
      setStreak((s) => s + 1)
      // If this word was in the review queue, increment its clear count.
      // A word must be spelled correctly twice to clear from the queue.
      setReviewQueue((prev) => {
        if (!prev.has(current.word)) return prev
        const next = new Map(prev)
        const count = next.get(current.word)! + 1
        if (count >= 2) {
          next.delete(current.word)
        } else {
          next.set(current.word, count)
        }
        return next
      })
    } else {
      setFeedback('incorrect')
      setStreak(0)
      // Add to review queue (or reset count if already there)
      setReviewQueue((prev) => {
        const next = new Map(prev)
        if (!next.has(current.word)) {
          next.set(current.word, 0)
        }
        return next
      })
    }
  }

  const handleNext = () => {
    setInput('')
    setFeedback(null)
    // Move to next word, wrapping around. Prioritize review queue words.
    if (reviewQueue.size > 0) {
      // Find the next review word in the list (always found, since review words come from the list)
      const reviewWords = Array.from(reviewQueue.keys())
      const nextReviewIndex = allWords.findIndex((w) => reviewWords.includes(w.word))
      setCurrentIndex(nextReviewIndex)
      return
    }
    setCurrentIndex((i) => (i + 1) % allWords.length)
  }

  if (allWords.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-xl text-muted-foreground mb-4">This list has no words yet.</p>
        <Button onClick={onExit}>Back to lists</Button>
      </div>
    )
  }

  const progress = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>
            {correctCount} of {totalCount} correct ({progress}%)
          </span>
          {streak > 1 && <span className="font-semibold">Streak: {streak}</span>}
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
        {reviewQueue.size > 0 && (
          <p className="text-sm text-muted-foreground">Review: {reviewQueue.size} word(s) need practice</p>
        )}
      </div>

      {/* Word prompt */}
      <div className="text-center space-y-4">
        <div className="flex justify-center gap-2">
          <Button size="lg" onClick={speakWord} aria-label="Hear the word">
            <Volume2Icon className="size-5" />
            Hear word
          </Button>
          <Button size="lg" variant="outline" onClick={speakSentence} aria-label="Hear the word in a sentence">
            <Volume2Icon className="size-5" />
            Sentence
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type the spelling"
            className="text-2xl text-center py-6"
            aria-label="Type the spelling"
            disabled={feedback !== null}
            autoFocus
          />
          {!feedback ? (
            <Button type="submit" size="lg" className="w-full" disabled={!input.trim()}>
              Check
            </Button>
          ) : (
            <Button type="button" size="lg" className="w-full" onClick={handleNext}>
              Next word
            </Button>
          )}
        </form>

        {feedback && (
          <div
            role="alert"
            className={`text-2xl font-bold flex items-center justify-center gap-2 ${
              feedback === 'correct' ? 'text-green-600' : 'text-destructive'
            }`}
          >
            {feedback === 'correct' ? (
              <>
                <CheckIcon className="size-8" />
                Correct!
              </>
            ) : (
              <>
                <XIcon className="size-8" />
                The spelling is: {current.word}
              </>
            )}
          </div>
        )}
      </div>

      <div className="text-center">
        <Button variant="ghost" onClick={onExit}>
          Exit practice
        </Button>
      </div>
    </div>
  )
}
