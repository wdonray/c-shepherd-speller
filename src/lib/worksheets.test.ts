import { describe, expect, it } from 'vitest'
import type { SpellingPattern, WordList } from '@/models/WordList'
import {
  blankWholeWordInSentence,
  blankWordForPattern,
  blankWordInSentence,
  chunkCutSortPages,
  CUT_SORT_WORDS_PER_PAGE,
  CUT_SORT_WORDS_PER_PATTERN,
  extractWorksheetWords,
  formatTestDate,
  groupWordsByPattern,
  mulberry32,
  plainPatternSpelling,
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

describe('chunkCutSortPages (issue #520)', () => {
  const ae = { pattern: 'a_e', sound: 'long a', patternId: 'pat-ae', words: ['cake', 'bake', 'late', 'date'] }
  const ai = { pattern: 'ai', sound: 'long a', patternId: 'pat-ai', words: ['rain', 'train'] }

  it('keeps a short list on one page', () => {
    expect(chunkCutSortPages([ae, ai])).toEqual([[ae, ai]])
  })

  it('returns no pages for no groups', () => {
    expect(chunkCutSortPages([])).toEqual([])
  })

  it('caps each page at CUT_SORT_WORDS_PER_PAGE', () => {
    expect(CUT_SORT_WORDS_PER_PAGE).toBe(6)
    const pages = chunkCutSortPages([ae, ai])
    for (const page of pages) {
      expect(page.flatMap((g) => g.words).length).toBeLessThanOrEqual(6)
    }
  })

  it('starts a new page when a group would overflow the cap', () => {
    const pages = chunkCutSortPages([ae, ai], 5)
    expect(pages).toEqual([
      [
        { ...ae, words: ['cake', 'bake', 'late', 'date'] },
        { ...ai, words: ['rain'] },
      ],
      [{ ...ai, words: ['train'] }],
    ])
  })

  it('spans a group across pages when it exceeds the per-pattern cap alone', () => {
    const big = { ...ae, words: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7'] }
    const pages = chunkCutSortPages([big])
    expect(pages).toEqual([[{ ...big, words: ['w1', 'w2', 'w3', 'w4'] }], [{ ...big, words: ['w5', 'w6', 'w7'] }]])
  })

  it('never puts more than CUT_SORT_WORDS_PER_PATTERN of one pattern on a page', () => {
    expect(CUT_SORT_WORDS_PER_PATTERN).toBe(4)
    // Six tall boxes in one column overflow a portrait page (measured
    // ~1140px against ~960px printable), so a lopsided pattern paginates.
    const pages = chunkCutSortPages([{ ...ae, words: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'] }])
    expect(pages).toEqual([[{ ...ae, words: ['w1', 'w2', 'w3', 'w4'] }], [{ ...ae, words: ['w5', 'w6'] }]])
    for (const page of pages) {
      for (const group of page) {
        expect(group.words.length).toBeLessThanOrEqual(CUT_SORT_WORDS_PER_PATTERN)
      }
    }
  })

  it('preserves pattern order and per-group word order across pages', () => {
    const pages = chunkCutSortPages([ae, ai], 4)
    const flat = pages.flatMap((page) => page.flatMap((g) => g.words))
    expect(flat).toEqual(['cake', 'bake', 'late', 'date', 'rain', 'train'])
    expect(pages[0].map((g) => g.patternId)).toEqual(['pat-ae'])
    expect(pages[1].map((g) => g.patternId)).toEqual(['pat-ai'])
  })
})

describe('plainPatternSpelling', () => {
  it('turns the underscore slot into a hyphen', () => {
    expect(plainPatternSpelling('a_e')).toBe('a-e')
  })

  it('leaves plain patterns untouched', () => {
    expect(plainPatternSpelling('ai')).toBe('ai')
  })

  it('collapses runs of underscores', () => {
    expect(plainPatternSpelling('a__e')).toBe('a-e')
  })
})

describe('formatTestDate', () => {
  it('formats a real date as weekday, month, and day', () => {
    expect(formatTestDate('2026-10-30')).toBe('Friday, October 30')
  })

  it('returns null for non-date input', () => {
    expect(formatTestDate('next friday')).toBeNull()
    expect(formatTestDate('')).toBeNull()
  })

  it('returns null for impossible calendar dates', () => {
    expect(formatTestDate('2026-02-30')).toBeNull()
    expect(formatTestDate('2026-13-01')).toBeNull()
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

describe('blankWholeWordInSentence', () => {
  it('blanks the entire word with matching underscores, keeping sentence casing', () => {
    expect(blankWholeWordInSentence('We baked a Cake for the party.', 'cake')).toBe('We baked a ____ for the party.')
  })

  it('blanks only the first occurrence', () => {
    expect(blankWholeWordInSentence('Cake, cake, cake.', 'cake')).toBe('____, cake, cake.')
  })

  it('returns the sentence unchanged when the word is absent', () => {
    expect(blankWholeWordInSentence('The rain fell.', 'cake')).toBe('The rain fell.')
  })

  it('returns the sentence unchanged for an empty word', () => {
    expect(blankWholeWordInSentence('The rain fell.', '')).toBe('The rain fell.')
  })
})
