import { describe, it, expect } from 'vitest'
import {
  WordListSchema,
  CreateWordListSchema,
  UpdateWordListSchema,
  SpellingPatternSchema,
  createWordListItem,
  updateWordListItem,
  generateListId,
  generatePatternId,
  getListKeys,
  type WordList,
} from './WordList'

const validPattern = {
  id: 'pat_1',
  sound: 'long a',
  pattern: 'a_e',
  frequency: 'common' as const,
  words: ['cake', 'bake'],
}

const validList: WordList = {
  id: 'list_1',
  userId: 'user_1',
  name: 'Week 5: Long A',
  patterns: [validPattern],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('WordList model', () => {
  describe('SpellingPatternSchema', () => {
    it('accepts a valid pattern', () => {
      expect(SpellingPatternSchema.safeParse(validPattern).success).toBe(true)
    })

    it('accepts an odd duck pattern', () => {
      const result = SpellingPatternSchema.safeParse({ ...validPattern, isOddDuck: true })
      expect(result.success).toBe(true)
    })

    it('rejects an invalid frequency', () => {
      const result = SpellingPatternSchema.safeParse({ ...validPattern, frequency: 'sometimes' })
      expect(result.success).toBe(false)
    })

    it('rejects an empty pattern string', () => {
      const result = SpellingPatternSchema.safeParse({ ...validPattern, pattern: '' })
      expect(result.success).toBe(false)
    })

    it('rejects too many words', () => {
      const words = Array.from({ length: 201 }, (_, i) => `word${i}`)
      const result = SpellingPatternSchema.safeParse({ ...validPattern, words })
      expect(result.success).toBe(false)
    })
  })

  describe('WordListSchema', () => {
    it('accepts a valid list', () => {
      expect(WordListSchema.safeParse(validList).success).toBe(true)
    })

    it('rejects a list without a name', () => {
      const result = WordListSchema.safeParse({ ...validList, name: '' })
      expect(result.success).toBe(false)
    })

    it('rejects too many patterns', () => {
      const patterns = Array.from({ length: 21 }, (_, i) => ({ ...validPattern, id: `p${i}` }))
      const result = WordListSchema.safeParse({ ...validList, patterns })
      expect(result.success).toBe(false)
    })
  })

  describe('CreateWordListSchema', () => {
    it('accepts a name-only payload', () => {
      const result = CreateWordListSchema.safeParse({ name: 'My List' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.patterns).toEqual([])
      }
    })

    it('accepts patterns without ids (server generates them)', () => {
      const { id, ...patternWithoutId } = validPattern
      const result = CreateWordListSchema.safeParse({
        name: 'My List',
        patterns: [patternWithoutId],
      })
      expect(result.success).toBe(true)
    })

    it('rejects a missing name', () => {
      expect(CreateWordListSchema.safeParse({}).success).toBe(false)
    })
  })

  describe('UpdateWordListSchema', () => {
    it('accepts an empty update', () => {
      expect(UpdateWordListSchema.safeParse({}).success).toBe(true)
    })

    it('accepts a partial update', () => {
      const result = UpdateWordListSchema.safeParse({ name: 'Renamed' })
      expect(result.success).toBe(true)
    })

    it('rejects an empty name', () => {
      expect(UpdateWordListSchema.safeParse({ name: '' }).success).toBe(false)
    })
  })

  describe('generateListId / generatePatternId', () => {
    it('generates unique IDs with the right prefix', () => {
      const a = generateListId()
      const b = generateListId()
      expect(a).not.toBe(b)
      expect(a.startsWith('list_')).toBe(true)

      const c = generatePatternId()
      const d = generatePatternId()
      expect(c).not.toBe(d)
      expect(c.startsWith('pat_')).toBe(true)
    })
  })

  describe('getListKeys', () => {
    it('builds namespaced DynamoDB keys', () => {
      expect(getListKeys('u1', 'l1')).toEqual({ PK: 'USER#u1', SK: 'LIST#l1' })
    })
  })

  describe('createWordListItem', () => {
    it('fills in server-generated fields', () => {
      const list = createWordListItem('u1', { name: 'Test', patterns: [] })
      expect(list.id.startsWith('list_')).toBe(true)
      expect(list.userId).toBe('u1')
      expect(list.name).toBe('Test')
      expect(list.patterns).toEqual([])
      expect(list.createdAt).toBeTruthy()
      expect(list.updatedAt).toBeTruthy()
    })

    it('generates IDs for patterns', () => {
      const { id, ...patternWithoutId } = validPattern
      const list = createWordListItem('u1', { name: 'Test', patterns: [patternWithoutId] })
      expect(list.patterns).toHaveLength(1)
      expect(list.patterns[0].id.startsWith('pat_')).toBe(true)
      expect(list.patterns[0].pattern).toBe('a_e')
    })

    it('preserves gradeLevel', () => {
      const list = createWordListItem('u1', { name: 'Test', gradeLevel: '1', patterns: [] })
      expect(list.gradeLevel).toBe('1')
    })
  })

  describe('updateWordListItem', () => {
    it('updates the name and refreshes updatedAt', () => {
      const updated = updateWordListItem(validList, { name: 'Renamed' })
      expect(updated.name).toBe('Renamed')
      expect(updated.id).toBe(validList.id)
      expect(updated.patterns).toEqual(validList.patterns)
    })

    it('updates patterns when provided', () => {
      const updated = updateWordListItem(validList, { patterns: [] })
      expect(updated.patterns).toEqual([])
    })

    it('leaves unspecified fields alone', () => {
      const updated = updateWordListItem(validList, {})
      expect(updated.name).toBe(validList.name)
      expect(updated.patterns).toEqual(validList.patterns)
    })
  })
})
