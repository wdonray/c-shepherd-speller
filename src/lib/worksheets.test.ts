import { describe, expect, it } from 'vitest'
import type { SpellingPattern, WordList } from '@/models/WordList'
import {
  blankWordForPattern,
  blankWordInSentence,
  extractWorksheetWords,
  groupWordsByPattern,
  mulberry32,
  TYPES_NEEDING_SENTENCES,
  WORKSHEET_TYPES,
} from './worksheets'

function makePattern(overrides: Partial<SpellingPattern> = {}): SpellingPattern {
  return {
    id: 'pat-ae',
    sound: 'long a',
    pattern: 'a_e',
    frequency: 'common',
    words: ['cake', 'bake', 'late'],
    ...overrides,
  }
}

/** Attach undeclared legacy fields the way old stored lists still carry them. */
function withLegacy(pattern: SpellingPattern, legacy: Record<string, unknown>): SpellingPattern {
  return { ...pattern, ...legacy } as unknown as SpellingPattern
}

function makeList(patterns: SpellingPattern[]): WordList {
  return {
    id: 'list-1',
    userId: 'user-1',
    name: 'Week 5: Long A',
    patterns,
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
  }
}

describe('extractWorksheetWords', () => {
  it('collects every word in list order with its pattern metadata', () => {
    const list = makeList([
      makePattern({ id: 'pat-ae', words: ['cake', 'bake'] }),
      makePattern({ id: 'pat-ai', sound: 'long a', pattern: 'ai', words: ['rain', 'train'] }),
    ])
    expect(extractWorksheetWords(list)).toEqual([
      { word: 'cake', pattern: 'a_e', sound: 'long a', patternId: 'pat-ae' },
      { word: 'bake', pattern: 'a_e', sound: 'long a', patternId: 'pat-ae' },
      { word: 'rain', pattern: 'ai', sound: 'long a', patternId: 'pat-ai' },
      { word: 'train', pattern: 'ai', sound: 'long a', patternId: 'pat-ai' },
    ])
  })

  it('attaches the teacher-picked sentence only when one exists', () => {
    const list = makeList([makePattern({ words: ['cake', 'bake'], sentences: { cake: 'I like cake.' } })])
    const words = extractWorksheetWords(list)
    expect(words[0].sentence).toBe('I like cake.')
    expect('sentence' in words[1]).toBe(false)
  })

  it('works when the pattern has no sentences record at all', () => {
    const list = makeList([makePattern({ words: ['cake'] })])
    expect(extractWorksheetWords(list)[0].sentence).toBeUndefined()
  })

  it('skips locked patterns', () => {
    const list = makeList([
      makePattern({ id: 'pat-ae', words: ['cake'], isLocked: true }),
      makePattern({ id: 'pat-ai', pattern: 'ai', words: ['rain'] }),
    ])
    expect(extractWorksheetWords(list).map((w) => w.word)).toEqual(['rain'])
  })

  it('skips legacy odd-duck patterns', () => {
    const oddDuck = withLegacy(makePattern({ id: 'pat-odd', words: ['through'] }), { isOddDuck: true })
    const list = makeList([oddDuck, makePattern({ id: 'pat-ai', pattern: 'ai', words: ['rain'] })])
    expect(extractWorksheetWords(list).map((w) => w.word)).toEqual(['rain'])
  })

  it('skips words in the legacy oddDucks array, case-insensitively', () => {
    const pattern = withLegacy(makePattern({ words: ['cake', 'said', 'bake'] }), { oddDucks: ['SAID'] })
    const list = makeList([pattern])
    expect(extractWorksheetWords(list).map((w) => w.word)).toEqual(['cake', 'bake'])
  })

  it('ignores non-string entries in the legacy oddDucks array', () => {
    const pattern = withLegacy(makePattern({ words: ['cake', 'bake'] }), { oddDucks: ['nope', 42, null] })
    const list = makeList([pattern])
    expect(extractWorksheetWords(list).map((w) => w.word)).toEqual(['cake', 'bake'])
  })

  it('keeps every word when oddDucks is absent or not an array', () => {
    const missing = makeList([withLegacy(makePattern({ words: ['cake'] }), {})])
    expect(extractWorksheetWords(missing).map((w) => w.word)).toEqual(['cake'])
    const notArray = makeList([withLegacy(makePattern({ words: ['cake'] }), { oddDucks: 'said' })])
    expect(extractWorksheetWords(notArray).map((w) => w.word)).toEqual(['cake'])
  })

  it('returns an empty array for an empty list and for patterns with no words', () => {
    expect(extractWorksheetWords(makeList([]))).toEqual([])
    expect(extractWorksheetWords(makeList([makePattern({ words: [] })]))).toEqual([])
  })
})

