import { describe, expect, it } from 'vitest'
import {
  generateCrossword,
  MAX_CROSSWORD_SIZE,
  MIN_CROSSWORD_WORDS,
  type CrosswordEntry,
  type CrosswordResult,
} from './crossword'

/** Deterministic PRNG for tests; any fixed seed gives a repeatable shuffle order. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function entry(word: string, clue = `${word} clue`): CrosswordEntry {
  return { word, clue }
}

/** Structural invariants every valid crossword layout must satisfy. */
function checkInvariants(result: CrosswordResult): void {
  expect(result.grid.length).toBe(result.rows)
  for (const row of result.grid) {
    expect(row.length).toBe(result.cols)
  }
  const seenNumbers = new Set<string>()
  const covered = new Set<string>()
  for (const p of result.placements) {
    expect(p.cells.length).toBe(p.word.length)
    expect(p.number).toBeGreaterThan(0)
    // Standard numbering: an across and a down word may share a start cell
    // (e.g. 6-Across and 6-Down), so numbers are unique per direction only.
    const numberKey = `${p.direction}:${p.number}`
    expect(seenNumbers.has(numberKey)).toBe(false)
    seenNumbers.add(numberKey)
    for (let i = 0; i < p.cells.length; i++) {
      const cell = p.cells[i]
      expect(cell.row).toBeGreaterThanOrEqual(0)
      expect(cell.col).toBeGreaterThanOrEqual(0)
      expect(cell.row).toBeLessThan(result.rows)
      expect(cell.col).toBeLessThan(result.cols)
      expect(result.grid[cell.row][cell.col]).toBe(p.word[i])
      covered.add(`${cell.row},${cell.col}`)
      if (i > 0) {
        const prev = p.cells[i - 1]
        expect(cell.row - prev.row).toBe(p.direction === 'across' ? 0 : 1)
        expect(cell.col - prev.col).toBe(p.direction === 'across' ? 1 : 0)
      }
    }
    // The start cell begins an across word, a down word, or both.
    const start = p.cells[0]
    const leftEmpty = start.col === 0 || result.grid[start.row][start.col - 1] === null
    const rightLetter = start.col + 1 < result.cols && result.grid[start.row][start.col + 1] !== null
    const aboveEmpty = start.row === 0 || result.grid[start.row - 1][start.col] === null
    const belowLetter = start.row + 1 < result.rows && result.grid[start.row + 1][start.col] !== null
    expect((leftEmpty && rightLetter) || (aboveEmpty && belowLetter)).toBe(true)
  }
  // Distinct clue numbers are consecutive from 1.
  const distinctNumbers = new Set([...seenNumbers].map((key) => Number(key.split(':')[1])))
  expect([...distinctNumbers].sort((a, b) => a - b)).toEqual(
    Array.from({ length: distinctNumbers.size }, (_, i) => i + 1)
  )
  // Every letter cell belongs to at least one placement, so crossings agree.
  for (let r = 0; r < result.rows; r++) {
    for (let c = 0; c < result.cols; c++) {
      if (result.grid[r][c] !== null) {
        expect(covered.has(`${r},${c}`)).toBe(true)
      }
    }
  }
}

