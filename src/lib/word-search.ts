/**
 * Word-search generator for the printable-worksheets feature (issue #402).
 *
 * Pure and deterministic: randomness comes from the injected `rand` (use
 * mulberry32 from './worksheets' for a reproducible print job). Difficulty
 * is set by grade band (issue #519): beginners (K-1) get a fixed 10x10 grid
 * with straight (across/down) placements only and large-print letters;
 * intermediate (2-3) and upper (4+) bands allow diagonals and grow the grid
 * up to 12 and 14 respectively. Overlapping placements may share letters
 * when they agree. Words that cannot be placed, or that contain non A-Z
 * letters, land in `unplaced`.
 */
export interface WordSearchPlacement {
  word: string
  cells: Array<{ row: number; col: number }>
}

/** Grade band driving word-search difficulty (issue #519). */
export type WordSearchDifficulty = 'beginner' | 'intermediate' | 'upper'

export interface WordSearchResult {
  size: number
  grid: string[][] // size x size, single uppercase letters
  placements: WordSearchPlacement[] // cells in word order
  unplaced: string[] // words that did not fit, exactly as passed in
  difficulty: WordSearchDifficulty
}

export interface WordSearchOptions {
  /** Defaults to 'upper' (the pre-#519 behavior: 8 directions, cap 14). */
  difficulty?: WordSearchDifficulty
  /**
   * Raw pattern spellings (e.g. 'a_e' + 'ai'): empty cells prefer these
   * letters over random A-Z, per the pattern-relevant filler norm. Falls back
   * to A-Z when no pattern letters are present.
   */
  patternSpellings?: string
}

/** The 8 placement directions: horizontal, vertical, and diagonal, both ways. */
const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
]

/** Straight directions only: across and down, both ways (no diagonals). */
const STRAIGHT_DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [0, -1],
  [0, 1],
  [1, 0],
]

interface DifficultyConfig {
  directions: ReadonlyArray<readonly [number, number]>
  /** null means a fixed grid size regardless of word length. */
  fixedSize: number | null
  maxSize: number
}

const DIFFICULTY_CONFIG: Record<WordSearchDifficulty, DifficultyConfig> = {
  // K-1: the norm says no diagonal words for beginners.
  beginner: { directions: STRAIGHT_DIRECTIONS, fixedSize: 10, maxSize: 10 },
  // 2-3: diagonals are fair; 12x12-14x14 intermediate norm, lower end.
  intermediate: { directions: DIRECTIONS, fixedSize: null, maxSize: 12 },
  // 4+: 12x12-14x14 norm, upper end.
  upper: { directions: DIRECTIONS, fixedSize: null, maxSize: 14 },
}

const MAX_PLACEMENT_ATTEMPTS = 50
const MIN_GRID_SIZE = 10
const FALLBACK_FILLER_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * Map a list's free-text grade level ('K', '1', '3rd Grade', 'kindergarten')
 * to a difficulty band. Unknown or missing grades default to beginner, the
 * safest band for young readers.
 */
export function gradeBandForGradeLevel(gradeLevel?: string): WordSearchDifficulty {
  const raw = gradeLevel?.trim().toLowerCase() ?? ''
  if (/^k\b|kindergarten/.test(raw)) return 'beginner'
  const match = raw.match(/(\d{1,2})/)
  if (!match) return 'beginner'
  const grade = Number(match[1])
  if (grade <= 1) return 'beginner'
  if (grade <= 3) return 'intermediate'
  return 'upper'
}

/**
 * Build the filler-letter pool: unique pattern letters (uppercased), or A-Z
 * when the patterns contribute no letters.
 */
function fillerLettersFor(patternSpellings: string | undefined): string {
  const letters = new Set<string>()
  for (const char of patternSpellings?.toUpperCase() ?? '') {
    if (/[A-Z]/.test(char)) letters.add(char)
  }
  return letters.size > 0 ? [...letters].join('') : FALLBACK_FILLER_LETTERS
}

/** Random int in [0, max) from the injected PRNG. */
function randomInt(rand: () => number, max: number): number {
  return Math.floor(rand() * max)
}

/** True when `word` fits at (row, col) along (dr, dc) without clashing. */
function cellsFit(
  grid: string[][],
  size: number,
  word: string,
  row: number,
  col: number,
  dr: number,
  dc: number
): boolean {
  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i
    const c = col + dc * i
    if (r < 0 || r >= size || c < 0 || c >= size) return false
    const cell = grid[r][c]
    if (cell !== '' && cell !== word[i]) return false
  }
  return true
}

/** Write `word` into the grid and return its placement (cells in word order). */
function writeWord(
  grid: string[][],
  word: string,
  row: number,
  col: number,
  dr: number,
  dc: number
): WordSearchPlacement {
  const cells: Array<{ row: number; col: number }> = []
  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i
    const c = col + dc * i
    grid[r][c] = word[i]
    cells.push({ row: r, col: c })
  }
  return { word, cells }
}

/**
 * Generate a word search. Words are uppercased; words with non A-Z letters
 * are skipped into `unplaced`. Grid size and directions follow the difficulty
 * band: beginner is a fixed 10x10 with straight placements only, others grow
 * to their band cap (12 / 14). Each word gets up to 50 random placement
 * attempts; failures go to `unplaced`. Empty cells are filled from the
 * pattern-letter pool via `rand`.
 */
export function generateWordSearch(
  words: string[],
  rand: () => number,
  options: WordSearchOptions = {}
): WordSearchResult {
  const difficulty = options.difficulty ?? 'upper'
  const config = DIFFICULTY_CONFIG[difficulty]
  const directions = config.directions
  const longest = words.reduce((max, word) => Math.max(max, word.length), 0)
  const size = config.fixedSize ?? Math.min(config.maxSize, Math.max(MIN_GRID_SIZE, longest + 2))
  const grid: string[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => ''))
  const placements: WordSearchPlacement[] = []
  const unplaced: string[] = []
  const fillerLetters = fillerLettersFor(options.patternSpellings)

  for (const raw of words) {
    const word = raw.toUpperCase()
    if (!/^[A-Z]+$/.test(word)) {
      unplaced.push(raw)
      continue
    }
    let placed = false
    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS && !placed; attempt++) {
      const [dr, dc] = directions[randomInt(rand, directions.length)]
      const row = randomInt(rand, size)
      const col = randomInt(rand, size)
      if (cellsFit(grid, size, word, row, col, dr, dc)) {
        placements.push(writeWord(grid, word, row, col, dr, dc))
        placed = true
      }
    }
    if (!placed) {
      unplaced.push(raw)
    }
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === '') {
        grid[r][c] = fillerLetters[randomInt(rand, fillerLetters.length)]
      }
    }
  }

  return { size, grid, placements, unplaced, difficulty }
}
