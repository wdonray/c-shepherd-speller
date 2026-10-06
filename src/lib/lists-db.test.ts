import { describe, it, expect, vi, beforeEach } from 'vitest'

const { send } = vi.hoisted(() => ({ send: vi.fn() }))

vi.mock('@/lib/dynamodb', () => ({
  default: { send },
  docClient: { send },
  client: {},
}))

import { createList, getListById, getListsByUser, updateList, deleteList } from './lists-db'
import type { WordList } from '../models/WordList'

const storedList: WordList & { PK: string; SK: string } = {
  PK: 'USER#u1',
  SK: 'LIST#l1',
  id: 'l1',
  userId: 'u1',
  name: 'Week 5',
  patterns: [],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('lists-db', () => {
  beforeEach(() => {
    send.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('createList', () => {
    it('puts a new list item and returns it', async () => {
      send.mockResolvedValue({})
      const list = await createList('u1', { name: 'Week 5', patterns: [] })

      expect(list.userId).toBe('u1')
      expect(list.name).toBe('Week 5')
      expect(list.id.startsWith('list_')).toBe(true)
      expect(send).toHaveBeenCalledTimes(1)
      const command = send.mock.calls[0][0]
      expect(command.input.TableName).toBe('shepherd-speller-lists')
      expect(command.input.Item.PK).toBe(`USER#u1`)
      expect(command.input.Item.SK).toBe(`LIST#${list.id}`)
      expect(command.input.ConditionExpression).toBe('attribute_not_exists(PK)')
    })
  })

  describe('getListById', () => {
    it('returns the list without key attributes', async () => {
      send.mockResolvedValue({ Item: storedList })
      const list = await getListById('u1', 'l1')

      expect(list).toBeDefined()
      expect(list!.id).toBe('l1')
      expect(list!.name).toBe('Week 5')
      expect('PK' in (list as object)).toBe(false)
      expect('SK' in (list as object)).toBe(false)
    })

    it('returns undefined when the list does not exist', async () => {
      send.mockResolvedValue({})
      expect(await getListById('u1', 'missing')).toBeUndefined()
    })
  })

  describe('getListsByUser', () => {
    it('queries by user and sorts most-recent first', async () => {
      const older = { ...storedList, id: 'l0', SK: 'LIST#l0', updatedAt: '2026-10-05T00:00:00.000Z' }
      send.mockResolvedValue({ Items: [older, storedList] })

      const lists = await getListsByUser('u1')

      expect(lists).toHaveLength(2)
      expect(lists[0].id).toBe('l1') // newer first
      expect(lists[1].id).toBe('l0')
      const command = send.mock.calls[0][0]
      expect(command.input.ExpressionAttributeValues[':pk']).toBe('USER#u1')
    })

    it('returns an empty array when the user has no lists', async () => {
      send.mockResolvedValue({ Items: [] })
      expect(await getListsByUser('u1')).toEqual([])
    })

    it('sorts ties by keeping stable order', async () => {
      const same = '2026-10-06T00:00:00.000Z'
      const newer = '2026-10-07T00:00:00.000Z'
      const a = { ...storedList, id: 'la', SK: 'LIST#la', updatedAt: same }
      const b = { ...storedList, id: 'lb', SK: 'LIST#lb', updatedAt: newer }
      const c = { ...storedList, id: 'lc', SK: 'LIST#lc', updatedAt: same }
      send.mockResolvedValue({ Items: [a, b, c] })

      const lists = await getListsByUser('u1')
      expect(lists).toHaveLength(3)
      expect(lists[0].id).toBe('lb') // newest first
    })

    it('handles a missing Items array', async () => {
      send.mockResolvedValue({})
      expect(await getListsByUser('u1')).toEqual([])
    })
  })

  describe('updateList', () => {
    it('updates and returns the list', async () => {
      send.mockResolvedValueOnce({ Item: storedList }) // getListById
      send.mockResolvedValueOnce({}) // PutCommand

      const updated = await updateList('u1', 'l1', { name: 'Renamed' })

      expect(updated.name).toBe('Renamed')
      expect(updated.id).toBe('l1')
      expect(send).toHaveBeenCalledTimes(2)
    })

    it('throws when the list does not exist', async () => {
      send.mockResolvedValue({}) // getListById returns nothing
      await expect(updateList('u1', 'missing', { name: 'x' })).rejects.toThrow('List not found')
    })
  })

  describe('deleteList', () => {
    it('deletes by key', async () => {
      send.mockResolvedValue({})
      await deleteList('u1', 'l1')

      expect(send).toHaveBeenCalledTimes(1)
      const command = send.mock.calls[0][0]
      expect(command.input.Key).toEqual({ PK: 'USER#u1', SK: 'LIST#l1' })
    })
  })
})
