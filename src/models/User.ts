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
  // Teacher-specific fields
  gradeLevel?: string
  subject?: string
  schoolName?: string
  classroomSize?: number
  preferredName?: string // How they want to be addressed by students
}

export const USER_TABLE_NAME = process.env.USER_TABLE_NAME || 'c-shepherd-users'
export const USER_KEY_SCHEMA = { PK: '${id}-user', SK: '${id}-profile' }

export function createUserItem(userData: Omit<IUser, 'id' | 'createdAt' | 'updatedAt'> & { id: string }): IUser {
  const now = new Date().toISOString()
  return { ...userData, createdAt: now, updatedAt: now }
}

export function updateUserItem(user: IUser, userData: Partial<IUser>): IUser {
  return { ...user, ...userData, updatedAt: new Date().toISOString() }
}

export function updateUserTimestamps(user: IUser): IUser {
  return { ...user, updatedAt: new Date().toISOString() }
}
