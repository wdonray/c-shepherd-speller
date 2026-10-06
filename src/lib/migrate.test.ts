import { describe, it, expect } from 'vitest'
import { migrateFlatToPatternList } from './migrate'

describe('migrateFlatToPatternList', () => {
  it('converts spelling patterns to pattern objects', () => {
    const result = migrateFlatToPatternList({ words: [], sounds: [], spelling: ['a_e', 'ai'] }, 'u1')
    expect(result.patterns).toHaveLength(2)
    expect(result.patterns[0]).toMatchObject({ pattern: 'a_e', sound: 'a_e' })
    expect(result.patterns[1]).toMatchObject({ pattern: 'ai', sound: 'ai' })
  })

  it('matches sounds to patterns when they align', () => {
    const result = migrateFlatToPatternList({ words: [], sounds: ['long a'], spelling: ['long a'] }, 'u1')
    expect(result.patterns[0].sound).toBe('long a')
  })

  it('puts old words into an unsorted pattern', () => {
    const result = migrateFlatToPatternList({ words: ['cat', 'dog'], sounds: [], spelling: [] }, 'u1')
    expect(result.patterns).toHaveLength(1)
    expect(result.patterns[0].pattern).toBe('unsorted')
    expect(result.patterns[0].words).toEqual(['cat', 'dog'])
  })

  it('creates an empty list when there is no data', () => {
    const result = migrateFlatToPatternList({ words: [], sounds: [], spelling: [] }, 'u1')
    expect(result.patterns).toHaveLength(0)
    expect(result.name).toBe('Migrated list')
  })

  it('uses a custom list name', () => {
    const result = migrateFlatToPatternList({ words: [], sounds: [], spelling: [] }, 'u1', 'My old words')
    expect(result.name).toBe('My old words')
  })

  it('preserves the userId', () => {
    const result = migrateFlatToPatternList({ words: [], sounds: [], spelling: [] }, 'u123')
    expect(result.userId).toBe('u123')
  })
})
