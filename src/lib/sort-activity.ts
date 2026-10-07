import type { WordList } from '@/models/WordList'

/** A word in the sort bank, tagged with the pattern it belongs to. */
export interface BankWord {
  /** Unique id: `${patternId}:${word}` so duplicate words in different patterns stay distinct. */
  id: string
  word: string
  patternId: string
}

/** Per-word grading result from checkPlacements. */
export interface PlacementResult {
  wordId: string
  correct: boolean
}

/**
 * Collect every word from non-odd-duck patterns into a shuffled bank.
 * Odd ducks are excluded: they are irregular by definition, so sorting
 * them by pattern is meaningless.
 */
export function buildWordBank(list: WordList): BankWord[] {
  const bank: BankWord[] = []
  for (const pattern of list.patterns) {
    if (pattern.isOddDuck) continue
    for (const word of pattern.words) {
      bank.push({ id: `${pattern.id}:${word}`, word, patternId: pattern.id })
    }
  }
  // Fisher-Yates shuffle.
  for (let i = bank.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = bank[i]!
    bank[i] = bank[j]!
    bank[j] = temp
  }
  return bank
}

/**
 * Grade placements: each entry maps a bank word id to the pattern column
 * the student dropped it in. Returns per-word correctness and the score.
 * Words not placed (still in the bank) count as incorrect.
 */
export function checkPlacements(
  bank: BankWord[],
  placements: Record<string, string>
): { results: PlacementResult[]; correct: number; total: number } {
  const results: PlacementResult[] = bank.map((entry) => ({
    wordId: entry.id,
    correct: placements[entry.id] === entry.patternId,
  }))
  const correct = results.filter((r) => r.correct).length
  return { results, correct, total: bank.length }
}
