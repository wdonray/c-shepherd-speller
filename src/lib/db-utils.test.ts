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
  updateUserDefaultClassId,
  getUserByEmail,
  getUserById,
  getUserSpellingData,
  updateUserSpellingData,
  updateUserLastActive,
  getUserVideoLibrary,
  addVideoToUserLibrary,
  VIDEO_LIBRARY_MAX,
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

    it('lowercases the email before storing so getUserByEmail can find it', async () => {
      send.mockResolvedValue({})
      const user = await createUser({
        email: 'Teacher@Example.COM',
        name: 'Teacher',
        words: [],
        sounds: [],
        spelling: [],
      })
      const command = send.mock.calls[0][0]
      expect(command.input.Item.email).toBe('teacher@example.com')
      expect(user.email).toBe('teacher@example.com')
    })
  })

  describe('updateUser', () => {
    it('throws when the user does not exist', async () => {
      const notFound = new Error('Conditional check failed')
      notFound.name = 'ConditionalCheckFailedException'
      send.mockRejectedValue(notFound)
      await expect(updateUser('nope-user', { name: 'X' })).rejects.toThrow('User not found')
    })

    it('rethrows unexpected database errors', async () => {
      send.mockRejectedValue(new Error('boom'))
      await expect(updateUser('abc-user', { name: 'X' })).rejects.toThrow('boom')
    })

    it('skips undefined fields', async () => {
      send.mockResolvedValue({ Attributes: { ...storedUser, name: 'New Name' } })
      await updateUser('abc-user', { name: 'New Name', gradeLevel: undefined })
      const command = send.mock.calls[0][0]
      expect(command.input.UpdateExpression).not.toContain('gradeLevel')
    })

    it('writes only the provided fields and returns ALL_NEW', async () => {
      send.mockResolvedValue({ Attributes: { ...storedUser, name: 'New Name' } })
      const updated = await updateUser('abc-user', { name: 'New Name' })
      expect(updated.name).toBe('New Name')
      expect(send).toHaveBeenCalledTimes(1)
      const command = send.mock.calls[0][0]
      // Attribute names go through ExpressionAttributeNames ("name" is a
      // DynamoDB reserved word).
      expect(command.input.UpdateExpression).toContain('#field0 = :field0')
      expect(command.input.ExpressionAttributeNames['#field0']).toBe('name')
      expect(command.input.ExpressionAttributeValues[':field0']).toBe('New Name')
      expect(command.input.ReturnValues).toBe('ALL_NEW')
      expect(command.input.ConditionExpression).toBe('attribute_exists(PK)')
      // A field-scoped update never reads the item first.
      expect(command.input.UpdateExpression).not.toContain('email')
    })

    it('sets the default class id', async () => {
      send.mockResolvedValue({ Attributes: { ...storedUser, defaultClassId: 'class_1' } })
      const updated = await updateUser('abc-user', { defaultClassId: 'class_1' })
      expect(updated.defaultClassId).toBe('class_1')
      const command = send.mock.calls[0][0]
      expect(command.input.UpdateExpression).toContain('#field0 = :field0')
      expect(command.input.ExpressionAttributeNames['#field0']).toBe('defaultClassId')
      expect(command.input.ExpressionAttributeValues[':field0']).toBe('class_1')
    })

    it('drops the default class attribute when cleared with null', async () => {
      send.mockResolvedValue({ Attributes: { ...storedUser } })
      const updated = await updateUser('abc-user', { defaultClassId: null })
      expect('defaultClassId' in updated).toBe(false)
      const command = send.mock.calls[0][0]
      expect(command.input.UpdateExpression).toContain('REMOVE #field0')
      expect(command.input.ExpressionAttributeNames['#field0']).toBe('defaultClassId')
    })

    it('uses distinct aliases when a removed field precedes a set field', async () => {
      send.mockResolvedValue({ Attributes: { ...storedUser, name: 'X' } })
      await updateUser('abc-user', { defaultClassId: null, name: 'X' })
      const command = send.mock.calls[0][0]
      // The REMOVE and the SET must not share an alias.
      expect(command.input.UpdateExpression).toContain('REMOVE #field0')
      expect(command.input.UpdateExpression).toContain('#field1 = :field1')
      expect(command.input.ExpressionAttributeNames['#field0']).toBe('defaultClassId')
      expect(command.input.ExpressionAttributeNames['#field1']).toBe('name')
      expect(command.input.ExpressionAttributeValues[':field1']).toBe('X')
    })

    it('stores an empty image as-is instead of removing it', async () => {
      send.mockResolvedValue({ Attributes: { ...storedUser, image: '' } })
      await updateUser('abc-user', { image: '' })
      const command = send.mock.calls[0][0]
      expect(command.input.UpdateExpression).toContain('#field0 = :field0')
      expect(command.input.ExpressionAttributeNames['#field0']).toBe('image')
      expect(command.input.UpdateExpression).not.toContain('REMOVE')
    })
  })

  describe('updateUserDefaultClassId', () => {
    it('sets the default class id with a field-scoped update and returns the user', async () => {
      send.mockResolvedValue({ Attributes: { ...storedUser, defaultClassId: 'class_1' } })
      const updated = await updateUserDefaultClassId('abc-user', 'class_1')
      expect(updated.defaultClassId).toBe('class_1')
      expect(send).toHaveBeenCalledTimes(1)
      const command = send.mock.calls[0][0]
      expect(command.input.UpdateExpression).toContain('SET defaultClassId = :classId')
      expect(command.input.ExpressionAttributeValues[':classId']).toBe('class_1')
      expect(command.input.ConditionExpression).toBe('attribute_exists(PK)')
      expect(command.input.ReturnValues).toBe('ALL_NEW')
    })

    it('removes the default class attribute when cleared with null and returns the user', async () => {
      send.mockResolvedValue({ Attributes: { ...storedUser } })
      const updated = await updateUserDefaultClassId('abc-user', null)
      expect('defaultClassId' in updated).toBe(false)
      expect(send).toHaveBeenCalledTimes(1)
      const command = send.mock.calls[0][0]
      expect(command.input.UpdateExpression).toContain('REMOVE defaultClassId')
      expect(command.input.ReturnValues).toBe('ALL_NEW')
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

    it('returns the most recently updated record when duplicate emails exist', async () => {
      const older = { ...storedUser, id: 'old-user', updatedAt: '2026-01-01T00:00:00.000Z' }
      const newer = {
        ...storedUser,
        id: 'new-user',
        image: 'data:image/jpeg;base64,AAA',
        updatedAt: '2026-10-10T00:00:00.000Z',
      }
      // GSI query order is not guaranteed; duplicates must resolve deterministically.
      send.mockResolvedValue({ Items: [older, newer] })
      await expect(getUserByEmail('teacher@example.com')).resolves.toEqual(newer)
      send.mockResolvedValue({ Items: [newer, older] })
      await expect(getUserByEmail('teacher@example.com')).resolves.toEqual(newer)
    })

    it('retries once when the GSI has not propagated the record yet', async () => {
      // First query misses (eventual consistency), second hits after propagation.
      send.mockResolvedValueOnce({ Items: [] }).mockResolvedValueOnce({ Items: [storedUser] })
      await expect(getUserByEmail('teacher@example.com')).resolves.toEqual(storedUser)
      expect(send).toHaveBeenCalledTimes(2)
    })

    it('treats records without updatedAt as oldest when resolving duplicates', async () => {
      const noTimestamp = { ...storedUser, id: 'no-ts-user', updatedAt: undefined }
      const newer = { ...storedUser, id: 'new-user', updatedAt: '2026-10-10T00:00:00.000Z' }
      send.mockResolvedValue({ Items: [noTimestamp, newer] })
      await expect(getUserByEmail('teacher@example.com')).resolves.toEqual(newer)
      send.mockResolvedValue({ Items: [newer, noTimestamp] })
      await expect(getUserByEmail('teacher@example.com')).resolves.toEqual(newer)
    })

    it('returns undefined when the query returns no Items', async () => {
      send.mockResolvedValue({})
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

  describe('getUserVideoLibrary (issue #458)', () => {
    it('returns an empty library when the user does not exist', async () => {
      send.mockResolvedValue({ Item: undefined })
      await expect(getUserVideoLibrary('nope-user')).resolves.toEqual([])
    })

    it('returns an empty library when the attribute is absent', async () => {
      send.mockResolvedValue({ Item: storedUser })
      await expect(getUserVideoLibrary('abc-user')).resolves.toEqual([])
    })

    it('returns the stored library', async () => {
      const library = [{ videoId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', source: 'custom' as const }]
      send.mockResolvedValue({ Item: { ...storedUser, videoLibrary: library } })
      await expect(getUserVideoLibrary('abc-user')).resolves.toEqual(library)
    })
  })

  describe('addVideoToUserLibrary (issue #458)', () => {
    const video = { videoId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', source: 'custom' as const }

    it('throws when the user does not exist', async () => {
      send.mockResolvedValue({ Item: undefined })
      await expect(addVideoToUserLibrary('nope-user', video)).rejects.toThrow('User not found')
    })

    it('appends the video and writes the library back', async () => {
      send
        .mockResolvedValueOnce({ Item: storedUser })
        .mockResolvedValueOnce({ Attributes: { ...storedUser, videoLibrary: [video] } })
      const result = await addVideoToUserLibrary('abc-user', video)
      expect(result).toEqual([video])
      const command = send.mock.calls[1][0]
      expect(command.input.UpdateExpression).toBe('SET videoLibrary = :videos, updatedAt = :now')
      expect(command.input.ExpressionAttributeValues[':videos']).toEqual([video])
    })

    it('does not duplicate a video already in the library', async () => {
      send.mockResolvedValue({ Item: { ...storedUser, videoLibrary: [video] } })
      const result = await addVideoToUserLibrary('abc-user', video)
      expect(result).toEqual([video])
      expect(send).toHaveBeenCalledOnce()
    })

    it('caps the library at VIDEO_LIBRARY_MAX, keeping the newest', async () => {
      const full = Array.from({ length: VIDEO_LIBRARY_MAX }, (_, i) => ({
        videoId: `vid${String(i).padStart(8, '0')}`,
        title: `Video ${i}`,
        source: 'custom' as const,
      }))
      send
        .mockResolvedValueOnce({ Item: { ...storedUser, videoLibrary: full } })
        .mockResolvedValueOnce({ Attributes: { ...storedUser, videoLibrary: [...full.slice(1), video] } })
      const result = await addVideoToUserLibrary('abc-user', video)
      expect(result).toHaveLength(VIDEO_LIBRARY_MAX)
      expect(result[VIDEO_LIBRARY_MAX - 1]).toEqual(video)
      expect(result[0].videoId).toBe(full[1].videoId)
    })

    it('falls back to the written library when the update returns no attributes', async () => {
      send.mockResolvedValueOnce({ Item: storedUser }).mockResolvedValueOnce({ Attributes: {} })
      const result = await addVideoToUserLibrary('abc-user', video)
      expect(result).toEqual([video])
    })

    it('logs and rethrows when the update fails', async () => {
      send.mockResolvedValueOnce({ Item: storedUser }).mockRejectedValueOnce(new Error('boom'))
      await expect(addVideoToUserLibrary('abc-user', video)).rejects.toThrow('boom')
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('addVideoToUserLibrary concurrency (issue #473)', () => {
    const videoA = { videoId: 'aaa11111', title: 'Video A', source: 'custom' as const }
    const videoB = { videoId: 'bbb22222', title: 'Video B', source: 'custom' as const }

    // In-memory DynamoDB stand-in that honors ConditionExpression on the
    // videoLibrary attribute, so a test can replay the real race: two
    // requests read the same library, then each writes its own append.
    function mockRaceStore(initial: Record<string, unknown>) {
      let item = JSON.parse(JSON.stringify(initial)) as Record<string, unknown> & {
        videoLibrary?: { videoId: string }[]
      }
      const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value))
      send.mockImplementation(async (command: { input: Record<string, unknown> }) => {
        if (command.input.UpdateExpression) {
          const condition = command.input.ConditionExpression as string | undefined
          const values = (command.input.ExpressionAttributeValues ?? {}) as Record<string, unknown>
          const holds =
            condition === undefined ||
            (condition === 'attribute_not_exists(videoLibrary)'
              ? item.videoLibrary === undefined
              : condition === 'videoLibrary = :expectedLibrary' &&
                JSON.stringify(item.videoLibrary) === JSON.stringify(values[':expectedLibrary']))
          if (!holds) {
            const conflict = new Error('The conditional request failed')
            conflict.name = 'ConditionalCheckFailedException'
            throw conflict
          }
          item = {
            ...item,
            videoLibrary: copy(values[':videos'] as { videoId: string }[]),
            updatedAt: values[':now'] as string,
          }
          return { Attributes: copy(item) }
        }
        return { Item: copy(item) }
      })
      return () => item.videoLibrary ?? []
    }

    it('keeps both videos when two pastes race', async () => {
      const readLibrary = mockRaceStore(storedUser)
      await Promise.all([addVideoToUserLibrary('abc-user', videoA), addVideoToUserLibrary('abc-user', videoB)])
      const library = readLibrary()
      expect(library).toHaveLength(2)
      expect(library.map((entry) => entry.videoId).sort()).toEqual(['aaa11111', 'bbb22222'])
    })

    it('retries the write once when a concurrent write wins the race', async () => {
      const conflict = new Error('The conditional request failed')
      conflict.name = 'ConditionalCheckFailedException'
      send
        .mockResolvedValueOnce({ Item: storedUser })
        .mockRejectedValueOnce(conflict)
        .mockResolvedValueOnce({ Item: { ...storedUser, videoLibrary: [videoB] } })
        .mockResolvedValueOnce({ Attributes: { ...storedUser, videoLibrary: [videoB, videoA] } })
      const result = await addVideoToUserLibrary('abc-user', videoA)
      expect(result).toEqual([videoB, videoA])
      expect(send).toHaveBeenCalledTimes(4)
      const firstWrite = send.mock.calls[1][0]
      const retryWrite = send.mock.calls[3][0]
      expect(firstWrite.input.ConditionExpression).toBe('attribute_not_exists(videoLibrary)')
      expect(retryWrite.input.ConditionExpression).toBe('videoLibrary = :expectedLibrary')
      expect(retryWrite.input.ExpressionAttributeValues[':expectedLibrary']).toEqual([videoB])
    })

    it('throws after repeated write conflicts instead of looping forever', async () => {
      const conflict = new Error('The conditional request failed')
      conflict.name = 'ConditionalCheckFailedException'
      send.mockImplementation(async (command: { input: Record<string, unknown> }) => {
        if (command.input.UpdateExpression) throw conflict
        return { Item: { ...storedUser } }
      })
      await expect(addVideoToUserLibrary('abc-user', videoA)).rejects.toThrow('The conditional request failed')
      // 3 attempts x (1 read + 1 write)
      expect(send).toHaveBeenCalledTimes(6)
    })
  })
})
