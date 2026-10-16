import { describe, it, expect, vi, beforeEach } from 'vitest'

const { send } = vi.hoisted(() => ({ send: vi.fn() }))

vi.mock('@/lib/dynamodb', () => ({
  default: { send },
  docClient: { send },
  client: {},
}))

import {
  createClass,
  getClassById,
  getClassesByUser,
  updateClass,
  deleteClass,
  saveClassRules,
  deleteClassRule,
  resolveDefaultClassId,
  buildClassDeletionInfo,
  getClassDeletionInfo,
  getClassesWithDeletionInfo,
} from './classes-db'
import type { Class } from '../models/Class'

const storedClass = {
  PK: 'USER#u1',
  SK: 'CLASS#c1',
  id: 'c1',
  userId: 'u1',
  name: 'Period 2',
  rules: {},
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('classes-db', () => {
  beforeEach(() => {
    send.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('createClass', () => {
    it('puts a new class item with the CLASS# sort key and returns it', async () => {
      send.mockResolvedValue({})
      const cls = await createClass('u1', { name: 'Period 2' })

      expect(cls.userId).toBe('u1')
      expect(cls.name).toBe('Period 2')
      expect(cls.id.startsWith('class_')).toBe(true)
      expect(send).toHaveBeenCalledTimes(1)
      const command = send.mock.calls[0][0]
      expect(command.input.TableName).toBe('shepherd-speller-lists')
      expect(command.input.Item.SK).toBe(`CLASS#${cls.id}`)
      expect(command.input.Item.PK).toBe('USER#u1')
    })
  })

  describe('getClassById', () => {
    it('returns the class without the key attributes', async () => {
      send.mockResolvedValue({ Item: storedClass })
      const cls = (await getClassById('u1', 'c1')) as Record<string, unknown>

      expect(cls.id).toBe('c1')
      expect(cls.name).toBe('Period 2')
      expect(cls.PK).toBeUndefined()
      expect(cls.SK).toBeUndefined()
    })

    it('returns undefined when the class does not exist', async () => {
      send.mockResolvedValue({})
      expect(await getClassById('u1', 'missing')).toBeUndefined()
    })

    it('reads with strong consistency so a just-saved rule is never stale (issue #308)', async () => {
      send.mockResolvedValue({ Item: storedClass })
      await getClassById('u1', 'c1')

      const command = send.mock.calls[0][0]
      expect(command.input.ConsistentRead).toBe(true)
    })
  })

  describe('getClassesByUser', () => {
    it('queries the CLASS# prefix and sorts by updatedAt descending', async () => {
      const older = { ...storedClass, id: 'c1', updatedAt: '2026-10-05T00:00:00.000Z' }
      const newer = { ...storedClass, id: 'c2', SK: 'CLASS#c2', updatedAt: '2026-10-07T00:00:00.000Z' }
      send.mockResolvedValue({ Items: [older, newer] })

      const classes = await getClassesByUser('u1')

      expect(classes.map((c) => c.id)).toEqual(['c2', 'c1'])
      const command = send.mock.calls[0][0]
      expect(command.input.ExpressionAttributeValues[':prefix']).toBe('CLASS#')
    })

    it('returns an empty array when the user has no classes', async () => {
      send.mockResolvedValue({ Items: [] })
      expect(await getClassesByUser('u1')).toEqual([])
    })

    it('returns an empty array when the query returns no Items', async () => {
      send.mockResolvedValue({})
      expect(await getClassesByUser('u1')).toEqual([])
    })
  })

  describe('updateClass', () => {
    it('merges the update and puts the item', async () => {
      send.mockResolvedValueOnce({ Item: storedClass }).mockResolvedValueOnce({})
      const updated = await updateClass('u1', 'c1', { name: 'Period 3' })

      expect(updated.name).toBe('Period 3')
      expect(updated.id).toBe('c1')
      expect(send).toHaveBeenCalledTimes(2)
    })

    it('throws when the class does not exist', async () => {
      send.mockResolvedValue({})
      await expect(updateClass('u1', 'missing', { name: 'x' })).rejects.toThrow('Class not found')
    })
  })

  describe('deleteClass', () => {
    it('deletes by key', async () => {
      send.mockResolvedValue({})
      await deleteClass('u1', 'c1')

      const command = send.mock.calls[0][0]
      expect(command.input.Key).toEqual({ PK: 'USER#u1', SK: 'CLASS#c1' })
    })
  })

  describe('saveClassRules', () => {
    it('merges new rules into the existing rules and updates the item', async () => {
      const withRule = {
        ...storedClass,
        rules: { a_e: { rule: 'Magic e.' } },
      }
      send.mockResolvedValueOnce({ Item: withRule }).mockResolvedValueOnce({})

      const merged = await saveClassRules('u1', 'c1', {
        ai: { rule: 'ai never ends a word.' },
      })

      expect(merged).toEqual({
        a_e: { rule: 'Magic e.' },
        ai: { rule: 'ai never ends a word.' },
      })
      const command = send.mock.calls[1][0]
      expect(command.input.UpdateExpression).toContain('SET #rules = :rules')
      expect(command.input.ExpressionAttributeValues[':rules']).toEqual(merged)
    })

    it('throws when the class does not exist', async () => {
      send.mockResolvedValue({})
      await expect(saveClassRules('u1', 'missing', { ai: { rule: 'x' } })).rejects.toThrow('Class not found')
    })
  })

  describe('deleteClassRule', () => {
    it('removes the pattern rule atomically and returns the remaining rules', async () => {
      const remaining = { ai: { rule: 'ai never ends a word.' } }
      const withRules = {
        ...storedClass,
        rules: { a_e: { rule: 'Magic e.' }, ...remaining },
      }
      send.mockResolvedValueOnce({ Item: withRules }).mockResolvedValueOnce({ Attributes: { rules: remaining } })

      const result = await deleteClassRule('u1', 'c1', 'a_e')

      expect(result).toEqual(remaining)
      const command = send.mock.calls[1][0]
      expect(command.input.UpdateExpression).toContain('REMOVE #rules.#patternText')
      expect(command.input.ExpressionAttributeNames['#patternText']).toBe('a_e')
      expect(command.input.ReturnValues).toBe('UPDATED_NEW')
      expect(command.input.ExpressionAttributeValues[':now']).toBeDefined()
    })

    it('is a no-op when the pattern has no rule', async () => {
      const rules = { a_e: { rule: 'Magic e.' } }
      send.mockResolvedValueOnce({ Item: { ...storedClass, rules } }).mockResolvedValueOnce({ Attributes: { rules } })

      const remaining = await deleteClassRule('u1', 'c1', 'ai')
      expect(remaining).toEqual(rules)
    })

    it('treats a legacy class without a rules map as empty', async () => {
      const legacy = { ...storedClass }
      delete (legacy as Record<string, unknown>).rules
      send.mockResolvedValueOnce({ Item: legacy }).mockResolvedValueOnce({ Attributes: {} })

      const remaining = await deleteClassRule('u1', 'c1', 'a_e')
      expect(remaining).toEqual({})
    })

    it('throws when the class does not exist', async () => {
      send.mockResolvedValue({})
      await expect(deleteClassRule('u1', 'missing', 'a_e')).rejects.toThrow('Class not found')
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

  describe('buildClassDeletionInfo', () => {
    it('reports an empty classroom as deletable', () => {
      expect(buildClassDeletionInfo({ id: 'c1', rules: {} }, [])).toEqual({
        ruleCount: 0,
        assignedListCount: 0,
        studentCount: 0,
        canDelete: true,
      })
    })

    it('counts saved rules and tolerates legacy classes without a rules map', () => {
      const withRules = buildClassDeletionInfo({ id: 'c1', rules: { a_e: { rule: 'x' }, ai: { rule: 'y' } } }, [])
      expect(withRules.ruleCount).toBe(2)
      expect(withRules.canDelete).toBe(false)

      const legacy = buildClassDeletionInfo({ id: 'c1' }, [])
      expect(legacy.ruleCount).toBe(0)
      expect(legacy.canDelete).toBe(true)
    })

    it('counts only the lists assigned to this class', () => {
      const lists = [{ classId: 'c1' }, { classId: 'c2' }, {}]
      const info = buildClassDeletionInfo({ id: 'c1', rules: {} }, lists)
      expect(info.assignedListCount).toBe(1)
      expect(info.canDelete).toBe(false)
    })
  })

  describe('getClassDeletionInfo', () => {
    it('returns deletion info for an empty class', async () => {
      send.mockResolvedValueOnce({ Item: storedClass })
      send.mockResolvedValueOnce({ Items: [] })

      const info = await getClassDeletionInfo('u1', 'c1')
      expect(info).toEqual({ ruleCount: 0, assignedListCount: 0, studentCount: 0, canDelete: true })
    })

    it('counts saved rules and assigned lists', async () => {
      send.mockResolvedValueOnce({ Item: { ...storedClass, rules: { a_e: { rule: 'x' } } } })
      send.mockResolvedValueOnce({
        Items: [
          { id: 'l1', classId: 'c1' },
          { id: 'l2', classId: 'c9' },
        ],
      })

      const info = await getClassDeletionInfo('u1', 'c1')
      expect(info).toEqual({ ruleCount: 1, assignedListCount: 1, studentCount: 0, canDelete: false })
    })

    it('throws when the class does not exist', async () => {
      send.mockResolvedValueOnce({})
      await expect(getClassDeletionInfo('u1', 'c9')).rejects.toThrow('Class not found: c9')
    })
  })

  describe('getClassesWithDeletionInfo', () => {
    it('attaches deletion info to every class with a single lists query', async () => {
      const c1 = {
        ...storedClass,
        id: 'c1',
        SK: 'CLASS#c1',
        rules: { a_e: { rule: 'x' } },
        updatedAt: '2026-10-07T00:00:00.000Z',
      }
      const c2 = { ...storedClass, id: 'c2', SK: 'CLASS#c2', rules: {}, updatedAt: '2026-10-06T00:00:00.000Z' }
      send.mockResolvedValueOnce({ Items: [c1, c2] })
      send.mockResolvedValueOnce({ Items: [{ id: 'l1', classId: 'c2' }] })

      const classes = await getClassesWithDeletionInfo('u1')
      expect(classes).toHaveLength(2)
      expect(classes[0].id).toBe('c1')
      expect(classes[0].deletion).toEqual({ ruleCount: 1, assignedListCount: 0, studentCount: 0, canDelete: false })
      expect(classes[1].id).toBe('c2')
      expect(classes[1].deletion).toEqual({ ruleCount: 0, assignedListCount: 1, studentCount: 0, canDelete: false })
    })

    it('returns an empty array when the user has no classes', async () => {
      send.mockResolvedValueOnce({ Items: [] })
      send.mockResolvedValueOnce({ Items: [] })
      expect(await getClassesWithDeletionInfo('u1')).toEqual([])
    })
  })
})
