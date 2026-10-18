import { describe, expect, it } from 'vitest'
import { generateWordSearch, type WordSearchPlacement, type WordSearchResult } from './word-search'
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

  it('clamps the grid size between 10 and 20', () => {
    expect(generateWordSearch(['cat'], mulberry32(1)).size).toBe(10)
    expect(generateWordSearch(['characteristically'], mulberry32(1)).size).toBe(20)
    expect(generateWordSearch(['pneumonoultramicroscopicsilicovolcanoconiosis'], mulberry32(1)).size).toBe(20)
  })

  it('uppercases words and skips non A-Z words into unplaced', () => {
    const result = generateWordSearch(['Cake', 'co-op', 'c4ke', '', 'rain'], mulberry32(3))
    expect(result.placements.map((p) => p.word)).toEqual(['CAKE', 'RAIN'])
    expect(result.unplaced).toEqual(['co-op', 'c4ke', ''])
  })

  it('marks words longer than the grid as unplaced after exhausting attempts', () => {
    const long = 'pneumonoultramicroscopicsilicovolcanoconiosis'
    const result = generateWordSearch(['cake', long], mulberry32(9))
    expect(result.size).toBe(20)
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
    // Direction order: (-1,-1)=0, (-1,0)=1, (-1,1)=2, (0,-1)=3, (0,1)=4, (1,-1)=5, (1,0)=6, (1,1)=7.
    // A 21-letter word can never fit in a 20-wide grid; each scripted attempt
    // runs off a different edge.
    const word = 'A'.repeat(21)
    const rand = scriptedRand([
      pickIndex(4, 8),
      pickIndex(0, 20),
      pickIndex(0, 20), // (0,1) from col 0: runs off the right edge
      pickIndex(3, 8),
      pickIndex(0, 20),
      pickIndex(19, 20), // (0,-1) from col 19: runs off the left edge
      pickIndex(6, 8),
      pickIndex(19, 20),
      pickIndex(0, 20), // (1,0) from row 19: runs off the bottom edge
      pickIndex(1, 8),
      pickIndex(0, 20),
      pickIndex(0, 20), // (-1,0) from row 0: runs off the top edge
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
})
