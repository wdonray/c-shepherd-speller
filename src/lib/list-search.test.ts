import { describe, it, expect } from 'vitest'
import { getMatchSegments, searchLists } from './list-search'
import type { WordList } from '@/models/WordList'

function makeList(id: string, overrides: Partial<WordList> = {}): WordList {
  return {
    id,
    userId: 'u1',
    name: `List ${id}`,
    patterns: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('getMatchSegments', () => {
  it('marks a single match', () => {
    expect(getMatchSegments('Week 5: Long A', 'long')).toEqual([
      { text: 'Week 5: ', match: false },
      { text: 'Long', match: true },
      { text: ' A', match: false },
    ])
  })

  it('is case-insensitive', () => {
    expect(getMatchSegments('Week 5', 'WEEK')).toEqual([
      { text: 'Week', match: true },
      { text: ' 5', match: false },
    ])
  })

  it('marks multiple matches', () => {
    expect(getMatchSegments('a_b_a', 'a')).toEqual([
      { text: 'a', match: true },
      { text: '_b_', match: false },
      { text: 'a', match: true },
    ])
  })

  it('returns the whole text unmatched when the query is not found', () => {
    expect(getMatchSegments('Week 5', 'xyz')).toEqual([{ text: 'Week 5', match: false }])
  })

  it('returns the whole text unmatched for an empty query', () => {
    expect(getMatchSegments('Week 5', '  ')).toEqual([{ text: 'Week 5', match: false }])
  })

  it('handles a query matching the entire text', () => {
    expect(getMatchSegments('abc', 'abc')).toEqual([{ text: 'abc', match: true }])
  })
})

describe('searchLists', () => {
  const lists = [
    makeList('a', {
      name: 'Week 5: Long A',
      week: 'Week 5',
      gradeLevel: '1',
      patterns: [{ id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake', 'bake'] }],
    }),
    makeList('b', { name: 'Week 6: Long E' }),
  ]

  it('matches the list name', () => {
    expect(searchLists(lists, 'long a').map((l) => l.id)).toEqual(['a'])
  })

  it('matches the week', () => {
    expect(searchLists(lists, 'week 6').map((l) => l.id)).toEqual(['b'])
  })

  it('matches the grade level', () => {
    expect(searchLists(lists, 'grade 1').map((l) => l.id)).toEqual(['a'])
  })

  it('matches pattern spellings and words', () => {
    expect(searchLists(lists, 'a_e').map((l) => l.id)).toEqual(['a'])
    expect(searchLists(lists, 'cake').map((l) => l.id)).toEqual(['a'])
  })

  it('is case-insensitive', () => {
    expect(searchLists(lists, 'LONG A').map((l) => l.id)).toEqual(['a'])
  })

  it('returns everything for an empty query', () => {
    expect(searchLists(lists, '  ')).toBe(lists)
  })

  it('returns nothing when nothing matches', () => {
    expect(searchLists(lists, 'xyz')).toEqual([])
  })
})
