/**
 * Pure worksheet generators for the printable-worksheets feature (issue #402).
 *
 * This module extracts worksheet-eligible words from a WordList and provides
 * the deterministic helpers the worksheet renderers need: a seeded PRNG so a
 * print job is reproducible, a fill-in-the-blank pattern blanker, and grouping
 * back into pattern columns. Everything here is pure (no DOM, no I/O), so the
 * generators stay testable and reusable between server-side rendering and the
 * client print preview.
 */
import type { SpellingPattern, WordList } from '@/models/WordList'

export const WORKSHEET_TYPES = [
  'spelling-list',
  'cut-sort',
  'fill-blank',
  'word-search',
  'crossword',
  'reading',
  'parent-note',
] as const
export type WorksheetType = (typeof WORKSHEET_TYPES)[number]

/** One word eligible for worksheets. */
export interface WorksheetWord {
  word: string
  pattern: string // e.g. "a_e"
  sound: string // e.g. "long a"
  patternId: string
  sentence?: string // teacher-picked sentence, from pattern.sentences[word]
}

/**
 * Legacy odd-duck fields, removed from the schema (issue #381) but still
 * present on older stored lists. zod strips them on parse, so a typed
 * WordList never declares them; they are read defensively off the raw shape.
 */
interface LegacyOddDuckFields {
  isOddDuck?: unknown
  oddDucks?: unknown
}

function legacyOddDuckFields(pattern: SpellingPattern): LegacyOddDuckFields {
  return pattern as unknown as LegacyOddDuckFields
}

/** True when a pattern is hidden from worksheets: locked, or a legacy odd-duck pattern. */
function isWorksheetSkippedPattern(pattern: SpellingPattern): boolean {
  if (pattern.isLocked) return true
  return legacyOddDuckFields(pattern).isOddDuck === true
}

/** Lowercased set of legacy odd-duck words for a pattern; empty when it has none. */
function legacyOddDuckWordSet(pattern: SpellingPattern): Set<string> {
  const oddDucks = legacyOddDuckFields(pattern).oddDucks
  if (!Array.isArray(oddDucks)) return new Set()
  return new Set(oddDucks.filter((word): word is string => typeof word === 'string').map((word) => word.toLowerCase()))
}

/**
 * Collect every worksheet-eligible word from a list, in list order.
 * Skips: patterns with isLocked (hidden until taught), patterns with
 * isOddDuck (irregulars), and words in a pattern's legacy oddDucks array.
 */
export function extractWorksheetWords(list: WordList): WorksheetWord[] {
  const words: WorksheetWord[] = []
  for (const pattern of list.patterns) {
    if (isWorksheetSkippedPattern(pattern)) continue
    const oddDuckWords = legacyOddDuckWordSet(pattern)
    for (const word of pattern.words) {
      if (oddDuckWords.has(word.toLowerCase())) continue
      const entry: WorksheetWord = {
        word,
        pattern: pattern.pattern,
        sound: pattern.sound,
        patternId: pattern.id,
      }
      const sentence = pattern.sentences?.[word]
      if (sentence !== undefined) entry.sentence = sentence
      words.push(entry)
    }
  }
  return words
}

/**
 * Seeded PRNG (mulberry32): deterministic per print job. The same seed
 * always produces the same sequence, so a reprint is identical; different
 * seeds (for example per student) give different shuffles and layouts.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Blank the spelling pattern inside a word for fill-in-the-blank.
 * For each letter of `pattern` (ignoring '_' placeholders in split patterns
 * like "a_e"), replace the first still-unblanked occurrence of that letter
 * in the word (case-insensitive match, original casing of other letters kept)
 * with '_'. Letters of the pattern that do not occur are skipped.
 * Example: blankWordForPattern('cake', 'a_e') === 'c_k_'
 */
export function blankWordForPattern(word: string, pattern: string): string {
  const letters = word.split('')
  const blanked = new Set<number>()
  for (const patternLetter of pattern) {
    if (patternLetter === '_') continue
    const target = patternLetter.toLowerCase()
    const index = letters.findIndex((letter, i) => !blanked.has(i) && letter.toLowerCase() === target)
    if (index === -1) continue
    blanked.add(index)
    letters[index] = '_'
  }
  return letters.join('')
}

/** Words grouped back under one pattern column, preserving first-seen order. */
export interface PatternWordGroup {
  pattern: string
  sound: string
  patternId: string
  words: string[]
}

/** Group words back into their patterns, preserving first-seen order. */
export function groupWordsByPattern(words: WorksheetWord[]): PatternWordGroup[] {
  const groups: PatternWordGroup[] = []
  const byId = new Map<string, PatternWordGroup>()
  for (const { word, pattern, sound, patternId } of words) {
    const existing = byId.get(patternId)
    if (existing) {
      existing.words.push(word)
    } else {
      const group: PatternWordGroup = { pattern, sound, patternId, words: [word] }
      byId.set(patternId, group)
      groups.push(group)
    }
  }
  return groups
}

/**
 * Words per cut-and-sort page (issue #520). Paste boxes sized to fit the
 * cut-out cards only fit on one page, so longer lists paginate; worksheet
 * sections never split across pages.
 */
export const CUT_SORT_WORDS_PER_PAGE = 6

