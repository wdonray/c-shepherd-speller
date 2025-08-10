/**
 * User Model for DynamoDB
 *
 * This module defines the User interface and utilities for users who use the C-Shepherd Speller
 * application. Uses basic information from Google authentication.
 *
 * Features:
 * - User authentication via Google OAuth
 * - Basic profile management
 * - Last active date tracking
 * - Created and updated timestamps
 */

export interface IUser {
  id: string
  email: string
  name: string
  image?: string
  lastActive: string
  createdAt: string
  updatedAt: string
  words: string[]
  sounds: string[]
  spelling: string[]
}

export const USER_TABLE_NAME = process.env.USER_TABLE_NAME || 'c-shepherd-users'
export const USER_KEY_SCHEMA = { PK: '${id}-user', SK: '${id}-profile' }

export function createUserItem(userData: Omit<IUser, 'id' | 'createdAt' | 'updatedAt'> & { id: string }): IUser {
  const now = new Date().toISOString()
  return { ...userData, createdAt: now, updatedAt: now }
}

export function updateUserTimestamps(user: IUser): IUser {
  return { ...user, updatedAt: new Date().toISOString() }
}
