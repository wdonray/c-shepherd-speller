import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  ClassSchema,
  ClassRuleSchema,
  CreateClassSchema,
  UpdateClassSchema,
  SaveClassRulesSchema,
  CLASS_SK_PREFIX,
  getClassKeys,
  generateClassId,
  createClassItem,
  updateClassItem,
  resolveDefaultClassId,
} from './Class'

describe('Class model', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('ClassRuleSchema', () => {
    it('accepts a rule with optional extras', () => {
      const parsed = ClassRuleSchema.safeParse({
        rule: 'ai comes in the middle of a word, ay at the end.',
        teacherNote: 'ai/ay generalization',
        oddballs: ['said'],
      })
      expect(parsed.success).toBe(true)
    })

    it('rejects an empty rule and an overlong rule', () => {
      expect(ClassRuleSchema.safeParse({ rule: '' }).success).toBe(false)
      expect(ClassRuleSchema.safeParse({ rule: 'x'.repeat(301) }).success).toBe(false)
    })
  })

  describe('ClassSchema', () => {
    it('defaults rules to an empty map', () => {
      const parsed = ClassSchema.safeParse({
        id: 'class_1',
        userId: 'u1',
        name: 'Period 2',
        createdAt: '2026-10-13T00:00:00.000Z',
        updatedAt: '2026-10-13T00:00:00.000Z',
      })
      expect(parsed.success).toBe(true)
      if (parsed.success) expect(parsed.data.rules).toEqual({})
    })

    it('accepts rules keyed by pattern text', () => {
      const parsed = ClassSchema.safeParse({
        id: 'class_1',
        userId: 'u1',
        name: 'Period 2',
        rules: { a_e: { rule: 'When a word has a_e, the a says its name.' } },
        createdAt: '2026-10-13T00:00:00.000Z',
        updatedAt: '2026-10-13T00:00:00.000Z',
      })
      expect(parsed.success).toBe(true)
    })

    it('rejects a blank name', () => {
      const parsed = ClassSchema.safeParse({
        id: 'class_1',
        userId: 'u1',
        name: '',
        createdAt: '2026-10-13T00:00:00.000Z',
        updatedAt: '2026-10-13T00:00:00.000Z',
      })
      expect(parsed.success).toBe(false)
    })
  })

  describe('CreateClassSchema and UpdateClassSchema', () => {
    it('accepts a name on create', () => {
      expect(CreateClassSchema.safeParse({ name: 'Blue group' }).success).toBe(true)
      expect(CreateClassSchema.safeParse({}).success).toBe(false)
    })

    it('accepts partial updates', () => {
      expect(UpdateClassSchema.safeParse({}).success).toBe(true)
      expect(UpdateClassSchema.safeParse({ name: 'Red group' }).success).toBe(true)
      expect(UpdateClassSchema.safeParse({ rules: { ai: { rule: 'ai never ends a word.' } } }).success).toBe(true)
    })
  })

  describe('SaveClassRulesSchema', () => {
    it('accepts a pattern-text-to-rule map', () => {
      expect(SaveClassRulesSchema.safeParse({ rules: { a_e: { rule: 'Magic e.' } } }).success).toBe(true)
      expect(SaveClassRulesSchema.safeParse({}).success).toBe(false)
    })
  })

  describe('keys and ids', () => {
    it('builds DynamoDB keys with the CLASS# prefix', () => {
      expect(getClassKeys('u1', 'c1')).toEqual({ PK: 'USER#u1', SK: 'CLASS#c1' })
      expect(CLASS_SK_PREFIX).toBe('CLASS#')
    })

    it('generates unique class IDs', () => {
      const a = generateClassId()
      const b = generateClassId()
      expect(a.startsWith('class_')).toBe(true)
      expect(a).not.toBe(b)
    })
  })

  describe('createClassItem', () => {
    it('fills in server-generated fields and trims the name', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-10-13T12:00:00.000Z'))
      const cls = createClassItem('u1', { name: '  Period 2  ' })
      expect(cls.userId).toBe('u1')
      expect(cls.name).toBe('Period 2')
      expect(cls.id.startsWith('class_')).toBe(true)
      expect(cls.rules).toEqual({})
      expect(cls.createdAt).toBe('2026-10-13T12:00:00.000Z')
      expect(cls.updatedAt).toBe('2026-10-13T12:00:00.000Z')
    })
  })

  describe('updateClassItem', () => {
    it('applies name and rule updates and refreshes updatedAt', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-10-13T12:00:00.000Z'))
      const cls = createClassItem('u1', { name: 'Period 2' })
      vi.setSystemTime(new Date('2026-10-14T12:00:00.000Z'))
      const updated = updateClassItem(cls, {
        name: 'Period 3',
        rules: { ai: { rule: 'ai never ends a word.' } },
      })
      expect(updated.name).toBe('Period 3')
      expect(updated.rules).toEqual({ ai: { rule: 'ai never ends a word.' } })
      expect(updated.updatedAt).toBe('2026-10-14T12:00:00.000Z')
      expect(updated.createdAt).toBe(cls.createdAt)
    })

    it('leaves untouched fields alone on a partial update', () => {
      const cls = createClassItem('u1', { name: 'Period 2' })
      const updated = updateClassItem(cls, {})
      expect(updated.name).toBe('Period 2')
      expect(updated.rules).toEqual({})
    })
  })
})

describe('resolveDefaultClassId', () => {
  const oneClass = [{ id: 'c1' }]
  const twoClasses = [{ id: 'c1' }, { id: 'c2' }]

  it('prefers the explicitly set default', () => {
    expect(resolveDefaultClassId({ defaultClassId: 'c2' }, twoClasses)).toBe('c2')
  })

  it('auto-applies the single class when no default is set', () => {
    expect(resolveDefaultClassId({}, oneClass)).toBe('c1')
    expect(resolveDefaultClassId({ defaultClassId: null }, oneClass)).toBe('c1')
    expect(resolveDefaultClassId(null, oneClass)).toBe('c1')
    expect(resolveDefaultClassId(undefined, oneClass)).toBe('c1')
  })

  it('returns null with no classes', () => {
    expect(resolveDefaultClassId({}, [])).toBeNull()
    expect(resolveDefaultClassId({ defaultClassId: 'c9' }, [])).toBe('c9')
  })

  it('returns null with multiple classes and no explicit default', () => {
    expect(resolveDefaultClassId({}, twoClasses)).toBeNull()
  })
})
