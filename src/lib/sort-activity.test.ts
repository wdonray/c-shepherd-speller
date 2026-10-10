import { describe, it, expect } from 'vitest'
import { buildWordBank, checkPlacements } from './sort-activity'
import type { WordList } from '@/models/WordList'

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5',
  patterns: [
    { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake', 'bake'] },
    { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'common', words: ['rain', 'pain'] },
    { id: 'p3', sound: 'long a', pattern: 'odd', frequency: 'rare', words: ['said'], isOddDuck: true },
  ],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('buildWordBank', () => {
  it('collects words from all patterns including former pattern odd ducks', () => {
    const bank = buildWordBank(list)
    expect(bank).toHaveLength(5)
    const words = bank.map((b) => b.word).sort()
    expect(words).toEqual(['bake', 'cake', 'pain', 'rain', 'said'])
  })

  it('excludes word-level odd ducks from the bank', () => {
    const oddList: WordList = {
      ...list,
      patterns: [
        { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake', 'bake'], oddDucks: ['cake'] },
        { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'common', words: ['rain', 'pain'] },
      ],
    }
    const bank = buildWordBank(oddList)
    const words = bank.map((b) => b.word).sort()
    expect(words).toEqual(['bake', 'pain', 'rain'])
  })

  it('tags each word with its pattern id', () => {
    const bank = buildWordBank(list)
    const cake = bank.find((b) => b.word === 'cake')
    expect(cake?.patternId).toBe('p1')
    const rain = bank.find((b) => b.word === 'rain')
    expect(rain?.patternId).toBe('p2')
  })

  it('gives unique ids for duplicate words in different patterns', () => {
    const dupList: WordList = {
      ...list,
      patterns: [
        { id: 'p1', sound: 's', pattern: 'a', frequency: 'common', words: ['cat'] },
        { id: 'p2', sound: 's', pattern: 'b', frequency: 'common', words: ['cat'] },
      ],
    }
    const bank = buildWordBank(dupList)
    expect(bank).toHaveLength(2)
    expect(bank[0]!.id).not.toBe(bank[1]!.id)
  })

  it('returns an empty bank when there are no sortable words', () => {
    const empty: WordList = { ...list, patterns: [] }
    expect(buildWordBank(empty)).toEqual([])
    const onlyOdd: WordList = {
      ...list,
      patterns: [{ id: 'p3', sound: 'long a', pattern: 'odd', frequency: 'rare', words: ['said'], isOddDuck: true }],
    }
    expect(buildWordBank(onlyOdd)).toHaveLength(1)
  })

  it('shuffles the bank (order varies across runs)', () => {
    const orders = new Set<string>()
    for (let i = 0; i < 20; i++) {
      orders.add(
        buildWordBank(list)
          .map((b) => b.id)
          .join(',')
      )
    }
    // With 4! = 24 possible orders, 20 draws should almost never all match.
    expect(orders.size).toBeGreaterThan(1)
  })
})

describe('checkPlacements', () => {
  it('marks correct placements', () => {
    const bank = [
      { id: 'p1:cake', word: 'cake', patternId: 'p1' },
      { id: 'p2:rain', word: 'rain', patternId: 'p2' },
    ]
    const { results, correct, total } = checkPlacements(bank, { 'p1:cake': 'p1', 'p2:rain': 'p2' })
    expect(results).toEqual([
      { wordId: 'p1:cake', correct: true },
      { wordId: 'p2:rain', correct: true },
    ])
    expect(correct).toBe(2)
    expect(total).toBe(2)
  })

  it('marks incorrect placements', () => {
    const bank = [
      { id: 'p1:cake', word: 'cake', patternId: 'p1' },
      { id: 'p2:rain', word: 'rain', patternId: 'p2' },
    ]
    const { results, correct } = checkPlacements(bank, { 'p1:cake': 'p2', 'p2:rain': 'p2' })
    expect(results[0]!.correct).toBe(false)
    expect(results[1]!.correct).toBe(true)
    expect(correct).toBe(1)
  })

  it('counts unplaced words as incorrect', () => {
    const bank = [{ id: 'p1:cake', word: 'cake', patternId: 'p1' }]
    const { results, correct, total } = checkPlacements(bank, {})
    expect(results[0]!.correct).toBe(false)
    expect(correct).toBe(0)
    expect(total).toBe(1)
  })

  it('handles an empty bank', () => {
    const { results, correct, total } = checkPlacements([], {})
    expect(results).toEqual([])
    expect(correct).toBe(0)
    expect(total).toBe(0)
  })
})