describe('mulberry32', () => {
  it('is deterministic: the same seed produces the same sequence', () => {
    const first = mulberry32(42)
    const second = mulberry32(42)
    const a = Array.from({ length: 100 }, () => first())
    const b = Array.from({ length: 100 }, () => second())
    expect(a).toEqual(b)
  })

  it('produces a different sequence for a different seed', () => {
    const a = Array.from({ length: 20 }, () => mulberry32(1)())
    const b = Array.from({ length: 20 }, () => mulberry32(2)())
    expect(a).not.toEqual(b)
  })

  it('emits values in [0, 1)', () => {
    const rand = mulberry32(7)
    for (let i = 0; i < 1000; i++) {
      const value = rand()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('blankWordForPattern', () => {
  it('blanks a split pattern, keeping other letters', () => {
    expect(blankWordForPattern('cake', 'a_e')).toBe('c_k_')
  })

  it('blanks a contiguous pattern', () => {
    expect(blankWordForPattern('rain', 'ai')).toBe('r__n')
  })

  it('ignores underscore-only patterns', () => {
    expect(blankWordForPattern('cat', '___')).toBe('cat')
  })

  it('skips pattern letters that do not occur in the word', () => {
    expect(blankWordForPattern('cat', 'zq')).toBe('cat')
  })

  it('matches case-insensitively but keeps the original casing of other letters', () => {
    expect(blankWordForPattern('CAKE', 'a_e')).toBe('C_K_')
  })

  it('handles an empty pattern and an empty word', () => {
    expect(blankWordForPattern('cake', '')).toBe('cake')
    expect(blankWordForPattern('', 'a_e')).toBe('')
  })

  it('skips trailing pattern letters when the pattern is longer than the word', () => {
    expect(blankWordForPattern('at', 'ate')).toBe('__')
  })

  it('blanks each repeated pattern letter at the next unblanked occurrence', () => {
    expect(blankWordForPattern('banana', 'aa')).toBe('b_n_na')
  })

  it('skips a repeated pattern letter the word does not have twice', () => {
    expect(blankWordForPattern('cat', 'aa')).toBe('c_t')
  })
})

describe('groupWordsByPattern', () => {
  it('groups words by pattern id in first-seen order', () => {
    const groups = groupWordsByPattern([
      { word: 'cake', pattern: 'a_e', sound: 'long a', patternId: 'pat-ae' },
      { word: 'rain', pattern: 'ai', sound: 'long a', patternId: 'pat-ai' },
      { word: 'bake', pattern: 'a_e', sound: 'long a', patternId: 'pat-ae' },
    ])
    expect(groups).toEqual([
      { pattern: 'a_e', sound: 'long a', patternId: 'pat-ae', words: ['cake', 'bake'] },
      { pattern: 'ai', sound: 'long a', patternId: 'pat-ai', words: ['rain'] },
    ])
  })

  it('returns an empty array for no words', () => {
    expect(groupWordsByPattern([])).toEqual([])
  })
})

describe('worksheet type constants', () => {
  it('lists every worksheet type', () => {
    expect([...WORKSHEET_TYPES]).toEqual([
      'spelling-list',
      'cut-sort',
      'fill-blank',
      'word-search',
      'crossword',
      'reading',
      'parent-note',
    ])
  })

  it('marks exactly the sentence-needing types', () => {
    expect([...TYPES_NEEDING_SENTENCES]).toEqual(['fill-blank', 'crossword', 'reading'])
  })
})

describe('blankWordInSentence', () => {
  it('blanks the word where it occurs, keeping sentence casing', () => {
    expect(blankWordInSentence('We baked a Cake for the party.', 'cake', 'a_e')).toBe('We baked a C_k_ for the party.')
  })

  it('blanks only the first occurrence', () => {
    expect(blankWordInSentence('Cake, cake, cake.', 'cake', 'a_e')).toBe('C_k_, cake, cake.')
  })

  it('returns the sentence unchanged when the word is absent', () => {
    expect(blankWordInSentence('The rain fell.', 'cake', 'a_e')).toBe('The rain fell.')
  })

  it('returns the sentence unchanged for an empty word', () => {
    expect(blankWordInSentence('The rain fell.', '', 'a_e')).toBe('The rain fell.')
  })
})
