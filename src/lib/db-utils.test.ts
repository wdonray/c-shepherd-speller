import { describe, it, expect, vi, beforeEach } from 'vitest'

const { send } = vi.hoisted(() => ({ send: vi.fn() }))

vi.mock('@/lib/dynamodb', () => ({
  default: { send },
  docClient: { send },
  client: {},
}))

import {
  createUser,
  updateUser,
  getUserByEmail,
  getUserById,
  getUserSpellingData,
  updateUserSpellingData,
  updateUserLastActive,
} from './db-utils'

const storedUser = {
  id: 'abc-user',
  PK: 'abc-user',
  SK: 'abc-profile',
  email: 'teacher@example.com',
  name: 'Teacher',
  words: ['cat'],
  sounds: ['sh'],
  spelling: ['tion'],
  lastActive: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('db-utils', () => {
  beforeEach(() => {
    send.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('createUser', () => {
    it('puts a new user item with generated keys', async () => {
      send.mockResolvedValue({})
      const user = await createUser({
        email: 'teacher@example.com',
        name: 'Teacher',
        words: [],
        sounds: [],
        spelling: [],
      })
      expect(send).toHaveBeenCalledOnce()
      const command = send.mock.calls[0][0]
      expect(command.input.TableName).toBe('c-shepherd-users')
      expect(command.input.Item.PK).toBe(command.input.Item.SK.replace('-profile', '-user'))
      expect(command.input.Item.email).toBe('teacher@example.com')
      expect(user.id).toBe(command.input.Item.id)
      expect(user.createdAt).toBeTruthy()
    })
  })

  describe('updateUser', () => {
    it('throws when the user does not exist', async () => {
      send.mockResolvedValue({ Item: undefined })
      await expect(updateUser('nope-user', { name: 'X' })).rejects.toThrow('User not found')
    })

    it('puts the merged user', async () => {
      send.mockResolvedValueOnce({ Item: storedUser }).mockResolvedValueOnce({})
      const updated = await updateUser('abc-user', { name: 'New Name' })
      expect(updated.name).toBe('New Name')
      expect(updated.email).toBe('teacher@example.com')
      const putCommand = send.mock.calls[1][0]
      expect(putCommand.input.Item.name).toBe('New Name')
    })
  })

  describe('getUserByEmail', () => {
    it('returns the first matching item', async () => {
      send.mockResolvedValue({ Items: [storedUser] })
      await expect(getUserByEmail('teacher@example.com')).resolves.toEqual(storedUser)
      const command = send.mock.calls[0][0]
      expect(command.input.IndexName).toBe('EmailIndex')
      expect(command.input.ExpressionAttributeValues[':email']).toBe('teacher@example.com')
    })

    it('lowercases the email', async () => {
      send.mockResolvedValue({ Items: [] })
      await getUserByEmail('TEACHER@EXAMPLE.COM')
      expect(send.mock.calls[0][0].input.ExpressionAttributeValues[':email']).toBe('teacher@example.com')
    })

    it('returns undefined when nothing matches', async () => {
      send.mockResolvedValue({ Items: [] })
      await expect(getUserByEmail('nobody@example.com')).resolves.toBeUndefined()
    })

    it('returns undefined and logs when the query fails', async () => {
      send.mockRejectedValue(new Error('boom'))
      await expect(getUserByEmail('teacher@example.com')).resolves.toBeUndefined()
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('getUserById', () => {
    it('returns the item', async () => {
      send.mockResolvedValue({ Item: storedUser })
      await expect(getUserById('abc-user')).resolves.toEqual(storedUser)
      const command = send.mock.calls[0][0]
      expect(command.input.Key).toEqual({ PK: 'abc-user', SK: 'abc-profile' })
    })

    it('returns undefined and logs when the get fails', async () => {
      send.mockRejectedValue(new Error('boom'))
      await expect(getUserById('abc-user')).resolves.toBeUndefined()
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('getUserSpellingData', () => {
    it('returns the spelling lists', async () => {
      send.mockResolvedValue({ Item: storedUser })
      await expect(getUserSpellingData('abc-user')).resolves.toEqual({
        words: ['cat'],
        sounds: ['sh'],
        spelling: ['tion'],
      })
    })

    it('returns null when the user does not exist', async () => {
      send.mockResolvedValue({ Item: undefined })
      await expect(getUserSpellingData('nope-user')).resolves.toBeNull()
    })

    it('defaults missing lists to empty arrays', async () => {
      send.mockResolvedValue({ Item: { ...storedUser, words: undefined, sounds: null } })
      await expect(getUserSpellingData('abc-user')).resolves.toEqual({
        words: [],
        sounds: [],
        spelling: ['tion'],
      })
    })

    it('defaults a missing spelling list to an empty array', async () => {
      send.mockResolvedValue({ Item: { ...storedUser, spelling: undefined } })
      await expect(getUserSpellingData('abc-user')).resolves.toEqual({
        words: ['cat'],
        sounds: ['sh'],
        spelling: [],
      })
    })
  })

  describe('updateUserSpellingData', () => {
    it('throws when the user does not exist', async () => {
      send.mockResolvedValue({ Item: undefined })
      await expect(updateUserSpellingData('nope-user', { words: ['x'] })).rejects.toThrow('User not found')
    })

    it('builds an update expression for the provided fields', async () => {
      send
        .mockResolvedValueOnce({ Item: storedUser })
        .mockResolvedValueOnce({ Attributes: { ...storedUser, words: ['cat', 'dog'] } })
      const result = await updateUserSpellingData('abc-user', { words: ['cat', 'dog'] })
      expect(result.words).toEqual(['cat', 'dog'])
      const command = send.mock.calls[1][0]
      expect(command.input.UpdateExpression).toContain('#words = :words')
      expect(command.input.UpdateExpression).toContain('#updatedAt = :updatedAt')
      expect(command.input.ExpressionAttributeNames['#words']).toBe('words')
    })

    it('only updates provided fields', async () => {
      send.mockResolvedValueOnce({ Item: storedUser }).mockResolvedValueOnce({ Attributes: storedUser })
      await updateUserSpellingData('abc-user', { sounds: ['ch'] })
      const command = send.mock.calls[1][0]
      expect(command.input.UpdateExpression).not.toContain('#words')
      expect(command.input.UpdateExpression).toContain('#sounds = :sounds')
    })

    it('updates the spelling field when provided', async () => {
      send.mockResolvedValueOnce({ Item: storedUser }).mockResolvedValueOnce({ Attributes: storedUser })
      await updateUserSpellingData('abc-user', { spelling: ['ight'] })
      const command = send.mock.calls[1][0]
      expect(command.input.UpdateExpression).toContain('#spelling = :spelling')
      expect(command.input.ExpressionAttributeValues[':spelling']).toEqual(['ight'])
    })

    it('logs and rethrows when the update fails', async () => {
      send.mockResolvedValueOnce({ Item: storedUser }).mockRejectedValueOnce(new Error('boom'))
      await expect(updateUserSpellingData('abc-user', { words: ['x'] })).rejects.toThrow('boom')
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('updateUserLastActive', () => {
    it('throws when the user does not exist', async () => {
      send.mockResolvedValue({ Item: undefined })
      await expect(updateUserLastActive('nope-user')).rejects.toThrow('User not found')
    })

    it('updates the lastActive timestamp', async () => {
      send
        .mockResolvedValueOnce({ Item: storedUser })
        .mockResolvedValueOnce({ Attributes: { ...storedUser, lastActive: '2026-06-01T00:00:00.000Z' } })
      const result = await updateUserLastActive('abc-user')
      expect(result.lastActive).toBe('2026-06-01T00:00:00.000Z')
      const command = send.mock.calls[1][0]
      expect(command.input.UpdateExpression).toBe('SET lastActive = :lastActive')
    })

    it('logs and rethrows when the update fails', async () => {
      send.mockResolvedValueOnce({ Item: storedUser }).mockRejectedValueOnce(new Error('boom'))
      await expect(updateUserLastActive('abc-user')).rejects.toThrow('boom')
      expect(console.error).toHaveBeenCalled()
    })
  })
})
