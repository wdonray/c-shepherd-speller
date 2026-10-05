import { describe, it, expect } from 'vitest'
import {
  createUserItem,
  updateUserItem,
  updateUserTimestamps,
  USER_TABLE_NAME,
  USER_KEY_SCHEMA,
  type IUser,
} from './User'

function baseUser(overrides: Partial<IUser> = {}): IUser {
  return {
    id: 'u1-user',
    email: 'teacher@example.com',
    name: 'Teacher',
    lastActive: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    words: [],
    sounds: [],
    spelling: [],
    ...overrides,
  }
}

describe('User model', () => {
  it('exposes the table name and key schema constants', () => {
    expect(USER_TABLE_NAME).toBe(process.env.USER_TABLE_NAME || 'c-shepherd-users')
    expect(USER_KEY_SCHEMA).toEqual({ PK: '${id}-user', SK: '${id}-profile' })
  })

  it('createUserItem stamps createdAt and updatedAt', () => {
    const before = new Date().toISOString()
    const user = createUserItem({
      id: 'u1-user',
      email: 'teacher@example.com',
      name: 'Teacher',
      lastActive: before,
      words: ['cat'],
      sounds: [],
      spelling: [],
    })
    expect(user.createdAt).toBeTruthy()
    expect(user.updatedAt).toBeTruthy()
    expect(user.createdAt).toEqual(user.updatedAt)
    expect(user.words).toEqual(['cat'])
  })

  it('updateUserItem merges changes and refreshes updatedAt', () => {
    const user = baseUser({ updatedAt: '2020-01-01T00:00:00.000Z' })
    const updated = updateUserItem(user, { name: 'New Name', gradeLevel: '3rd' })
    expect(updated.name).toBe('New Name')
    expect(updated.gradeLevel).toBe('3rd')
    expect(updated.updatedAt).not.toBe('2020-01-01T00:00:00.000Z')
    expect(updated.createdAt).toBe(user.createdAt)
  })

  it('updateUserTimestamps only refreshes updatedAt', () => {
    const user = baseUser({ updatedAt: '2020-01-01T00:00:00.000Z' })
    const updated = updateUserTimestamps(user)
    expect(updated.updatedAt).not.toBe('2020-01-01T00:00:00.000Z')
    expect(updated.name).toBe(user.name)
    expect(updated.createdAt).toBe(user.createdAt)
  })
})
