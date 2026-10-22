import { describe, expect, it } from 'vitest'
import {
  generateWordSearch,
  gradeBandForGradeLevel,
  type WordSearchDifficulty,
  type WordSearchPlacement,
  type WordSearchResult,
} from './word-search'
import { mulberry32 } from './worksheets'

/** Scripted rand that cycles through the given values, for deterministic layouts. */
function scriptedRand(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

/** Pick a rand value that lands on `index` when fed to Math.floor(rand() * count). */
function pickIndex(index: number, count: number): number {
  return (index + 0.5) / count
}

/** Assert the structural invariants of one placement: cells spell the word, in bounds. */
function expectValidPlacement(result: WordSearchResult, placement: WordSearchPlacement): void {
  const { word, cells } = placement
  expect(cells).toHaveLength(word.length)
  for (let i = 0; i < cells.length; i++) {
    const { row, col } = cells[i]
    expect(row).toBeGreaterThanOrEqual(0)
    expect(row).toBeLessThan(result.size)
    expect(col).toBeGreaterThanOrEqual(0)
    expect(col).toBeLessThan(result.size)
    expect(result.grid[row][col]).toBe(word[i])
  }
  if (cells.length > 1) {
    const dr = cells[1].row - cells[0].row
    const dc = cells[1].col - cells[0].col
    expect([dr, dc]).not.toEqual([0, 0])
    expect(Math.abs(dr)).toBeLessThanOrEqual(1)
    expect(Math.abs(dc)).toBeLessThanOrEqual(1)
    for (let i = 2; i < cells.length; i++) {
      expect(cells[i].row - cells[i - 1].row).toBe(dr)
      expect(cells[i].col - cells[i - 1].col).toBe(dc)
    }
  }
}

/** Assert the whole grid is filled with single uppercase letters. */
function expectFullGrid(result: WordSearchResult): void {
  expect(result.grid).toHaveLength(result.size)
  for (const row of result.grid) {
    expect(row).toHaveLength(result.size)
    for (const cell of row) {
      expect(cell).toMatch(/^[A-Z]$/)
    }
  }
}

describe('generateWordSearch', () => {
  it('places every word and fills the grid', () => {
    const result = generateWordSearch(['cake', 'bake', 'rain', 'play'], mulberry32(42))
    expect(result.size).toBe(10)
    expect(result.placements).toHaveLength(4)
    expect(result.unplaced).toEqual([])
    expect(result.placements.map((p) => p.word)).toEqual(['CAKE', 'BAKE', 'RAIN', 'PLAY'])
    for (const placement of result.placements) {
      expectValidPlacement(result, placement)
    }
    expectFullGrid(result)
  })

  it('is deterministic for the same seed', () => {
    const first = generateWordSearch(['cake', 'rain', 'play'], mulberry32(7))
    const second = generateWordSearch(['cake', 'rain', 'play'], mulberry32(7))
    expect(first).toEqual(second)
  })

  it('varies the layout for a different seed', () => {
    const first = generateWordSearch(['cake', 'rain', 'play'], mulberry32(7))
    const second = generateWordSearch(['cake', 'rain', 'play'], mulberry32(8))
    expect(first).not.toEqual(second)
  })

  it('floors every band at 10x10 and records the difficulty', () => {
    for (const difficulty of ['beginner', 'intermediate', 'upper'] as const) {
      const result = generateWordSearch(['cat'], mulberry32(1), { difficulty })
      expect(result.size).toBe(10)
      expect(result.difficulty).toBe(difficulty)
    }
  })

  it('caps the grid per band: 10 beginner, 12 intermediate, 14 upper', () => {
    const word = 'characteristically' // 17 letters: longer than every cap
    expect(generateWordSearch([word], mulberry32(1), { difficulty: 'beginner' }).size).toBe(10)
    expect(generateWordSearch([word], mulberry32(1), { difficulty: 'intermediate' }).size).toBe(12)
    expect(generateWordSearch([word], mulberry32(1), { difficulty: 'upper' }).size).toBe(14)
    expect(generateWordSearch([word], mulberry32(1)).size).toBe(14) // default is upper
  })

  it('uppercases words and skips non A-Z words into unplaced', () => {
    const result = generateWordSearch(['Cake', 'co-op', 'c4ke', '', 'rain'], mulberry32(3))
    expect(result.placements.map((p) => p.word)).toEqual(['CAKE', 'RAIN'])
    expect(result.unplaced).toEqual(['co-op', 'c4ke', ''])
  })

  it('marks words longer than the grid as unplaced after exhausting attempts', () => {
    const long = 'pneumonoultramicroscopicsilicovolcanoconiosis'
    const result = generateWordSearch(['cake', long], mulberry32(9))
    expect(result.size).toBe(14)
    expect(result.placements.map((p) => p.word)).toEqual(['CAKE'])
    expect(result.unplaced).toEqual([long])
  })

  it('handles an empty word list', () => {
    const result = generateWordSearch([], mulberry32(1))
    expect(result.size).toBe(10)
    expect(result.placements).toEqual([])
    expect(result.unplaced).toEqual([])
    expectFullGrid(result)
  })

  it('rejects placements that run off any of the four edges', () => {
    // Default (upper) band: 14x14 grid. Direction order: (-1,-1)=0, (-1,0)=1,
    // (-1,1)=2, (0,-1)=3, (0,1)=4, (1,-1)=5, (1,0)=6, (1,1)=7.
    // A 21-letter word can never fit in a 14-wide grid; each scripted attempt
    // runs off a different edge.
    const word = 'A'.repeat(21)
    const rand = scriptedRand([
      pickIndex(4, 8),
      pickIndex(0, 14),
      pickIndex(0, 14), // (0,1) from col 0: runs off the right edge
      pickIndex(3, 8),
      pickIndex(0, 14),
      pickIndex(13, 14), // (0,-1) from col 13: runs off the left edge
      pickIndex(6, 8),
      pickIndex(13, 14),
      pickIndex(0, 14), // (1,0) from row 13: runs off the bottom edge
      pickIndex(1, 8),
      pickIndex(0, 14),
      pickIndex(0, 14), // (-1,0) from row 0: runs off the top edge
    ])
    const result = generateWordSearch([word], rand)
    expect(result.placements).toEqual([])
    expect(result.unplaced).toEqual([word])
  })

  it('rejects a placement that clashes with an existing letter', () => {
    // Both words always attempt (0,1) at row 5, col 5: CAT is written, then
    // CAR fails because its R clashes with the placed T.
    const rand = scriptedRand([pickIndex(4, 8), pickIndex(5, 10), pickIndex(5, 10)])
    const result = generateWordSearch(['CAT', 'CAR'], rand)
    expect(result.placements).toHaveLength(1)
    expectValidPlacement(result, result.placements[0])
    expect(result.placements[0].word).toBe('CAT')
    expect(result.unplaced).toEqual(['CAR'])
  })

  it('exercises all 8 directions across seeded runs', () => {
    const words = ['cake', 'bake', 'late', 'rain', 'train', 'play', 'day', 'see', 'tree', 'green']
    const seen = new Set<string>()
    for (let seed = 0; seed < 50; seed++) {
      const result = generateWordSearch(words, mulberry32(seed))
      for (const placement of result.placements) {
        expectValidPlacement(result, placement)
        const { cells } = placement
        if (cells.length > 1) {
          seen.add(`${cells[1].row - cells[0].row},${cells[1].col - cells[0].col}`)
        }
      }
    }
    expect(seen).toEqual(new Set(['-1,-1', '-1,0', '-1,1', '0,-1', '0,1', '1,-1', '1,0', '1,1']))
  })

  it('beginner band: fixed 10x10 grid, words too long land in unplaced', () => {
    const result = generateWordSearch(['characteristically'], mulberry32(1), { difficulty: 'beginner' })
    expect(result.size).toBe(10)
    expect(result.placements).toEqual([])
    expect(result.unplaced).toEqual(['characteristically'])
  })

  it('beginner band: never places words diagonally, only straight', () => {
    const words = ['cake', 'bake', 'late', 'rain', 'train', 'play', 'day', 'see', 'tree', 'green']
    const seen = new Set<string>()
    for (let seed = 0; seed < 50; seed++) {
      const result = generateWordSearch(words, mulberry32(seed), { difficulty: 'beginner' })
      for (const placement of result.placements) {
        expectValidPlacement(result, placement)
        const { cells } = placement
        if (cells.length > 1) {
          const dr = cells[1].row - cells[0].row
          const dc = cells[1].col - cells[0].col
          expect(dr === 0 || dc === 0).toBe(true)
          seen.add(`${dr},${dc}`)
        }
      }
    }
    expect(seen).toEqual(new Set(['-1,0', '0,-1', '0,1', '1,0']))
  })

  it('fills empty cells with pattern letters when patternSpellings are given', () => {
    const result = generateWordSearch(['cake'], mulberry32(42), { patternSpellings: 'a_e ai' })
    const covered = new Set(result.placements.flatMap((p) => p.cells.map((c) => `${c.row},${c.col}`)))
    for (let r = 0; r < result.size; r++) {
      for (let c = 0; c < result.size; c++) {
        if (!covered.has(`${r},${c}`)) {
          expect(['A', 'E', 'I']).toContain(result.grid[r][c])
        }
      }
    }
  })

  it('fills empty cells with a single pattern letter when only one is given', () => {
    const result = generateWordSearch(['cat'], mulberry32(1), { patternSpellings: 'zzz' })
    const covered = new Set(result.placements.flatMap((p) => p.cells.map((c) => `${c.row},${c.col}`)))
    for (let r = 0; r < result.size; r++) {
      for (let c = 0; c < result.size; c++) {
        if (!covered.has(`${r},${c}`)) {
          expect(result.grid[r][c]).toBe('Z')
        }
      }
    }
  })

  it('falls back to A-Z fillers when patterns contribute no letters', () => {
    const result = generateWordSearch(['cat'], mulberry32(1), { patternSpellings: '123 _' })
    expectFullGrid(result)
  })

  it('stays deterministic with options for the same seed', () => {
    const options = { difficulty: 'beginner' as const, patternSpellings: 'a_e' }
    expect(generateWordSearch(['cake', 'rain'], mulberry32(7), options)).toEqual(
      generateWordSearch(['cake', 'rain'], mulberry32(7), options)
    )
  })
})

describe('gradeBandForGradeLevel', () => {
  const cases: Array<[string | undefined, WordSearchDifficulty]> = [
    ['K', 'beginner'],
    ['k', 'beginner'],
    ['kindergarten', 'beginner'],
    ['Kindergarten', 'beginner'],
    ['1', 'beginner'],
    ['1st Grade', 'beginner'],
    ['2', 'intermediate'],
    ['3', 'intermediate'],
    ['3rd Grade', 'intermediate'],
    ['4', 'upper'],
    ['5th', 'upper'],
    ['12', 'upper'],
    [undefined, 'beginner'],
    ['', 'beginner'],
    ['abc', 'beginner'],
  ]
  for (const [gradeLevel, expected] of cases) {
    it(`maps ${JSON.stringify(gradeLevel)} to ${expected}`, () => {
      expect(gradeBandForGradeLevel(gradeLevel)).toBe(expected)
    })
  }
})
