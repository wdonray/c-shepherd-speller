/**
 * Word-search generator for the printable-worksheets feature (issue #402).
 *
 * Pure and deterministic: randomness comes from the injected `rand` (use
 * mulberry32 from './worksheets' for a reproducible print job). Words are
 * uppercased and placed in 8 directions (horizontal, vertical, diagonal, both
 * ways); overlapping placements may share letters when they agree. Words that
 * cannot be placed, or that contain non A-Z letters, land in `unplaced`.
 */
export interface WordSearchPlacement {
  word: string
  cells: Array<{ row: number; col: number }>
}

export interface WordSearchResult {
  size: number
  grid: string[][] // size x size, single uppercase letters
  placements: WordSearchPlacement[] // cells in word order
  unplaced: string[] // words that did not fit, exactly as passed in
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

const MAX_PLACEMENT_ATTEMPTS = 50
const MIN_GRID_SIZE = 10
const MAX_GRID_SIZE = 20
const FILLER_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

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
 * are skipped into `unplaced`. Grid size = clamp(longestWord + 2, 10, 20).
 * 8 directions. Each word gets up to 50 random placement attempts; failures
 * go to `unplaced`. Empty cells are filled with random A-Z via `rand`.
 */
export function generateWordSearch(words: string[], rand: () => number): WordSearchResult {
  const longest = words.reduce((max, word) => Math.max(max, word.length), 0)
  const size = Math.min(MAX_GRID_SIZE, Math.max(MIN_GRID_SIZE, longest + 2))
  const grid: string[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => ''))
  const placements: WordSearchPlacement[] = []
  const unplaced: string[] = []

  for (const raw of words) {
    const word = raw.toUpperCase()
    if (!/^[A-Z]+$/.test(word)) {
      unplaced.push(raw)
      continue
    }
    let placed = false
    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS && !placed; attempt++) {
      const [dr, dc] = DIRECTIONS[randomInt(rand, DIRECTIONS.length)]
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
        grid[r][c] = FILLER_LETTERS[randomInt(rand, FILLER_LETTERS.length)]
      }
    }
  }

  return { size, grid, placements, unplaced }
}
