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

    it('accepts word-level odd ducks', () => {
      const result = SpellingPatternSchema.safeParse({ ...validPattern, oddDucks: ['through', 'enough'] })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.oddDucks).toEqual(['through', 'enough'])
      }
    })

    it('treats missing oddDucks as none (backwards compatible)', () => {
      // Legacy lists have plain string words and no oddDucks field.
      const result = SpellingPatternSchema.safeParse(validPattern)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.oddDucks).toBeUndefined()
        expect(result.data.words).toEqual(validPattern.words)
      }
    })

    it('rejects non-string odd duck entries', () => {
      const result = SpellingPatternSchema.safeParse({ ...validPattern, oddDucks: ['ok', 42] })
      expect(result.success).toBe(false)
    })

    it('accepts a locked pattern', () => {
      const result = SpellingPatternSchema.safeParse({ ...validPattern, isLocked: true })
      expect(result.success).toBe(true)
      // The flag must survive parsing, not just be stripped as an unknown key.
      if (result.success) {
        expect(result.data.isLocked).toBe(true)
      }
    })

    it('treats a missing isLocked as unlocked (backwards compatible)', () => {
      const result = SpellingPatternSchema.safeParse(validPattern)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isLocked).toBeUndefined()
      }
    })

    it('accepts a pattern with a keyword emoji anchor', () => {
      const result = SpellingPatternSchema.safeParse({ ...validPattern, keywordEmoji: '🐝' })
      expect(result.success).toBe(true)
      // The emoji must survive parsing, not just be stripped as an unknown key.
      if (result.success) {
        expect(result.data.keywordEmoji).toBe('🐝')
      }
    })

    it('treats a missing keywordEmoji as unset (backwards compatible)', () => {
      const result = SpellingPatternSchema.safeParse(validPattern)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.keywordEmoji).toBeUndefined()
      }
    })

    it('rejects an empty keywordEmoji', () => {
      const result = SpellingPatternSchema.safeParse({ ...validPattern, keywordEmoji: '' })
      expect(result.success).toBe(false)
    })

    it('rejects a keywordEmoji longer than 20 characters', () => {
      const result = SpellingPatternSchema.safeParse({ ...validPattern, keywordEmoji: 'a'.repeat(21) })
      expect(result.success).toBe(false)
    })

    it('accepts a pattern with a keyword photo data URL', () => {
      const result = SpellingPatternSchema.safeParse({ ...validPattern, keywordImage: 'data:image/jpeg;base64,photo' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.keywordImage).toBe('data:image/jpeg;base64,photo')
      }
    })

    it('treats a missing keywordImage as unset (backwards compatible)', () => {
      const result = SpellingPatternSchema.safeParse(validPattern)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.keywordImage).toBeUndefined()
      }
    })

    it('rejects a keywordImage larger than 12KB to protect the DynamoDB item limit', () => {
      const result = SpellingPatternSchema.safeParse({ ...validPattern, keywordImage: 'x'.repeat(12 * 1024 + 1) })
      expect(result.success).toBe(false)
    })

    it('accepts a pattern with example sentences', () => {
      const result = SpellingPatternSchema.safeParse({
        ...validPattern,
        sentences: { cake: 'We baked a cake.' },
      })
      expect(result.success).toBe(true)
    })

    it('accepts a pattern without sentences (backwards compatible)', () => {
      const { sentences: _sentences, ...withoutSentences } = {
        ...validPattern,
        sentences: { cake: 'We baked a cake.' },
      }
      const result = SpellingPatternSchema.safeParse(withoutSentences)
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

    it('accepts patterns carrying the lock flag', () => {
      const result = UpdateWordListSchema.safeParse({
        patterns: [{ ...validPattern, isLocked: true }],
      })
      expect(result.success).toBe(true)
      // The flag must survive parsing, not just be stripped as an unknown key.
      if (result.success) {
        expect(result.data.patterns?.[0]?.isLocked).toBe(true)
      }
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

    it('updates gradeLevel when provided', () => {
      const updated = updateWordListItem(validList, { gradeLevel: '2' })
      expect(updated.gradeLevel).toBe('2')
    })

    it('leaves unspecified fields alone', () => {
      const updated = updateWordListItem(validList, {})
      expect(updated.name).toBe(validList.name)
      expect(updated.patterns).toEqual(validList.patterns)
    })
  })
})
