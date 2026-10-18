/**
 * Greedy crossword layout generator for printable spelling worksheets.
 *
 * Words are placed one at a time, longest first, each new word crossing
 * an already placed word at a shared letter (standard greedy intersection
 * placement). Candidates are shuffled with the caller's random source so
 * repeated runs can produce different layouts. The working grid is
 * 21x21; the returned grid is trimmed to the bounding box of the placed
 * letters. Words that are too short, too long, not plain A-Z letters,
 * duplicated, or that cannot cross any placed word are reported in
 * `unplaced` instead of being placed. Clues are the caller-supplied
 * example sentences, carried through onto each placement untouched.
 */

export interface CrosswordEntry {
  word: string
  clue: string
}

export interface CrosswordCell {
  row: number
  col: number
}

export interface CrosswordPlacement {
  word: string
  clue: string
  number: number // Standard crossword clue number
  direction: 'across' | 'down'
  cells: CrosswordCell[] // In word order
}

export interface CrosswordResult {
  rows: number
  cols: number
  grid: (string | null)[][] // Trimmed to the bounding box; letters or null
  placements: CrosswordPlacement[]
  unplaced: string[] // Uppercased words that could not be placed
}

/** Working grid size; also the longest word that can be placed. */
export const MAX_CROSSWORD_SIZE = 21

type Direction = 'across' | 'down'

interface PlacedWord {
  word: string
  clue: string
  direction: Direction
  row: number
  col: number
}

interface Candidate {
  row: number
  col: number
  direction: Direction
}

const LETTERS_ONLY = /^[A-Z]+$/

function inBounds(row: number, col: number): boolean {
  return row >= 0 && col >= 0 && row < MAX_CROSSWORD_SIZE && col < MAX_CROSSWORD_SIZE
}

/** Letter at a cell, or null when the cell is empty or out of bounds. */
function letterAt(grid: (string | null)[][], row: number, col: number): string | null {
  if (!inBounds(row, col)) return null
  return grid[row][col]
}

/**
 * Standard crossword validity rules for a candidate placement: every
 * cell in bounds, crossing cells matching, other cells empty, no letter
 * directly before the start or after the end, and no perpendicular
 * neighbor touching a non-crossing cell (which would form an accidental
 * word or two-letter run).
 */
function isValidPlacement(
  grid: (string | null)[][],
  word: string,
  startRow: number,
  startCol: number,
  direction: Direction
): boolean {
  const rowStep = direction === 'down' ? 1 : 0
  const colStep = direction === 'down' ? 0 : 1
  for (let i = 0; i < word.length; i++) {
    const row = startRow + rowStep * i
    const col = startCol + colStep * i
    if (!inBounds(row, col)) return false
    const existing = grid[row][col]
    if (existing === null) {
      const perpBefore = direction === 'down' ? letterAt(grid, row, col - 1) : letterAt(grid, row - 1, col)
      const perpAfter = direction === 'down' ? letterAt(grid, row, col + 1) : letterAt(grid, row + 1, col)
      if (perpBefore !== null || perpAfter !== null) return false
    } else if (existing !== word[i]) {
      return false
    }
  }
  if (letterAt(grid, startRow - rowStep, startCol - colStep) !== null) return false
  const endRow = startRow + rowStep * word.length
  const endCol = startCol + colStep * word.length
  if (letterAt(grid, endRow, endCol) !== null) return false
  return true
}

/** Every perpendicular placement of `word` crossing a placed word at a shared letter. */
function buildCandidates(placed: PlacedWord[], word: string): Candidate[] {
  const candidates: Candidate[] = []
  for (const target of placed) {
    const targetDown = target.direction === 'down'
    const targetRowStep = targetDown ? 1 : 0
    const targetColStep = targetDown ? 0 : 1
    const direction: Direction = targetDown ? 'across' : 'down'
    const rowStep = direction === 'down' ? 1 : 0
    const colStep = direction === 'down' ? 0 : 1
    for (let j = 0; j < target.word.length; j++) {
      const crossRow = target.row + targetRowStep * j
      const crossCol = target.col + targetColStep * j
      for (let i = 0; i < word.length; i++) {
        if (word[i] !== target.word[j]) continue
        candidates.push({ row: crossRow - rowStep * i, col: crossCol - colStep * i, direction })
      }
    }
  }
  return candidates
}

/**
 * Fisher-Yates shuffle driven by the caller's random source, which must
 * return values in [0, 1).
 */
function shuffle<T>(items: T[], rand: () => number): void {
  for (let k = items.length - 1; k > 0; k--) {
    const j = Math.floor(rand() * (k + 1))
    const temp = items[k]
    items[k] = items[j]
    items[j] = temp
  }
}

