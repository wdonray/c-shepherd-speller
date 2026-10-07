'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Volume2Icon, CheckIcon, StarIcon, ChevronLeftIcon } from 'lucide-react'
import type { WordList } from '@/models/WordList'
import { speak, buildSentencePrompt } from '@/lib/tts'
import { logActivity } from '@/lib/activity'
import { trackEvent } from '@/lib/track-event'
import { OddDuck } from './OddDuck'

interface PracticeModeProps {
  list: WordList
  onExit: () => void
}

interface WordItem {
  word: string
  pattern: string
}

type Phase = 'prompt' | 'correct' | 'incorrect' | 'complete' | 'review-complete'

function starsFor(pct: number): number {
  if (pct >= 100) return 3
  if (pct >= 80) return 2
  if (pct >= 40) return 1
  return 0
}

/**
 * Practice mode: TTS speaks the word, the student types the spelling.
 * One pass through every word, then a completion card. Missed words go
 * into a review queue; a word must be spelled correctly twice to clear it.
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

  // The word on screen. Tracked explicitly so feedback banners never go
  // stale when the review queue shrinks underneath them. Always valid in
  // the main render path (the empty list returns early).
  const [activeWord, setActiveWord] = useState<WordItem>(() => allWords[0] as WordItem)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [reviewIndex, setReviewIndex] = useState(0)
  const [reviewMode, setReviewMode] = useState(false)
  const [phase, setPhase] = useState<Phase>('prompt')
  const [input, setInput] = useState('')
  const [lastAnswer, setLastAnswer] = useState('')
  const [reviewQueue, setReviewQueue] = useState<Map<string, number>>(new Map())
  const [correctCount, setCorrectCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [lastCleared, setLastCleared] = useState(false)

  const reviewWords = Array.from(reviewQueue.keys())

  const speakWord = () => {
    speak(activeWord.word)
  }

  const speakSentence = () => {
    speak(buildSentencePrompt(activeWord.word))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // The answer input is disabled outside the prompt phase, so the form
    // can only be submitted while answering.
    const isCorrect = input.trim().toLowerCase() === activeWord.word.toLowerCase()
    setTotalCount((c) => c + 1)

    if (isCorrect) {
      const nextStreak = streak + 1
      setStreak(nextStreak)
      setBestStreak((b) => Math.max(b, nextStreak))
      setCorrectCount((c) => c + 1)
      const nextQueue = new Map(reviewQueue)
      let cleared = false
      if (nextQueue.has(activeWord.word)) {
        const count = nextQueue.get(activeWord.word)! + 1
        if (count >= 2) {
          nextQueue.delete(activeWord.word)
          cleared = true
        } else {
          nextQueue.set(activeWord.word, count)
        }
      }
      setReviewQueue(nextQueue)
      setLastCleared(cleared)
      setPhase('correct')
    } else {
      setStreak(0)
      setLastAnswer(input.trim())
      const nextQueue = new Map(reviewQueue)
      if (!nextQueue.has(activeWord.word)) {
        nextQueue.set(activeWord.word, 0)
      }
      setReviewQueue(nextQueue)
      setLastCleared(false)
      setPhase('incorrect')
    }
  }

  const handleNext = () => {
    setInput('')
    if (reviewMode) {
      if (reviewQueue.size === 0) {
        setPhase('review-complete')
        return
      }
      // A cleared word leaves the next word at this index; otherwise advance.
      const nextIndex = lastCleared ? reviewIndex % reviewQueue.size : (reviewIndex + 1) % reviewQueue.size
      setReviewIndex(nextIndex)
      const word = reviewWords[nextIndex]
      setActiveWord(allWords.find((w) => w.word === word) as WordItem)
      setLastCleared(false)
      setPhase('prompt')
      return
    }
    if (currentIndex + 1 >= allWords.length) {
      logActivity('practiced', list.name)
      trackEvent('practice-session')
      trackEvent('words-practiced', allWords.length)
      setPhase('complete')
      return
    }
    const nextIndex = currentIndex + 1
    setCurrentIndex(nextIndex)
    setActiveWord(allWords[nextIndex] as WordItem)
    setPhase('prompt')
  }

  const handleTryAgain = () => {
    setInput('')
    setPhase('prompt')
  }

  const startReview = () => {
    const word = reviewWords[0]
    setReviewMode(true)
    setReviewIndex(0)
    setActiveWord(allWords.find((w) => w.word === word) as WordItem)
    setInput('')
    setLastCleared(false)
    setPhase('prompt')
  }

  const restart = () => {
    setActiveWord(allWords[0] as WordItem)
    setCurrentIndex(0)
    setReviewIndex(0)
    setReviewMode(false)
    setPhase('prompt')
    setInput('')
    setLastAnswer('')
    setReviewQueue(new Map())
    setCorrectCount(0)
    setTotalCount(0)
    setStreak(0)
    setBestStreak(0)
    setLastCleared(false)
  }

  const progress = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0

  const header = (title: string, sub: string) => (
    <div>
      <button
        type="button"
        onClick={onExit}
        className="cursor-pointer text-[15px] font-semibold text-sky-ink outline-none hover:underline focus-visible:underline focus-visible:ring-[3px] focus-visible:ring-ring/60"
      >
        <ChevronLeftIcon className="mr-1 inline size-4" aria-hidden="true" />
        Exit practice
      </button>
      <h1 className="mt-3 text-[30px] leading-tight font-bold">{title}</h1>
      {sub && <p className="mt-1 text-[15px] text-muted-foreground">{sub}</p>}
    </div>
  )

  const hearBlock = (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={speakWord}
        aria-label="Hear the word"
        className="flex size-50 cursor-pointer items-center justify-center rounded-full border-4 border-sky-deep bg-sky text-white shadow-[0_6px_0_var(--color-sky-dark)] outline-none transition hover:brightness-110 focus-visible:brightness-110 focus-visible:ring-[3px] focus-visible:ring-ring/60 active:translate-y-1 active:shadow-none"
      >
        <Volume2Icon className="size-20" aria-hidden="true" />
      </button>
      <p className="mt-4 text-xl font-bold text-sky-ink">Hear the word</p>
      <Button variant="secondary" onClick={speakSentence} className="mt-4">
        Hear it in a sentence
      </Button>
    </div>
  )

  const answerForm = (state: 'default' | 'correct' | 'wrong') => (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-2xl space-y-4">
      <label htmlFor="spelling-answer" className="text-lg font-bold">
        Spell the word you hear
      </label>
      <Input
        id="spelling-answer"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type the spelling"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        disabled={phase !== 'prompt'}
        className={cn(
          'h-24 rounded-[20px] border-[3px] text-center text-3xl',
          state === 'correct' && 'border-leaf bg-leaf-soft font-bold disabled:opacity-100',
          state === 'wrong' && 'border-coral bg-coral-soft font-bold disabled:opacity-100'
        )}
      />
      {phase === 'prompt' && (
        <Button type="submit" disabled={!input.trim()} className="h-18 w-full text-xl">
          Check
        </Button>
      )}
    </form>
  )

  const reviewPill =
    reviewQueue.size > 0 && !reviewMode ? (
      <div className="mx-auto w-fit">
        <div className="inline-flex items-center gap-2 rounded-full border-2 border-plum bg-plum-soft px-5 py-2.5">
          <OddDuck className="size-8 text-plum" />
          <span className="text-[15px] font-bold text-plum-ink">
            {`Review: ${reviewQueue.size} ${reviewQueue.size === 1 ? 'word' : 'words'}`}
          </span>
        </div>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Missed words come back in review. Spell one right twice to clear it.
        </p>
      </div>
    ) : null

  if (allWords.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        {header(`Practice: ${list.name}`, '')}
        <div className="rounded-[20px] border-2 border-line bg-card px-6 py-14 text-center">
          <h2 className="text-2xl font-bold">This list has no words yet</h2>
          <p className="mx-auto mt-2 max-w-md text-[15px] text-muted-foreground">
            Add words to your patterns first, then come back to practice.
          </p>
          <Button onClick={onExit} className="mt-6">
            Back to lists
          </Button>
        </div>
      </div>
    )
  }

  if (phase === 'complete' || phase === 'review-complete') {
    const done = phase === 'complete'
    const earned = starsFor(progress)
    return (
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        {header(`Practice: ${list.name}`, 'Session complete.')}
        <div className="mx-auto max-w-[700px] rounded-[20px] border-2 border-line bg-card px-6 py-12 text-center">
          <div className="flex items-center justify-center gap-3" aria-label={`${earned} of 3 stars`}>
            {[0, 1, 2].map((i) => (
              <StarIcon
                key={i}
                className={cn('size-[72px]', i < earned ? 'fill-sun text-sun-deep' : 'fill-line text-muted')}
                aria-hidden="true"
              />
            ))}
          </div>
          <h2 className="mt-6 text-[32px] font-bold">{done ? 'List complete!' : 'Review complete!'}</h2>
          {done ? (
            <>
              <p className="mt-2 text-xl text-muted-foreground">{`${correctCount} of ${totalCount} correct`}</p>
              <p className="mt-1 text-base font-semibold">Best streak: {bestStreak}</p>
            </>
          ) : (
            <p className="mt-2 text-xl text-muted-foreground">You cleared every missed word.</p>
          )}
          <div className="mt-8 flex flex-col items-center gap-4">
            {done && reviewQueue.size > 0 && (
              <Button variant="plum" onClick={startReview} className="h-16 px-8 text-base">
                Review missed words
              </Button>
            )}
            {!done && (
              <Button onClick={restart} className="h-16 px-8 text-base">
                Practice again
              </Button>
            )}
            <Button variant="ghost" onClick={onExit} className="font-bold text-muted-foreground">
              Back to lists
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      {reviewMode
        ? header('Review time', 'Words you missed, back for another try.')
        : header(`Practice: ${list.name}`, 'Listen, then type the spelling.')}

      {reviewMode ? (
        <div className="rounded-[20px] border-2 border-plum bg-plum-soft p-6">
          <div className="flex items-center gap-4">
            <OddDuck className="size-[52px] shrink-0 text-plum" label="Odd duck illustration" />
            <div>
              <p className="text-xl font-bold text-plum-ink">{`Review ${reviewIndex + 1} of ${reviewWords.length}`}</p>
              <p className="text-sm text-plum-ink">Spell each word right twice to clear it.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-64 w-full flex-1">
            <p className="text-sm font-semibold">{`${correctCount} of ${totalCount} correct (${progress}%)`}</p>
            <div
              className="mt-2 h-[14px] overflow-hidden rounded-full bg-line"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Practice progress"
            >
              <div className="h-full rounded-full bg-leaf transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          </div>
          {streak > 1 && (
            <div className="inline-flex items-center gap-2 rounded-full border-2 border-sun-deep bg-sun-soft px-5 py-2">
              <StarIcon className="size-5 fill-sun text-sun-deep" aria-hidden="true" />
              <span className="text-base font-bold">Streak {streak}</span>
            </div>
          )}
        </div>
      )}

      {phase === 'correct' && (
        <div className="rounded-[20px] border-2 border-leaf bg-leaf-soft p-6" role="status">
          <div className="flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-leaf text-white">
              <CheckIcon className="size-8" aria-hidden="true" />
            </span>
            <div>
              <p className="text-2xl font-bold text-leaf-ink">Correct! Nice work.</p>
              <p className="text-xl">{activeWord.word}</p>
            </div>
          </div>
        </div>
      )}

      {phase === 'incorrect' && (
        <div className="rounded-[20px] border-2 border-coral bg-coral-soft p-6" role="alert">
          <p className="text-[22px] font-bold text-coral-ink">Not quite. The word is:</p>
          <p className="mt-1 text-[34px] leading-tight font-extrabold">{activeWord.word}</p>
          {activeWord.pattern ? (
            <p className="mt-2 text-[15px]">Look at the {activeWord.pattern} pattern, then try again.</p>
          ) : null}
        </div>
      )}

      {phase === 'prompt' && hearBlock}

      {phase === 'prompt' && answerForm('default')}
      {phase === 'correct' && answerForm('correct')}
      {phase === 'incorrect' && answerForm('wrong')}

      {phase === 'correct' && (
        <div className="mx-auto w-full max-w-2xl">
          <Button onClick={handleNext} className="h-18 w-full text-xl">
            Next word
          </Button>
        </div>
      )}
      {phase === 'incorrect' && (
        <>
          <div className="mx-auto flex w-full max-w-2xl gap-3">
            <Button variant="sunny" onClick={handleTryAgain} className="h-18 flex-1 text-xl">
              Try again
            </Button>
            <Button variant="secondary" onClick={handleNext} className="h-18 flex-1 text-xl">
              Next word
            </Button>
          </div>
          <p className="text-center text-sm text-plum-ink">
            {`"${lastAnswer}" ${reviewMode ? 'is still' : 'joined'} your review list. Spell it right twice to clear it.`}
          </p>
        </>
      )}

      {reviewPill}
    </div>
  )
}
