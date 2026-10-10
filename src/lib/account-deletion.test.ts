import { describe, it, expect, vi, beforeEach } from 'vitest'

const { send } = vi.hoisted(() => ({ send: vi.fn() }))

vi.mock('@/lib/dynamodb', () => ({
  default: { send },
  docClient: { send },
  client: {},
}))

import {
  COGNITO_PROVIDERS,
  deleteAppUser,
  deleteAuthRecords,
  deleteUserLists,
  getAccountProviders,
} from './account-deletion'

describe('account-deletion', () => {
  beforeEach(() => {
    send.mockReset()
    delete process.env.AUTH_TABLE_NAME
  })

  describe('getAccountProviders', () => {
    it('returns the provider ids linked to an identity', async () => {
      send.mockResolvedValue({
        Items: [
          { pk: 'USER#u1', sk: 'USER#u1' },
          { pk: 'USER#u1', sk: 'ACCOUNT#google#g1', provider: 'google' },
          { pk: 'USER#u1', sk: 'ACCOUNT#email-password#c1', provider: 'email-password' },
        ],
      })
      await expect(getAccountProviders('u1')).resolves.toEqual(['google', 'email-password'])
      expect(send.mock.calls[0][0].input.TableName).toBe('next-auth')
    })

    it('dedupes providers and skips items without one', async () => {
      send.mockResolvedValue({
        Items: [
          { pk: 'USER#u1', sk: 'USER#u1' },
          { pk: 'USER#u1', sk: 'ACCOUNT#google#g1', provider: 'google' },
          { pk: 'USER#u1', sk: 'ACCOUNT#google#g2', provider: 'google' },
          { pk: 'USER#u1', sk: 'SESSION#s1' },
        ],
      })
      await expect(getAccountProviders('u1')).resolves.toEqual(['google'])
    })

    it('returns an empty array when nothing is linked', async () => {
      send.mockResolvedValue({ Items: [] })
      await expect(getAccountProviders('ghost')).resolves.toEqual([])
    })

    it('treats a missing Items payload as empty', async () => {
      send.mockResolvedValue({})
      await expect(getAccountProviders('ghost')).resolves.toEqual([])
    })

    it('follows query pagination', async () => {
      send
        .mockResolvedValueOnce({
          Items: [{ pk: 'USER#u1', sk: 'ACCOUNT#google#g1', provider: 'google' }],
          LastEvaluatedKey: { pk: 'USER#u1', sk: 'ACCOUNT#google#g1' },
        })
        .mockResolvedValueOnce({
          Items: [{ pk: 'USER#u1', sk: 'ACCOUNT#cognito#c1', provider: 'cognito' }],
        })
      await expect(getAccountProviders('u1')).resolves.toEqual(['google', 'cognito'])
      expect(send).toHaveBeenCalledTimes(2)
    })
  })

  describe('deleteAuthRecords', () => {
    it('batch-deletes every adapter record for the identity', async () => {
      send.mockResolvedValue({
        Items: [
          { pk: 'USER#u1', sk: 'USER#u1' },
          { pk: 'USER#u1', sk: 'ACCOUNT#google#g1' },
        ],
      })
      await deleteAuthRecords('u1')
      expect(send).toHaveBeenCalledTimes(2)
      const batch = send.mock.calls[1][0].input
      expect(batch.RequestItems['next-auth']).toEqual([
        { DeleteRequest: { Key: { pk: 'USER#u1', sk: 'USER#u1' } } },
        { DeleteRequest: { Key: { pk: 'USER#u1', sk: 'ACCOUNT#google#g1' } } },
      ])
    })

    it('is a no-op when there is nothing to delete', async () => {
      send.mockResolvedValue({ Items: [] })
      await deleteAuthRecords('ghost')
      expect(send).toHaveBeenCalledTimes(1)
    })

    it('chunks large record sets into batches of 25', async () => {
      const items = Array.from({ length: 30 }, (_, i) => ({ pk: 'USER#u1', sk: `SESSION#s${i}` }))
      send.mockResolvedValue({ Items: items })
      await deleteAuthRecords('u1')
      expect(send).toHaveBeenCalledTimes(3)
      expect(send.mock.calls[1][0].input.RequestItems['next-auth']).toHaveLength(25)
      expect(send.mock.calls[2][0].input.RequestItems['next-auth']).toHaveLength(5)
    })
  })

  describe('deleteUserLists', () => {
    it('deletes every list owned by the user', async () => {
      send.mockResolvedValue({
        Items: [
          { PK: 'USER#abc-user', SK: 'LIST#l1' },
          { PK: 'USER#abc-user', SK: 'LIST#l2' },
        ],
      })
      await deleteUserLists('abc-user')
      const batch = send.mock.calls[1][0].input
      expect(batch.RequestItems['shepherd-speller-lists']).toEqual([
        { DeleteRequest: { Key: { PK: 'USER#abc-user', SK: 'LIST#l1' } } },
        { DeleteRequest: { Key: { PK: 'USER#abc-user', SK: 'LIST#l2' } } },
      ])
    })

    it('is a no-op when the user has no lists', async () => {
      send.mockResolvedValue({ Items: [] })
      await deleteUserLists('abc-user')
      expect(send).toHaveBeenCalledTimes(1)
    })
  })

  describe('deleteAppUser', () => {
    it('deletes the user record by its keys', async () => {
      send.mockResolvedValue({})
      await deleteAppUser('abc-user')
      expect(send.mock.calls[0][0].input).toMatchObject({
        TableName: 'c-shepherd-users',
        Key: { PK: 'abc-user', SK: 'abc-profile' },
      })
    })
  })

  describe('COGNITO_PROVIDERS', () => {
    it('covers both Cognito-backed providers', () => {
      expect(COGNITO_PROVIDERS).toEqual(expect.arrayContaining(['cognito', 'email-password']))
    })
  })
})