/**
 * Words of one pattern per cut-and-sort page (issue #520). Six tall boxes in
 * a single column measure ~1140px against ~960px of printable portrait
 * height, so a lopsided pattern would overflow the page; four per column
 * keeps every page printable.
 */
export const CUT_SORT_WORDS_PER_PATTERN = 4

/**
 * Split pattern groups into cut-and-sort pages (issue #520): at most
 * `CUT_SORT_WORDS_PER_PAGE` words per page and at most
 * `CUT_SORT_WORDS_PER_PATTERN` words of one pattern per page, so every page
 * fits on one printed portrait sheet. Pattern order and per-group word order
 * are preserved; a group with more words than the per-pattern cap spans
 * pages.
 */
export function chunkCutSortPages(
  groups: PatternWordGroup[],
  cap: number = CUT_SORT_WORDS_PER_PAGE,
  perPatternCap: number = CUT_SORT_WORDS_PER_PATTERN
): PatternWordGroup[][] {
  const pages: PatternWordGroup[][] = []
  let current: PatternWordGroup[] = []
  let count = 0
  let patternCounts = new Map<string, number>()
  const flush = () => {
    if (current.length > 0) pages.push(current)
    current = []
    count = 0
    patternCounts = new Map()
  }
  for (const group of groups) {
    let words = group.words
    while (words.length > 0) {
      if (count === cap) flush()
      const patternCount = patternCounts.get(group.patternId) ?? 0
      if (patternCount === perPatternCap) flush()
      // A second iteration for the same group always follows a flush (the
      // first take fills the page or the pattern's share of it), so the
      // current page never already holds this pattern: each page carries at
      // most one entry per pattern.
      const take = words.slice(0, Math.min(cap - count, perPatternCap - (patternCounts.get(group.patternId) ?? 0)))
      current.push({ ...group, words: [...take] })
      count += take.length
      patternCounts.set(group.patternId, (patternCounts.get(group.patternId) ?? 0) + take.length)
      words = words.slice(take.length)
    }
  }
  flush()
  return pages
}

/**
 * Sentences per fill-in-the-blank page (issue #522). The worksheet norm is
 * <=8-10 sentences per page; 8 is the conservative end so a page never
 * overwhelms. Sections never split across pages, so the cap decides where
 * pages break.
 */
export const FILL_BLANK_SENTENCES_PER_PAGE = 8

/**
 * Sentences per reading-practice page (issue #522). The tested 2nd-grade
 * reading comfort zone is ~44-47 words total; the sentence bank averages
 * 6.62 words per sentence, so 6 sentences land at ~40 words per page.
 */
export const READING_SENTENCES_PER_PAGE = 6

/**
 * Split sentence-based sheet items into pages (issue #522): at most `cap`
 * sentences per page, preserving order. The caller decides which cap
 * applies (fill-in-the-blank vs reading).
 */
export function chunkSentencePages<T>(items: T[], cap: number = FILL_BLANK_SENTENCES_PER_PAGE): T[][] {
  const pages: T[][] = []
  for (let i = 0; i < items.length; i += cap) {
    pages.push(items.slice(i, i + cap))
  }
  return pages
}

/**
 * Render a teacher-authored pattern shorthand in parent-friendly form.
 * Patterns are free-form teacher input (`a_e`, `ai`), so no lookup table can
 * cover them; the underscore slot becomes a hyphen (`a_e` -> `a-e`), matching
 * how phonics family materials print spellings for parents.
 */
export function plainPatternSpelling(pattern: string): string {
  return pattern.replace(/_+/g, '-')
}

/**
 * Format a `YYYY-MM-DD` test date the way the parent note shows it:
 * "Friday, October 30", in the teacher's local timezone. Returns null for
 * anything that is not a real calendar date, so a hand-typed URL param can
 * never render a bogus date on the note.
 */
export function formatTestDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  // Constructed as a local date (not UTC) so the weekday matches the
  // teacher's calendar; then confirm it round-trips to catch e.g. Feb 30.
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(date)
}

/** Which worksheet types need a per-word sentence. */
export const TYPES_NEEDING_SENTENCES: readonly WorksheetType[] = ['fill-blank', 'crossword', 'reading']

/**
 * Replace the first case-insensitive occurrence of `word` in `sentence`
 * with its pattern-blanked form. The sentence keeps its original casing;
 * only the matched word changes. Returns the sentence unchanged when the
 * word does not occur in it.
 */
export function blankWordInSentence(sentence: string, word: string, pattern: string): string {
  if (word.length === 0) return sentence
  const index = sentence.toLowerCase().indexOf(word.toLowerCase())
  if (index === -1) return sentence
  const blanked = blankWordForPattern(sentence.slice(index, index + word.length), pattern)
  return sentence.slice(0, index) + blanked + sentence.slice(index + word.length)
}

/**
 * Replace the first case-insensitive occurrence of `word` in `sentence`
 * with underscores matching its length, blanking the whole word out.
 * Used for crossword clues, where the sentence gives the context but the
 * word itself must not be visible. Returns the sentence unchanged when
 * the word does not occur in it.
 */
export function blankWholeWordInSentence(sentence: string, word: string): string {
  if (word.length === 0) return sentence
  const index = sentence.toLowerCase().indexOf(word.toLowerCase())
  if (index === -1) return sentence
  const blank = '_'.repeat(sentence.slice(index, index + word.length).length)
  return sentence.slice(0, index) + blank + sentence.slice(index + word.length)
}