describe('generateCrossword', () => {
  it('returns an empty result for empty entries', () => {
    expect(generateCrossword([], () => 0)).toEqual({
      rows: 0,
      cols: 0,
      grid: [],
      placements: [],
      unplaced: [],
    })
  })

  it('returns an empty result when every entry is invalid', () => {
    const result = generateCrossword([entry('a'), entry('ab-c')], () => 0)
    expect(result.unplaced).toEqual(['A', 'AB-C'])
    expect(result.rows).toBe(0)
    expect(result.cols).toBe(0)
    expect(result.grid).toEqual([])
    expect(result.placements).toEqual([])
  })

  it('places a single word across, trimmed to its own bounding box', () => {
    const result = generateCrossword([entry('cat', 'feline')], () => 0)
    expect(result.rows).toBe(1)
    expect(result.cols).toBe(3)
    expect(result.grid).toEqual([['C', 'A', 'T']])
    expect(result.placements).toEqual([
      {
        word: 'CAT',
        clue: 'feline',
        number: 1,
        direction: 'across',
        cells: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
          { row: 0, col: 2 },
        ],
      },
    ])
    expect(result.unplaced).toEqual([])
    checkInvariants(result)
  })

  it('filters short, long, non-letter, and duplicate words into unplaced', () => {
    const tooLong = 'a'.repeat(MAX_CROSSWORD_SIZE + 1)
    const result = generateCrossword(
      [
        entry('a'),
        entry(tooLong),
        entry('hello-world'),
        entry('cat', 'cat clue'),
        entry('CAT', 'duplicate clue'),
        entry('car', 'car clue'),
      ],
      () => 0
    )
    expect(result.unplaced).toEqual(['A', tooLong.toUpperCase(), 'HELLO-WORLD', 'CAT'])
    // CAT is placed across first and CAR crosses it going down. With
    // () => 0 the two candidates reverse order, so CAR takes the A crossing.
    expect(result.rows).toBe(3)
    expect(result.cols).toBe(3)
    expect(result.grid).toEqual([
      [null, 'C', null],
      ['C', 'A', 'T'],
      [null, 'R', null],
    ])
    expect(result.placements).toEqual([
      {
        word: 'CAT',
        clue: 'cat clue',
        number: 2,
        direction: 'across',
        cells: [
          { row: 1, col: 0 },
          { row: 1, col: 1 },
          { row: 1, col: 2 },
        ],
      },
      {
        word: 'CAR',
        clue: 'car clue',
        number: 1,
        direction: 'down',
        cells: [
          { row: 0, col: 1 },
          { row: 1, col: 1 },
          { row: 2, col: 1 },
        ],
      },
    ])
    checkInvariants(result)
  })

  it('leaves a word unplaced when it shares no letters with placed words', () => {
    const result = generateCrossword([entry('cat'), entry('dog')], () => 0)
    expect(result.placements.map((p) => p.word)).toEqual(['CAT'])
    expect(result.unplaced).toEqual(['DOG'])
    checkInvariants(result)
  })

  it('rejects candidates that mismatch a letter or butt against a word end', () => {
    // CDEFG across, XBC down crossing its C. ZCY can only cross at that C.
    // The down candidate mismatches XBC's B, and the across candidate would
    // end against CDEFG's D. Both fail, so ZCY is unplaced either way.
    const result = generateCrossword([entry('cdefg'), entry('xbc'), entry('zcy')], () => 0)
    expect(result.placements.map((p) => [p.word, p.direction, p.number])).toEqual([
      ['CDEFG', 'across', 2],
      ['XBC', 'down', 1],
    ])
    expect(result.unplaced).toEqual(['ZCY'])
    checkInvariants(result)
  })

  it('rejects candidates that butt against a word start', () => {
    // ABCDEFG across, XG down crossing its G. ZG can only cross at that G.
    // The down candidate mismatches XG's X, and the across candidate would
    // start against ABCDEFG's F. Both fail, so ZG is unplaced either way.
    const result = generateCrossword([entry('abcdefg'), entry('xg'), entry('zg')], () => 0)
    expect(result.placements.map((p) => [p.word, p.direction, p.number])).toEqual([
      ['ABCDEFG', 'across', 2],
      ['XG', 'down', 1],
    ])
    expect(result.unplaced).toEqual(['ZG'])
    checkInvariants(result)
  })

  it('rejects candidates that touch a word on the far perpendicular side', () => {
    // ABCDE across, XZB down crossing its B. QAY's only crossing is A's.
    // Its first cell would sit next to XZB's Z on the far side.
    const result = generateCrossword([entry('abcde'), entry('xzb'), entry('qay')], () => 0)
    expect(result.placements.map((p) => [p.word, p.direction, p.number])).toEqual([
      ['ABCDE', 'across', 2],
      ['XZB', 'down', 1],
    ])
    expect(result.unplaced).toEqual(['QAY'])
    checkInvariants(result)
  })

  it('rejects candidates that touch a word on the near perpendicular side', () => {
    // QWERTY across, WX down crossing its W. AX's only crossing is WX's X.
    // Its first cell would sit next to QWERTY's Q on the near side.
    const result = generateCrossword([entry('qwerty'), entry('wx'), entry('ax')], () => 0)
    expect(result.placements.map((p) => [p.word, p.direction, p.number])).toEqual([
      ['QWERTY', 'across', 1],
      ['WX', 'down', 2],
    ])
    expect(result.unplaced).toEqual(['AX'])
    checkInvariants(result)
  })

  it('rejects candidates that run off the working grid', () => {
    // The 21-letter word can only cross the placed 21-letter word at
    // indices other than 10, so every down candidate hangs off the top or
    // bottom of the grid and the word is unplaced.
    const result = generateCrossword([entry('abcdefghijklmnopqrstu'), entry('abcdefghijzLMNOPQRSTU')], () => 0)
    expect(result.placements.map((p) => p.word)).toEqual(['ABCDEFGHIJKLMNOPQRSTU'])
    expect(result.unplaced).toEqual(['ABCDEFGHIJZLMNOPQRSTU'])
    checkInvariants(result)
  })

  it('places full-size words along the grid edges and numbers edge starts', () => {
    const across = 'abcdefghijklmnopqrstu'
    const down = 'xxxxxxxxxxuxxxxxxxxxx'
    const result = generateCrossword([entry(across), entry(down)], () => 0)
    expect(result.rows).toBe(MAX_CROSSWORD_SIZE)
    expect(result.cols).toBe(MAX_CROSSWORD_SIZE)
    expect(result.unplaced).toEqual([])
    const [first, second] = result.placements
    expect(first.word).toBe(across.toUpperCase())
    expect(first.direction).toBe('across')
    expect(first.number).toBe(2)
    expect(first.cells).toHaveLength(MAX_CROSSWORD_SIZE)
    expect(second.word).toBe(down.toUpperCase())
    expect(second.direction).toBe('down')
    expect(second.number).toBe(1)
    expect(second.cells).toHaveLength(MAX_CROSSWORD_SIZE)
    // The down word starts at the top edge, so it takes number 1.
    expect(second.cells[0]).toEqual({ row: 0, col: MAX_CROSSWORD_SIZE - 1 })
    checkInvariants(result)
  })

  it('checks perpendicular neighbors at the left grid edge', () => {
    // ZA crosses the full-size across word at its first letter. The new
    // cell at column 0 forces an out-of-bounds perpendicular lookup.
    const result = generateCrossword([entry('abcdefghijklmnopqrstu'), entry('za')], () => 0)
    expect(result.rows).toBe(2)
    expect(result.cols).toBe(MAX_CROSSWORD_SIZE)
    expect(result.unplaced).toEqual([])
    expect(result.placements.map((p) => [p.word, p.direction, p.number])).toEqual([
      ['ABCDEFGHIJKLMNOPQRSTU', 'across', 2],
      ['ZA', 'down', 1],
    ])
    expect(result.placements[1].cells).toEqual([
      { row: 0, col: 0 },
      { row: 1, col: 0 },
    ])
    checkInvariants(result)
  })

  it('places the longest word first', () => {
    const result = generateCrossword([entry('ant'), entry('elephant'), entry('cat')], () => 0)
    expect(result.placements[0].word).toBe('ELEPHANT')
    expect(result.placements[0].direction).toBe('across')
    checkInvariants(result)
  })

  it('produces identical layouts for the same seed', () => {
    const entries = [entry('cat'), entry('car'), entry('art'), entry('rat')]
    const first = generateCrossword(entries, mulberry32(99))
    const second = generateCrossword(entries, mulberry32(99))
    expect(first).toEqual(second)
    checkInvariants(first)
  })

  it('produces valid layouts for different seeds', () => {
    const entries = ['planet', 'earth', 'mars', 'venus', 'mercury', 'saturn'].map((word, i) => entry(word, `clue ${i}`))
    for (const seed of [1, 2, 3, 4, 5]) {
      const result = generateCrossword(entries, mulberry32(seed))
      expect(result.placements.length).toBeGreaterThan(0)
      checkInvariants(result)
    }
  })

  it('places at least 8 words when the list has 8 or more placeable words', () => {
    const words = [
      'planet',
      'earth',
      'mars',
      'venus',
      'mercury',
      'saturn',
      'jupiter',
      'neptune',
      'comet',
      'moon',
      'star',
      'orbit',
    ]
    for (const seed of [7, 13, 42]) {
      const result = generateCrossword(
        words.map((word) => entry(word)),
        mulberry32(seed)
      )
      expect(result.placements.length).toBeGreaterThanOrEqual(MIN_CROSSWORD_WORDS)
      expect(result.placements.length + result.unplaced.length).toBe(words.length)
      checkInvariants(result)
    }
  })

  it('uses every valid word when the list has fewer than 8', () => {
    const words = ['cake', 'bake', 'rain', 'train', 'late']
    const result = generateCrossword(
      words.map((word) => entry(word)),
      mulberry32(7)
    )
    expect(result.placements.length).toBe(words.length)
    expect(result.unplaced).toEqual([])
    checkInvariants(result)
  })

  it('keeps the invalid words unplaced even when retries run', () => {
    const entries = [
      ...['planet', 'earth', 'mars', 'venus', 'mercury', 'saturn', 'jupiter', 'neptune', 'comet', 'moon'].map((word) =>
        entry(word)
      ),
      entry('a'), // Too short: can never be placed.
    ]
    const result = generateCrossword(entries, mulberry32(13))
    expect(result.placements.length).toBeGreaterThanOrEqual(MIN_CROSSWORD_WORDS)
    expect(result.unplaced).toContain('A')
    checkInvariants(result)
  })

  it('retries stay deterministic for the same seed', () => {
    const words = ['planet', 'earth', 'mars', 'venus', 'mercury', 'saturn', 'jupiter', 'neptune', 'comet', 'moon']
    const first = generateCrossword(
      words.map((word) => entry(word)),
      mulberry32(99)
    )
    const second = generateCrossword(
      words.map((word) => entry(word)),
      mulberry32(99)
    )
    expect(first).toEqual(second)
    checkInvariants(first)
  })
})
