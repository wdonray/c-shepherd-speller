'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Volume2Icon } from 'lucide-react'
import type { WordList, SpellingPattern } from '@/models/WordList'
import WordAnalysis from './WordAnalysis'
import { speak } from '@/lib/tts'

interface SpellingTreeProps {
  list: WordList
}

/** Branch length by frequency (the "power bar" as branch size). */
const BRANCH_LENGTH: Record<string, number> = {
  common: 200,
  'less-common': 150,
  rare: 110,
}

const BRANCH_WIDTH: Record<string, number> = {
  common: 8,
  'less-common': 5,
  rare: 3,
}

const CENTER = { x: 400, y: 280 }
const WORD_FONT_SIZE = 26

interface PlacedWord {
  word: string
  pattern: SpellingPattern
  x: number
  y: number
}

interface PlacedBranch {
  pattern: SpellingPattern
  x1: number
  y1: number
  x2: number
  y2: number
  labelX: number
  labelY: number
}

/**
 * Interactive spelling tree: target sound at center, patterns as branches
 * (sized by frequency), words as clickable leaves. The digital version of
 * the CKLA spelling tree teachers asked for.
 *
 * Designed for projectors: large text, high contrast, keyboard accessible.
 */
export default function SpellingTree({ list }: SpellingTreeProps) {
  const [selected, setSelected] = useState<{ word: string; pattern: SpellingPattern } | null>(null)

  // Separate regular patterns from odd ducks.
  const { branches, oddDucks, centerSound } = useMemo(() => {
    const regular = list.patterns.filter((p) => !p.isOddDuck)
    const oddDucks = list.patterns.filter((p) => p.isOddDuck)

    // Center sound: most common sound among patterns, fallback to list name.
    const soundCounts = new Map<string, number>()
    for (const p of list.patterns) {
      soundCounts.set(p.sound, (soundCounts.get(p.sound) ?? 0) + 1)
    }
    let centerSound = list.name
    let maxCount = 0
    for (const [sound, count] of soundCounts) {
      if (count > maxCount) {
        maxCount = count
        centerSound = sound
      }
    }

    // Place branches radially around the center.
    const branches: PlacedBranch[] = regular.map((pattern, i) => {
      const angle = (2 * Math.PI * i) / Math.max(regular.length, 1) - Math.PI / 2
      const length = BRANCH_LENGTH[pattern.frequency] ?? 150
      const x2 = CENTER.x + length * Math.cos(angle)
      const y2 = CENTER.y + length * Math.sin(angle)
      // Label at 60% along the branch, offset perpendicular.
      const labelX = CENTER.x + length * 0.6 * Math.cos(angle)
      const labelY = CENTER.y + length * 0.6 * Math.sin(angle)
      return { pattern, x1: CENTER.x, y1: CENTER.y, x2, y2, labelX, labelY }
    })

    return { branches, oddDucks, centerSound }
  }, [list])

  // Place words as leaves along each branch.
  const placedWords: PlacedWord[] = useMemo(() => {
    const words: PlacedWord[] = []
    for (const branch of branches) {
      const { pattern, x1, y1, x2, y2 } = branch
      const count = pattern.words.length
      pattern.words.forEach((word, i) => {
        // Spread words along the branch, offset alternately for readability.
        const t = (i + 1) / (count + 1)
        const x = x1 + (x2 - x1) * t
        const y = y1 + (y2 - y1) * t + (i % 2 === 0 ? -18 : 18)
        words.push({ word, pattern, x, y })
      })
    }
    return words
  }, [branches])

  // Odd duck words go in the "pond" at the bottom.
  const oddDuckWords: PlacedWord[] = useMemo(() => {
    const words: PlacedWord[] = []
    oddDucks.forEach((pattern, pi) => {
      pattern.words.forEach((word, wi) => {
        const x = 150 + pi * 250 + wi * 90
        const y = 520
        words.push({ word, pattern, x, y })
      })
    })
    return words
  }, [oddDucks])

  const allWords = [...placedWords, ...oddDuckWords]

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">{list.name}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => speak(centerSound)}
          aria-label={`Hear the sound ${centerSound}`}
        >
          <Volume2Icon className="size-4" />
          Hear sound
        </Button>
      </div>

      <svg
        viewBox="0 0 800 600"
        className="w-full h-auto max-h-[70vh] bg-background"
        role="img"
        aria-label={`Spelling tree for ${centerSound} with ${branches.length} patterns`}
      >
        {/* Branches */}
        {branches.map((branch) => (
          <g key={branch.pattern.id}>
            <line
              x1={branch.x1}
              y1={branch.y1}
              x2={branch.x2}
              y2={branch.y2}
              stroke="currentColor"
              strokeWidth={BRANCH_WIDTH[branch.pattern.frequency] ?? 5}
              strokeLinecap="round"
              className="text-muted-foreground"
            />
            <text
              x={branch.labelX}
              y={branch.labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={30}
              fontWeight="bold"
              className="fill-foreground font-mono"
            >
              {branch.pattern.pattern}
            </text>
          </g>
        ))}

        {/* Center: target sound */}
        <circle cx={CENTER.x} cy={CENTER.y} r={55} className="fill-primary" />
        <text
          x={CENTER.x}
          y={CENTER.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={28}
          fontWeight="bold"
          className="fill-primary-foreground"
        >
          {centerSound.length > 10 ? centerSound.slice(0, 10) : centerSound}
        </text>

        {/* Words as clickable leaves */}
        {allWords.map(({ word, pattern, x, y }, i) => (
          <g key={`${pattern.id}-${word}-${i}`}>
            <circle cx={x} cy={y} r={WORD_FONT_SIZE * 0.9} className="fill-secondary" />
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={WORD_FONT_SIZE}
              fontWeight="600"
              className="fill-secondary-foreground cursor-pointer"
              onClick={() => setSelected({ word, pattern })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setSelected({ word, pattern })
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Analyze the word ${word}`}
            >
              {word.length > 8 ? word.slice(0, 8) : word}
            </text>
          </g>
        ))}

        {/* Odd ducks pond label */}
        {oddDucks.length > 0 && (
          <text x={400} y={560} textAnchor="middle" fontSize={22} fontStyle="italic" className="fill-muted-foreground">
            Odd ducks (irregular spellings)
          </text>
        )}
      </svg>

      <p className="text-sm text-muted-foreground mt-2 text-center">
        Click a word to see its analysis. Branch size shows how common each pattern is.
      </p>

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