function placeWord(
  working: (string | null)[][],
  placed: PlacedWord[],
  entry: { word: string; clue: string },
  direction: Direction,
  row: number,
  col: number
): void {
  const rowStep = direction === 'down' ? 1 : 0
  const colStep = direction === 'down' ? 0 : 1
  for (let i = 0; i < entry.word.length; i++) {
    working[row + rowStep * i][col + colStep * i] = entry.word[i]
  }
  placed.push({ word: entry.word, clue: entry.clue, direction, row, col })
}

function emptyResult(unplaced: string[]): CrosswordResult {
  return { rows: 0, cols: 0, grid: [], placements: [], unplaced }
}

/**
 * Standard crossword numbering: scan top to bottom, left to right; a
 * letter cell takes the next number when it starts an across word (left
 * neighbor empty or out of bounds, right neighbor a letter) or a down
 * word (upper neighbor empty or out of bounds, lower neighbor a letter).
 */
function computeNumbers(grid: (string | null)[][]): Map<string, number> {
  const numbers = new Map<string, number>()
  let nextNumber = 1
  const rows = grid.length
  const cols = grid[0].length
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === null) continue
      const leftEmpty = c === 0 || grid[r][c - 1] === null
      const startsAcross = leftEmpty && c + 1 < cols && grid[r][c + 1] !== null
      const aboveEmpty = r === 0 || grid[r - 1][c] === null
      const startsDown = aboveEmpty && r + 1 < rows && grid[r + 1][c] !== null
      if (startsAcross || startsDown) {
        numbers.set(`${r},${c}`, nextNumber)
        nextNumber += 1
      }
    }
  }
  return numbers
}

/**
 * Lay out spelling words as a crossword. `rand` supplies the randomness
 * for candidate ordering; pass a seeded function for reproducible
 * layouts. Words are uppercased; anything that cannot be placed is
 * listed in `unplaced`.
 */
export function generateCrossword(entries: CrosswordEntry[], rand: () => number): CrosswordResult {
  const unplaced: string[] = []
  const seen = new Set<string>()
  const valid: { word: string; clue: string }[] = []
  for (const entry of entries) {
    const word = entry.word.toUpperCase()
    if (word.length < 2 || word.length > MAX_CROSSWORD_SIZE || !LETTERS_ONLY.test(word)) {
      unplaced.push(word)
      continue
    }
    if (seen.has(word)) {
      unplaced.push(word)
      continue
    }
    seen.add(word)
    valid.push({ word, clue: entry.clue })
  }

  valid.sort((a, b) => b.word.length - a.word.length)
  if (valid.length === 0) return emptyResult(unplaced)

  const working: (string | null)[][] = []
  for (let r = 0; r < MAX_CROSSWORD_SIZE; r++) {
    working.push(new Array<string | null>(MAX_CROSSWORD_SIZE).fill(null))
  }

  const placed: PlacedWord[] = []
  const first = valid[0]
  const center = Math.floor(MAX_CROSSWORD_SIZE / 2)
  placeWord(working, placed, first, 'across', center, center - Math.floor(first.word.length / 2))

  for (let n = 1; n < valid.length; n++) {
    const entry = valid[n]
    const candidates = buildCandidates(placed, entry.word)
    shuffle(candidates, rand)
    const spot = candidates.find((c) => isValidPlacement(working, entry.word, c.row, c.col, c.direction))
    if (spot === undefined) {
      unplaced.push(entry.word)
    } else {
      placeWord(working, placed, entry, spot.direction, spot.row, spot.col)
    }
  }

  let minRow = MAX_CROSSWORD_SIZE
  let maxRow = -1
  let minCol = MAX_CROSSWORD_SIZE
  let maxCol = -1
  for (const p of placed) {
    const rowStep = p.direction === 'down' ? 1 : 0
    const colStep = p.direction === 'down' ? 0 : 1
    for (let i = 0; i < p.word.length; i++) {
      const row = p.row + rowStep * i
      const col = p.col + colStep * i
      if (row < minRow) minRow = row
      if (row > maxRow) maxRow = row
      if (col < minCol) minCol = col
      if (col > maxCol) maxCol = col
    }
  }

  const rows = maxRow - minRow + 1
  const cols = maxCol - minCol + 1
  const grid: (string | null)[][] = []
  for (let r = minRow; r <= maxRow; r++) {
    grid.push(working[r].slice(minCol, maxCol + 1))
  }

  const numbers = computeNumbers(grid)
  const placements: CrosswordPlacement[] = placed.map((p) => {
    const rowStep = p.direction === 'down' ? 1 : 0
    const colStep = p.direction === 'down' ? 0 : 1
    const cells: CrosswordCell[] = []
    for (let i = 0; i < p.word.length; i++) {
      cells.push({ row: p.row + rowStep * i - minRow, col: p.col + colStep * i - minCol })
    }
    const start = cells[0]
    return {
      word: p.word,
      clue: p.clue,
      number: numbers.get(`${start.row},${start.col}`) as number,
      direction: p.direction,
      cells,
    }
  })

  return { rows, cols, grid, placements, unplaced }
}
